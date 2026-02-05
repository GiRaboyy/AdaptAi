# Supabase File Storage Integration

## 1. Overview

This design addresses persistent file storage for course resources using Supabase Storage, enabling reliable upload and download of user-submitted files (PDF, DOCX, TXT, MD) during course generation. The implementation ensures uploaded files persist independently of text extraction results and remain accessible for download in production environments.

**Problem Statement**: Currently, files are uploaded during course generation and stored either as base64 in the database or via Supabase Storage with inconsistent handling. The storage implementation exists but lacks formal resource listing endpoints with signed URLs and proper error handling for production reliability.

**Solution Scope**: Enhance existing upload flow to guarantee file persistence before parsing, implement resource listing API with short-lived signed URLs, and ensure download functionality works reliably in Vercel production.

## 2. Current State Analysis

### 2.1 Existing Implementation

**Upload Flow** (`server/routes.ts` lines 378-728):
- Multipart file upload via multer with memory storage
- File validation: 50MB limit per file, 20 files max
- Text extraction in parallel using `extractTextFromFile`
- Files stored in `knowledge_sources` table with path in `storagePath` field
- Conditional storage: Supabase Storage (if available) → base64 fallback → metadata-only

**Storage Module** (`server/supabase-storage.ts`):
- `uploadFile`: Uploads to Supabase bucket with deterministic path structure
- `downloadFile`: Retrieves file from bucket as Buffer
- `getSignedUrl`: Generates temporary signed URLs (default 1 hour)
- `isStorageAvailable`: Checks environment configuration validity
- Bucket name: Hardcoded as `adapt-ai-files`
- Path pattern: `tracks/{trackId}/{uuid}_{sanitized_filename}`

**Database Schema** (`shared/schema.ts` lines 79-91):
- `knowledgeSources` table stores:
  - `id`, `courseId`, `filename`, `storagePath`, `mimetype`, `sizeBytes`
  - `pageCount`, `extractedCharCount`
  - `status`: `'uploaded' | 'parsing' | 'indexed' | 'failed'`
  - `errorMessage`, `createdAt`

**Current Download Endpoint** (`server/routes.ts` lines 872-954):
- Route: `GET /api/tracks/:trackId/sources/:sourceId/download`
- Supports three storage modes:
  1. Supabase: prefix `supabase:` → calls `downloadFile()`
  2. Base64: prefix `data:` → decodes inline
  3. Metadata-only: prefix `metadata_only:` → returns placeholder text
- Returns file as direct buffer stream with proper Content-Disposition headers

**Existing Resource List Endpoint** (`server/routes.ts` lines 824-869):
- Route: `GET /api/tracks/:id/sources`
- Returns metadata array (id, filename, size, status, etc.)
- **Missing**: Does not include download URLs

### 2.2 Gaps Identified

| Issue | Current Behavior | Required Behavior |
|-------|------------------|-------------------|
| **Upload Atomicity** | Text extraction failure may prevent file save | File must be saved BEFORE extraction |
| **Download URL Exposure** | Resources endpoint returns metadata only | Must include short-lived signed URL or proxy path |
| **Service Role Key Security** | Key correctly kept server-side | Maintain isolation; never expose to browser |
| **Bucket Configuration** | Bucket name hardcoded | Should use environment variable `SUPABASE_BUCKET` |
| **Path Structure** | Current: `tracks/{trackId}/{uuid}_{filename}` | Required: `courses/{courseId}/resources/{resourceId}-{safeFilename}` |
| **Filename Sanitization** | Regex-based: `/[^a-zA-Z0-9._\-\u0400-\u04FF]/g` | Need NFKD normalization + safer handling |
| **Storage Status Tracking** | Status field exists but not fully utilized | Track extraction separately from storage success |
| **Production Validation** | Upload works; download reliability unclear | Must verify download works in Vercel serverless |

## 3. Architecture Design

### 3.1 System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     CLIENT (Browser)                        │
│  ┌────────────────┐         ┌─────────────────────────┐   │
│  │ Upload Dialog  │────────▶│ Resources List (UI)     │   │
│  │ (Multipart)    │         │ - Filename, size, status│   │
│  └────────────────┘         │ - Download button       │   │
│                              └─────────────────────────┘   │
└──────────────┬─────────────────────────┬───────────────────┘
               │                         │
         FormData POST              GET Resources
               │                         │
┌──────────────▼─────────────────────────▼───────────────────┐
│                   API SERVER (Node.js)                      │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  POST /api/tracks/generate                            │ │
│  │   1. Validate files (type, size, count)               │ │
│  │   2. Create track record                              │ │
│  │   3. Upload files to Supabase Storage FIRST           │ │
│  │   4. Save knowledge_sources records                   │ │
│  │   5. Extract text (errors non-blocking)               │ │
│  │   6. Generate course content                          │ │
│  └───────────────────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  GET /api/courses/:id/resources                       │ │
│  │   - Query knowledge_sources by courseId               │ │
│  │   - Generate signed URLs (10-15 min expiry)           │ │
│  │   - Return: id, filename, size, status, downloadUrl   │ │
│  └───────────────────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  GET /api/resources/:id/download (Alternative)        │ │
│  │   - Validate resource access                          │ │
│  │   - Stream file from Supabase                         │ │
│  │   - Set Content-Disposition header                    │ │
│  └───────────────────────────────────────────────────────┘ │
└──────────────┬─────────────────────────┬───────────────────┘
               │                         │
       Upload to bucket          Generate signed URL
               │                         │
┌──────────────▼─────────────────────────▼───────────────────┐
│              SUPABASE STORAGE (Backend)                     │
│  Bucket: appbase (or SUPABASE_BUCKET env var)             │
│  Path: courses/{courseId}/resources/{resourceId}-{safe}    │
│  Auth: Service Role Key (server-only)                      │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Data Flow Sequence

#### Upload Flow (Enhanced)
```
User uploads files → Multipart POST /api/tracks/generate
  ├─ [1] Validate: type (PDF/DOCX/TXT/MD), size (<50MB), count (<10)
  ├─ [2] Create track record in database (get trackId)
  ├─ [3] FOR EACH file:
  │      ├─ [3.1] Upload buffer to Supabase Storage
  │      │        Path: courses/{trackId}/resources/{uuid}-{safeFilename}
  │      │        Result: storage_path (e.g., "supabase:appbase/courses/123/...")
  │      ├─ [3.2] Create knowledge_sources record immediately
  │      │        Fields: courseId, filename, storage_path, mimetype, sizeBytes
  │      │        Status: 'pending' (extraction not yet attempted)
  │      │        extraction_status: 'pending'
  │      ├─ [3.3] Attempt text extraction (non-blocking)
  │      │        Success: Update extraction_status='ok', extracted_text_chars=N
  │      │        No text: Update extraction_status='no_text'
  │      │        Error: Update extraction_status='failed', extraction_error=message
  │      └─ [3.4] Continue even if extraction fails
  ├─ [4] Aggregate extracted text for course generation
  ├─ [5] Generate course content with AI
  └─ [6] Return response:
         {
           courseId: number,
           resources: [{ id, filename, mime, size, status, downloadUrl? }],
           warnings: string[],
           correlationId: string
         }
```

#### Download Flow (New)
```
User clicks download → GET /api/courses/:id/resources
  ├─ [1] Authenticate user (session/JWT)
  ├─ [2] Validate course access (curator owns OR employee enrolled)
  ├─ [3] Query knowledge_sources WHERE courseId = :id
  ├─ [4] FOR EACH resource:
  │      └─ Generate signed URL (10 min expiry) via Supabase client
  │         Method: client.storage.from(bucket).createSignedUrl(path, 600)
  └─ [5] Return JSON array:
         [
           {
             id: 1,
             filename: "Guide.pdf",
             mimetype: "application/pdf",
             sizeBytes: 2048000,
             extractionStatus: "ok",
             extractedTextChars: 15000,
             downloadUrl: "https://.../storage/.../signed-url?token=..."
           }
         ]

Alternative: Proxy Download
GET /api/resources/:id/download
  ├─ [1] Authenticate + validate access
  ├─ [2] Fetch file buffer from Supabase
  ├─ [3] Stream to response with Content-Disposition header
  └─ [4] Client receives file directly (no signed URL exposure)
```

## 4. Implementation Specifications

### 4.1 Configuration Management

**Environment Variables** (add to `.env` and `.env.example`):

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `SUPABASE_URL` | Supabase project URL | (required) | `https://abc123.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (server only) | (required) | `eyJ...` |
| `SUPABASE_BUCKET` | Storage bucket name | `appbase` | `appbase` |
| `SUPABASE_STORAGE_MAX_FILE_SIZE` | Max file size in bytes | `52428800` | 50MB (50 * 1024 * 1024) |
| `SUPABASE_STORAGE_MAX_FILE_COUNT` | Max files per upload | `10` | `10` |
| `SUPABASE_STORAGE_SIGNED_URL_EXPIRY` | Signed URL TTL (seconds) | `900` | 15 min |

**Validation Rules**:
- Allowed MIME types: `application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `text/plain`, `text/markdown`
- File extensions: `.pdf`, `.docx`, `.txt`, `.md`
- Max file size: Read from `SUPABASE_STORAGE_MAX_FILE_SIZE` env var
- Max file count: Read from `SUPABASE_STORAGE_MAX_FILE_COUNT` env var

### 4.2 Database Schema Updates

**Extend `knowledge_sources` Table**:

| Column | Type | Constraint | Purpose |
|--------|------|------------|---------|
| `storage_bucket` | `text` | nullable | Track which bucket stores the file |
| `storage_path` | `text` | not null | Full path including bucket (current) |
| `extraction_status` | `text` | not null, default `'pending'` | Track extraction separately: `'pending'|'ok'|'no_text'|'failed'` |
| `extraction_error` | `text` | nullable | Store extraction error message if failed |
| `extracted_text_chars` | `integer` | not null, default `0` | Count of extracted characters |

**Migration Strategy**:
- Add new columns with defaults to avoid breaking existing data
- Backfill `extraction_status='ok'` for existing records with `status='indexed'`
- Backfill `extraction_status='failed'` for records with `status='failed'` and `errorMessage` present

### 4.3 Storage Path Structure

**Deterministic Path Pattern**:
```
courses/{courseId}/resources/{resourceId}-{safeFilename}
```

**Components**:
- `courseId`: Integer track/course ID from database
- `resourceId`: Auto-generated UUID (first 8 chars)
- `safeFilename`: Sanitized original filename

**Filename Sanitization Algorithm**:
1. Apply Unicode NFKD normalization to decompose characters
2. Replace unsafe characters with underscore: `[^a-zA-Z0-9._\-\u0400-\u04FF]` → `_`
3. Collapse multiple underscores/spaces to single underscore
4. Preserve original extension (last dot + chars)
5. Store original filename separately in database `original_filename` field

**Example**:
```
Original:   "Руководство по продажам (2024).pdf"
Sanitized:  "Rukovodstvo_po_prodazham_2024.pdf"
Path:       "courses/42/resources/a1b2c3d4-Rukovodstvo_po_prodazham_2024.pdf"
Full:       "supabase:appbase/courses/42/resources/a1b2c3d4-Rukovodstvo_po_prodazham_2024.pdf"
```

### 4.4 Upload Process Specification

**Step-by-Step Algorithm**:

1. **Pre-Upload Validation**:
   - Check file count ≤ `SUPABASE_STORAGE_MAX_FILE_COUNT`
   - For each file:
     - Validate MIME type against allowed list
     - Validate size ≤ `SUPABASE_STORAGE_MAX_FILE_SIZE`
     - If any validation fails, return HTTP 400 with per-file errors

2. **Create Course Record**:
   - Insert into `tracks` table with title, curatorId, etc.
   - Obtain `courseId` for storage paths

3. **Parallel File Upload** (for each file):
   ```
   a. Generate resourceId = UUID.slice(0, 8)
   b. Sanitize filename → safeFilename
   c. Construct path: courses/{courseId}/resources/{resourceId}-{safeFilename}
   d. Upload Buffer to Supabase:
      - bucket.upload(path, buffer, { contentType: mimetype, upsert: false })
      - On success: storagePath = "supabase:{bucket}/{path}"
      - On failure: Log error, continue (track as failed)
   e. Create knowledge_sources record immediately:
      - courseId, filename (original), storagePath, mimetype, sizeBytes
      - status='uploaded', extraction_status='pending'
      - extracted_text_chars=0
   ```

4. **Parallel Text Extraction** (non-blocking):
   ```
   a. For each uploaded file:
      Try:
        - Extract text via extractTextFromFile(buffer)
        - If text.length > 0:
            Update extraction_status='ok', extracted_text_chars=text.length
        - Else:
            Update extraction_status='no_text'
      Catch error:
        - Update extraction_status='failed', extraction_error=error.message
   b. Collect all extracted text for course generation
   c. If ALL extractions fail → return HTTP 400 "No text extracted"
   d. If SOME fail → continue with partial text, include warnings in response
   ```

5. **Course Generation**:
   - Combine extracted text
   - Call AI generation service
   - Create steps in database

6. **Response Contract**:
   ```json
   {
     "courseId": 123,
     "resources": [
       {
         "id": 456,
         "original_filename": "Guide.pdf",
         "mime_type": "application/pdf",
         "size_bytes": 2048000,
         "extraction_status": "ok",
         "extracted_text_chars": 15000,
         "downloadUrl": null
       }
     ],
     "warnings": [
       "File 'broken.docx' extraction failed: Corrupt file"
     ],
     "correlationId": "uuid-v4"
   }
   ```

### 4.5 Resource Listing API

**Endpoint**: `GET /api/courses/:id/resources`

**Authentication**: Required (session or JWT)

**Authorization**:
- Curator: Must own the course (`track.curatorId = user.id`)
- Employee: Must be enrolled (`enrollments.userId = user.id AND enrollments.trackId = :id`)

**Query Parameters**: None

**Response Schema**:
```typescript
interface ResourceListResponse {
  resources: {
    id: number;
    original_filename: string;
    mime_type: string;
    size_bytes: number;
    extraction_status: 'pending' | 'ok' | 'no_text' | 'failed';
    extracted_text_chars: number;
    extraction_error?: string;
    created_at: string; // ISO 8601
    downloadUrl: string; // Signed URL, expires in 10-15 min
  }[];
}
```

**Logic**:
1. Authenticate user
2. Fetch course/track by ID
3. Validate access:
   - If curator: Check `track.curatorId = user.id`
   - If employee: Check enrollment exists
4. Query `knowledge_sources` WHERE `courseId = :id` ORDER BY `created_at ASC`
5. For each resource:
   - Generate signed URL:
     ```typescript
     const { data, error } = await supabaseClient.storage
       .from(SUPABASE_BUCKET)
       .createSignedUrl(extractPath(storagePath), 900); // 15 min
     
     downloadUrl = data?.signedUrl || null;
     ```
6. Return JSON array with all fields

**Error Handling**:
- 401: Not authenticated
- 403: Access denied (not owner/enrolled)
- 404: Course not found
- 500: Server error (e.g., Supabase unavailable)

### 4.6 Download Proxy API (Alternative)

**Endpoint**: `GET /api/resources/:id/download`

**Authentication**: Required

**Authorization**:
- Fetch resource by ID
- Fetch course by `resource.courseId`
- Apply same curator/employee access checks

**Response**:
- Content-Type: From `resource.mimetype`
- Content-Disposition: `attachment; filename*=UTF-8''{encoded_filename}`
- Body: Binary file stream

**Logic**:
1. Authenticate user
2. Fetch resource by ID
3. Fetch course by `resource.courseId`
4. Validate access (curator owns OR employee enrolled)
5. Download file from Supabase:
   ```typescript
   const { buffer, contentType } = await downloadFile(resource.storagePath);
   if (!buffer) return 500 "Failed to retrieve file";
   ```
6. Set headers:
   ```typescript
   res.setHeader('Content-Type', contentType);
   res.setHeader('Content-Disposition', encodeFilenameForHeader(filename));
   res.setHeader('Content-Length', buffer.length);
   res.send(buffer);
   ```

**Advantages**:
- No signed URL exposure to browser
- Centralized access control
- Works regardless of Supabase Storage RLS configuration

**Disadvantages**:
- Consumes server bandwidth (proxy overhead)
- Slower for large files (serverless timeout risk in Vercel)

**Recommendation**: Use signed URLs for listing API; provide proxy as fallback for clients that prefer server-mediated downloads.

### 4.7 Error Handling Strategy

**Upload Errors** (per-file):

| Error Type | HTTP Code | Behavior | User Message |
|------------|-----------|----------|--------------|
| Invalid file type | 400 | Reject request | "File {name} format not supported. Use PDF, DOCX, TXT, or MD." |
| File too large | 400 | Reject request | "File {name} exceeds 50MB limit." |
| Too many files | 400 | Reject request | "Maximum 10 files allowed per upload." |
| Supabase upload failure | 500 (partial) | Continue, mark as failed in DB | "File {name} upload failed. Please retry." |
| Extraction failure | (no error) | Continue, mark extraction_status='failed' | Warning: "File {name} text extraction failed." |

**Download Errors**:

| Error Type | HTTP Code | User Message |
|------------|-----------|--------------|
| Resource not found | 404 | "File not found." |
| Access denied | 403 | "You do not have permission to access this file." |
| Supabase unavailable | 500 | "Storage service temporarily unavailable. Please try again." |
| File missing in storage | 500 | "File data corrupted or missing. Contact support." |

**Observability Requirements**:
- Log all upload operations with:
  - `correlationId`, `userId`, `courseId`, `filename`, `sizeBytes`
  - Upload duration, storage result (success/failure)
  - Extraction result (success/failure/chars extracted)
- Log all download operations with:
  - `userId`, `resourceId`, `filename`
  - Download duration, bytes transferred
  - Signed URL generation success/failure

## 5. API Contract Specifications

### 5.1 POST /api/tracks/generate (Enhanced Response)

**Changes to Existing Endpoint**:
- Response body adds `resources` array
- Response body adds `warnings` array for partial failures

**Enhanced Response Schema**:
```json
{
  "track": { /* existing track object */ },
  "steps": [ /* existing steps array */ ],
  "generation": { /* existing generation metadata */ },
  "resources": [
    {
      "id": 456,
      "original_filename": "Training Guide.pdf",
      "mime_type": "application/pdf",
      "size_bytes": 2048000,
      "extraction_status": "ok",
      "extracted_text_chars": 15000
    }
  ],
  "warnings": [
    "File 'broken.docx' text extraction failed: Corrupt file"
  ],
  "correlationId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

### 5.2 GET /api/courses/:id/resources (New Endpoint)

**Request**:
- Method: GET
- Path: `/api/courses/:id/resources`
- Headers: `Cookie: session=...` or `Authorization: Bearer <jwt>`
- Parameters:
  - `id` (path, number): Course/track ID

**Response Success (200)**:
```json
{
  "resources": [
    {
      "id": 456,
      "original_filename": "Training Guide.pdf",
      "mime_type": "application/pdf",
      "size_bytes": 2048000,
      "extraction_status": "ok",
      "extracted_text_chars": 15000,
      "extraction_error": null,
      "created_at": "2024-01-15T10:30:00Z",
      "downloadUrl": "https://abc123.supabase.co/storage/v1/object/sign/appbase/courses/42/resources/xyz.pdf?token=..."
    }
  ]
}
```

**Response Errors**:
- 401: `{ "message": "Authentication required" }`
- 403: `{ "message": "Access denied" }`
- 404: `{ "message": "Course not found" }`
- 500: `{ "message": "Failed to retrieve resources" }`

### 5.3 GET /api/resources/:id/download (Alternative Proxy)

**Request**:
- Method: GET
- Path: `/api/resources/:id/download`
- Headers: `Cookie: session=...` or `Authorization: Bearer <jwt>`
- Parameters:
  - `id` (path, number): Resource ID

**Response Success (200)**:
- Content-Type: `{resource.mimetype}`
- Content-Disposition: `attachment; filename*=UTF-8''{encoded_filename}`
- Body: Binary file stream

**Response Errors**:
- 401: `{ "message": "Authentication required" }`
- 403: `{ "message": "Access denied" }`
- 404: `{ "message": "Resource not found" }`
- 500: `{ "message": "Failed to download file" }`

## 6. Security Considerations

### 6.1 Access Control Matrix

| User Role | Course Ownership | Enrollment | Resources API | Download API |
|-----------|------------------|------------|---------------|--------------|
| Curator | Owns course | N/A | ✅ List + URLs | ✅ Download |
| Curator | Does NOT own | N/A | ❌ 403 | ❌ 403 |
| Employee | N/A | Enrolled | ✅ List + URLs | ✅ Download |
| Employee | N/A | Not enrolled | ❌ 403 | ❌ 403 |
| Anonymous | N/A | N/A | ❌ 401 | ❌ 401 |

### 6.2 Service Role Key Isolation

**Critical Requirements**:
- `SUPABASE_SERVICE_ROLE_KEY` MUST remain server-side only
- NEVER expose service key to browser (no VITE_ prefix, not in client bundles)
- Client uses `VITE_SUPABASE_ANON_KEY` for authentication only
- All storage operations use service role key on server

**Validation Checklist**:
- [ ] Service key only in `.env` (not `.env.example` values)
- [ ] No `VITE_` prefix on service key variable
- [ ] Client receives signed URLs only (pre-authenticated)
- [ ] Supabase Storage RLS policies optional (server-mediated access)

### 6.3 Signed URL Security

**Properties**:
- Expiry: 10-15 minutes (configurable via `SUPABASE_STORAGE_SIGNED_URL_EXPIRY`)
- Single-use: No (Supabase signed URLs are reusable until expiry)
- Scope: Access to single file only (path-specific)

**Risk Mitigation**:
- Short TTL limits exposure window
- URLs are specific to individual resources (no wildcard access)
- Access checks performed BEFORE URL generation
- URLs not logged to client-accessible systems

### 6.4 Input Validation Rules

**Filename Validation**:
- Max length: 255 characters
- Reject path traversal: `..`, `/`, `\`
- Reject null bytes: `\x00`
- Allowed characters: `[a-zA-Z0-9._\-\u0400-\u04FF]` after sanitization

**MIME Type Validation**:
- Whitelist only: `application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `text/plain`, `text/markdown`
- Validate extension matches MIME type
- Reject mismatched or unknown types

**Size Validation**:
- Per-file: Max 50MB (configurable)
- Total upload: No explicit limit (bounded by file count × max size)

## 7. Testing Strategy

### 7.1 Upload Test Cases

| Test Case | Input | Expected Outcome |
|-----------|-------|------------------|
| Single PDF upload | Valid PDF, 2MB | File stored in Supabase, resource record created, extraction success |
| Multiple files | 3 files (PDF, DOCX, TXT) | All 3 stored with unique paths, all extracted |
| Oversized file | PDF 60MB | HTTP 400, rejected before upload |
| Invalid type | .exe file | HTTP 400, rejected before upload |
| Extraction failure | Corrupt PDF | File stored, resource created, extraction_status='failed', warning returned |
| All files fail extraction | 2 corrupt files | HTTP 400 after storage, "No text extracted" error |
| Supabase unavailable | Valid file, Supabase down | Fallback to base64 storage (or error if strict mode) |
| Cyrillic filename | "Руководство.pdf" | Stored with sanitized path, original name preserved in DB |
| Path traversal attempt | "../../../etc/passwd.pdf" | Rejected or sanitized safely |
| Concurrent uploads | 2 users upload simultaneously | Both succeed with unique resourceIds |

### 7.2 Download Test Cases

| Test Case | Setup | Request | Expected Outcome |
|-----------|-------|---------|------------------|
| Curator downloads own resource | User owns course, resource exists | GET resources API | Signed URLs returned, download succeeds |
| Employee downloads enrolled resource | User enrolled, resource exists | GET resources API | Signed URLs returned, download succeeds |
| Unauthorized download attempt | User not enrolled, not curator | GET resources API | HTTP 403 Forbidden |
| Expired signed URL | URL generated 20 min ago | Click download link | HTTP 403 or 404 from Supabase |
| Missing file in storage | Resource record exists, file deleted | GET download | HTTP 500 "File missing" |
| Proxy download | Use alternative endpoint | GET /api/resources/:id/download | File streamed directly, proper headers |
| Large file download | 45MB PDF | GET download | Successful stream, no timeout in Vercel |

### 7.3 Manual Verification Steps

**Vercel Production Checklist**:
1. Deploy to Vercel with `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_BUCKET` configured
2. Upload 3 files via UI: 1 PDF (5MB), 1 DOCX (2MB), 1 TXT (100KB)
3. Verify all 3 appear in Supabase Storage bucket via dashboard
4. Navigate to course resources page
5. Verify list shows all 3 files with metadata
6. Click download for each file
7. Verify files download correctly with original names
8. Check browser network tab: confirm signed URLs present and valid
9. Wait 16 minutes, refresh list
10. Verify new signed URLs generated (old ones expired)
11. Test download again, confirm still works

## 8. Deployment Checklist

### 8.1 Environment Configuration

**Required Variables** (add to Vercel dashboard):
- [ ] `SUPABASE_URL` - Project URL from Supabase dashboard
- [ ] `SUPABASE_SERVICE_ROLE_KEY` - Service role key (Settings → API)
- [ ] `SUPABASE_BUCKET` - Bucket name (default: `appbase`)

**Optional Variables** (with defaults):
- [ ] `SUPABASE_STORAGE_MAX_FILE_SIZE` - Default: `52428800` (50MB)
- [ ] `SUPABASE_STORAGE_MAX_FILE_COUNT` - Default: `10`
- [ ] `SUPABASE_STORAGE_SIGNED_URL_EXPIRY` - Default: `900` (15 min)

### 8.2 Supabase Setup

**Bucket Configuration**:
1. Navigate to Supabase Dashboard → Storage
2. Create bucket named `appbase` (or value from `SUPABASE_BUCKET`)
3. Bucket settings:
   - Public: No (private bucket)
   - File size limit: 50MB
   - Allowed MIME types: (optional restriction)

**RLS Policies** (optional, server-mediated access):
- If using signed URLs: No policies needed (service role bypasses RLS)
- If using direct client access: Define policies for authenticated users

### 8.3 Database Migration

**Migration File** (e.g., `0009_enhance_knowledge_sources.sql`):
```sql
ALTER TABLE knowledge_sources
ADD COLUMN IF NOT EXISTS storage_bucket TEXT,
ADD COLUMN IF NOT EXISTS extraction_status TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS extraction_error TEXT,
ADD COLUMN IF NOT EXISTS extracted_text_chars INTEGER NOT NULL DEFAULT 0;

-- Backfill extraction_status for existing records
UPDATE knowledge_sources
SET extraction_status = CASE
  WHEN status = 'indexed' THEN 'ok'
  WHEN status = 'failed' AND error_message IS NOT NULL THEN 'failed'
  ELSE 'pending'
END
WHERE extraction_status = 'pending';
```

**Migration Execution**:
```bash
# Local development
npm run db:migrate

# Vercel production (via Supabase SQL editor or CI/CD)
# Apply migration manually if no automated migration system
```

### 8.4 Observability Setup

**Logging Requirements**:
- All upload/download operations logged with correlationId
- Log retention: 30 days minimum
- Log aggregation: Vercel logs or external service (e.g., Datadog, Sentry)

**Monitoring Metrics**:
- Upload success rate (target: >95%)
- Download success rate (target: >99%)
- Average file size uploaded
- Average signed URL generation time
- Storage quota usage (alert at 80%)

**Alerts**:
- Upload failure rate >10% in 15 min window → Page on-call
- Download failure rate >5% in 15 min window → Page on-call
- Supabase Storage unavailable → Immediate alert

## 9. Rollback Plan

**If Production Issues Occur**:

1. **Immediate Mitigation**:
   - Revert to previous deployment via Vercel dashboard
   - Disable new resources API endpoint via feature flag (if available)
   - Fall back to base64 storage if Supabase issues detected

2. **Data Integrity**:
   - New `knowledge_sources` records compatible with old schema (new columns nullable or have defaults)
   - Existing records unaffected by new columns
   - Migration reversible:
     ```sql
     ALTER TABLE knowledge_sources
     DROP COLUMN IF EXISTS storage_bucket,
     DROP COLUMN IF EXISTS extraction_status,
     DROP COLUMN IF EXISTS extraction_error,
     DROP COLUMN IF EXISTS extracted_text_chars;
     ```

3. **Client Impact**:
   - Old UI: Continues to work with existing download endpoint (`/api/tracks/:trackId/sources/:sourceId/download`)
   - New UI with resources list: Gracefully degrade to "Contact support for file access"

## 10. Success Criteria

**Functional Requirements**:
- [ ] Upload 1 PDF → file persists in Supabase → downloadable in production
- [ ] Upload 5 mixed files (PDF, DOCX, TXT) → all stored with unique paths
- [ ] Resources list API returns metadata + working signed URLs
- [ ] Extraction failure for 1 file → file still listed and downloadable
- [ ] Download via signed URL works in Vercel production (no timeouts)
- [ ] Download via proxy endpoint works as alternative
- [ ] Cyrillic filenames handled correctly (no garbled characters)

**Non-Functional Requirements**:
- [ ] Upload duration <30 seconds for 10 files totaling 100MB
- [ ] Signed URL generation <500ms per resource
- [ ] Download via proxy <10 seconds for 50MB file in Vercel
- [ ] No local filesystem reliance (serverless-compatible)
- [ ] Observability: All operations logged with correlationId
- [ ] Security: Service role key never exposed to browser

**Acceptance Test**:
1. Deploy to Vercel production
2. Upload 3 files (PDF 10MB, DOCX 5MB, TXT 50KB)
3. Verify files visible in Supabase Storage dashboard
4. Navigate to course resources page
5. Verify list shows 3 files with sizes and statuses
6. Click download for each file
7. Verify files download with correct names and content
8. Check Vercel logs for correlationIds and success status
9. Verify no errors or warnings in browser console
10. Test fails if any step fails

## 11. Open Questions

| Question | Current Assumption | Decision Needed |
|----------|-------------------|-----------------|
| Bucket name configuration | Use `SUPABASE_BUCKET` env var, default `appbase` | Confirm default or allow dynamic per-client |
| Signed URL expiry | 15 minutes | Adjust based on typical user session length? |
| Large file timeout risk | Vercel timeout = 10 sec (hobby), 60 sec (pro) | Recommend proxy for files >10MB or only signed URLs? |
| Storage quota monitoring | Manual via Supabase dashboard | Implement automated quota alerts? |
| Versioning strategy | No file versioning (immutable uploads) | Support file replacement or versioning in future? |

## 12. Future Enhancements (Out of Scope)

- **Virus scanning**: Integrate ClamAV or similar for uploaded files
- **File preview**: Generate thumbnails or text previews for UI
- **Bulk download**: Zip multiple files for single download
- **File expiration**: Auto-delete resources after course deletion or retention period
- **CDN integration**: CloudFront or Cloudflare caching for faster downloads
- **Direct browser upload**: Presigned POST URLs for client-side upload to Supabase
