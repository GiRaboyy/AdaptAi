# AdaptAI Production Fix - Design Document

## Executive Summary

This design addresses critical production issues preventing the AdaptAI platform from functioning correctly on Vercel. The root causes are: (1) serverless architecture misalignment, (2) authentication/profile synchronization failures, (3) file storage configuration gaps, (4) course generation scaling issues, and (5) TypeScript compilation errors blocking deployment.

**Target State**: Stable production deployment where users can register, verify email, login, upload course materials (PDF/DOCX/TXT/MD), and generate properly-sized courses (12/24/36 questions) without 401/404/JSON parsing errors.

## Problem Statement

### Current State Issues

1. **Frontend serving failure**: "Visit" button causes white screen or file download instead of serving SPA
2. **API route failures**: 401/404 errors on `/api/user`, `/api/tracks/generate` 
3. **JSON parsing errors**: Frontend receives HTML instead of JSON ("Unexpected token 'T'...")
4. **Module resolution errors**: `ERR_MODULE_NOT_FOUND` when importing `server/app` from `api/[...path]`
5. **File system errors**: `ENOENT: open './test/data/05-versions-space.pdf'` in production
6. **Profile synchronization**: User exists in Supabase Auth but missing from `public.users` table
7. **Course generation issues**: Generates 112 questions instead of 12/24/36; slow generation
8. **TypeScript errors**: Build failures due to type mismatches in auth middleware

### Environment Context

- **Frontend**: Vite + React + Wouter + shadcn/ui
- **Backend**: Node.js + Express + Drizzle ORM + PostgreSQL
- **Authentication**: Dual-mode (Supabase Auth for JWT + Passport for session fallback)
- **Storage**: Supabase Storage for persistent files + PostgreSQL for metadata
- **AI**: Yandex Cloud for course generation
- **Deployment**: Vercel serverless functions + static hosting

## Root Cause Analysis

### 1. Serverless Architecture Mismatch

**Problem**: Current setup imports Express app from `server/app.ts` into `api/[...path].ts`, causing module resolution issues in Vercel's bundler.

**Root Cause**: Vercel serverless functions bundle dependencies differently than local Node.js. The ESM import path resolution (`import.meta.dirname`) and relative imports fail when executed in the serverless context.

**Evidence**:
- `api/[...path].ts` lines 20-45 attempt dynamic import with fallback logic
- `vercel.json` includes `"includeFiles": "api/server-app.cjs"` but file may not be in correct location post-build
- Build script copies bundle to `api/server-app.cjs` but timing/path issues persist

### 2. Static vs API Route Conflicts

**Problem**: Vercel routing configuration doesn't properly separate static assets from API requests.

**Root Cause**: Current `vercel.json` rewrites at lines 44-46:
```
{ "source": "/api/:path*", "destination": "/api/[...path]" }
{ "source": "/((?!api/).*)", "destination": "/index.html" }
```

This regex doesn't account for static assets (`/assets/*`, `/favicon.*`) being caught by the API handler or vice versa.

**Evidence**: Reports of "white screen" and "download file" behavior suggest incorrect Content-Type headers or routing.

### 3. Authentication Flow Fragmentation

**Problem**: Three authentication mechanisms (Supabase JWT, Passport session, email verification) operate independently without guaranteed synchronization.

**Root Cause**: 
- `server/middleware/auth-supabase.ts` creates profile on-demand (lines 98-155) but only if JWT token present
- Passport session (lines 294-307 in `server/auth.ts`) expects profile to exist
- Email verification callback doesn't guarantee profile creation before login

**Evidence**:
- Middleware at line 134-155 shows "lazy create" logic that only triggers on JWT request
- No database trigger to auto-create profile when Supabase Auth user created
- `/api/user` endpoint returns 401 if no `req.user` but doesn't attempt lazy creation

### 4. File Storage Strategy Gaps

**Problem**: Uploaded files aren't persisted to production-safe storage.

**Root Cause**:
- `server/routes.ts` lines 530-565 show Supabase Storage upload logic
- Fallback to base64 encoding in DB (line 554) for large files exceeds practical limits
- No verification that Supabase Storage is configured before accepting uploads
- Test file references (`./test/data/...pdf`) exist in code paths that execute in production

**Evidence**:
- Error message `ENOENT: open './test/data/05-versions-space.pdf'`
- Upload handler uses `multer.memoryStorage()` (line 22) which is correct, but downstream storage isn't guaranteed

### 5. Course Generation Scaling Issues

**Problem**: Legacy V1 generator produces excessive questions (112 instead of 12-36) and includes roleplay scenarios that should not be generated.

**Root Cause**:
- `generateTrackContent()` function (lines 143-305 in `server/routes.ts`) uses deterministic budget but LLM prompt allows AI to "expand"
- System prompt at line 188 doesn't enforce hard limit: `"РОВНО ${totalQuestions} элементов в 'steps'"`
- Roleplay type ("ai_role", "user_role", "scenario") is still included in generation despite being unsuitable for automated generation
- No token budget limiting input context size, causing AI to over-generate
- Validation logic (line 273) rejects undercount but only trims excess after 3 attempts

**Evidence**:
- Reported "112 questions from small document"
- V1 prompt passes up to 8000 chars of KB (line 195) with no outline/summary step
- Roleplay type present in budget calculation (line 159) and prompt (line 171)
- No chunking or content reduction strategy

## Solution Design

### Architecture: Vercel Serverless Optimization

#### Decision: Isolated API Handler Pattern

**Approach**: Consolidate Express app bundling and ensure Vercel function receives self-contained CJS module.

**Design**:

1. **Build-time Bundle Creation**
   - `script/build.ts` already creates `dist/server-app.cjs` (lines 68-81)
   - Ensure bundle includes all necessary dependencies (allowlist at lines 9-36)
   - Copy bundle to `api/server-app.cjs` during build (lines 99-102)

2. **Runtime Import Strategy**
   - `api/[...path].ts` imports bundle with environment-based path resolution
   - Production: `import('./server-app.cjs')` (relative to api folder)
   - Development: `import('../server/app')` (TypeScript source)
   - Add explicit error handling for missing bundle

3. **Routing Configuration**
   - Update `vercel.json` rewrites to explicit precedence:
     ```
     Static assets first: /assets/*, /favicon.*, /*.{js,css,woff2,png,jpg,svg}
     API routes second: /api/*
     SPA fallback last: /* -> /index.html
     ```

#### Benefits
- Eliminates ESM resolution issues in serverless environment
- Clear separation of concerns (static vs API)
- Predictable cold start behavior

#### Risks & Mitigations
- **Risk**: Bundle size increases cold start time
  - **Mitigation**: Allowlist keeps bundle minimal; Vercel 1024MB memory config adequate
- **Risk**: Build fails to copy bundle
  - **Mitigation**: Add verification step in build script; fail fast with clear error

### Authentication & Profile Synchronization

#### Decision: Multi-Layer Profile Guarantee

**Approach**: Ensure profile exists at multiple checkpoints, not just lazy creation.

**Design**:

1. **Database Trigger (Primary)**
   - Create PostgreSQL trigger on `auth.users` insert (via Supabase)
   - Auto-insert matching row into `public.users` with `auth_uid` reference
   - Extract metadata (name, role) from `raw_user_meta_data` JSONB
   - Handle conflicts with `ON CONFLICT (auth_uid) DO NOTHING`
   
   **Trigger Logic** (Conceptual):
   ```
   TRIGGER: on_auth_user_created
   FOR EACH ROW AFTER INSERT ON auth.users
   EXECUTE: insert_public_user_profile
   
   Function checks:
   - If public.users WHERE auth_uid = NEW.id exists -> skip
   - Else -> INSERT INTO public.users (
       auth_uid, email, name, role, email_verified, plan, created_courses_count
     ) VALUES (
       NEW.id, NEW.email, 
       NEW.raw_user_meta_data->>'name' OR split_part(NEW.email, '@', 1),
       NEW.raw_user_meta_data->>'role' OR 'employee',
       NEW.email_confirmed_at IS NOT NULL,
       'trial', 0
     ) ON CONFLICT (auth_uid) DO NOTHING
   ```

2. **Middleware Lazy Creation (Secondary)**
   - Keep existing logic in `server/middleware/auth-supabase.ts` lines 134-155
   - Add defensive check: if trigger failed for any reason, create profile
   - Log when lazy creation triggers (indicates trigger didn't fire)

3. **API Endpoint Defensive Creation (Tertiary)**
   - `/api/user` and `/api/me` endpoints check `req.user`
   - If authenticated (JWT valid) but no profile, create immediately
   - Return created profile, don't return 401

4. **Email Verification Sync**
   - Update `server/auth.ts` `/auth/callback` handler (lines 346-421)
   - After Supabase verifies email, ensure local DB `email_verified` updated
   - Already implemented at lines 394-400, verify idempotency

#### Benefits
- Eliminates "Не удалось загрузить профиль" errors
- Robust against race conditions (registration → email verify → login)
- Works even if Supabase webhook/trigger fails

#### Risks & Mitigations
- **Risk**: Duplicate profiles if multiple layers race
  - **Mitigation**: `UNIQUE(auth_uid)` constraint + `ON CONFLICT` clauses
- **Risk**: Trigger requires Supabase project access
  - **Mitigation**: Include SQL migration file in repo; document manual setup if needed

### File Upload & Storage Persistence

#### Decision: Supabase Storage Primary, DB Fallback

**Approach**: Enforce Supabase Storage for production; fail fast if unavailable.

**Design**:

1. **Storage Availability Check**
   - Add startup validation: if `DATABASE_FILE_STORAGE_URL` and `DATABASE_FILE_STORAGE_KEY` missing, log warning
   - In `/api/tracks/generate` handler (line 379), check `isStorageAvailable()` before accepting uploads
   - If unavailable in production, return 503 with clear message: "File storage not configured"

2. **Upload Flow**
   - Client uploads to `/api/tracks/generate` with `multipart/form-data`
   - Backend uses `multer.memoryStorage()` (already implemented, line 22)
   - For each file:
     - Extract text in memory (lines 103-140, no disk writes)
     - Upload buffer to Supabase Storage via `uploadFile()` (lines 539-545)
     - Store metadata in `knowledge_sources` table (lines 567-577)
     - If Supabase upload fails AND file < 5MB, fall back to base64 in DB (line 554)
     - If file > 5MB and Supabase fails, reject upload with error

3. **Storage Path Convention**
   - Bucket: `course-materials` (or configured bucket name)
   - Path: `courses/{courseId}/{uuid}-{sanitized_filename}`
   - Ensure RLS policies allow service role write access

4. **Eliminate Test File References**
   - Search codebase for `./test/data/`, `fixtures/`, hardcoded file paths
   - Replace with proper upload flow or remove if unused
   - Verify no module-level `fs.readFileSync()` calls in production code paths

#### Benefits
- Files persist across serverless function invocations
- Clear failure modes (503 if storage unavailable)
- No filesystem dependencies in Vercel environment

#### Risks & Mitigations
- **Risk**: Supabase Storage quota exceeded
  - **Mitigation**: Monitor usage; implement file size limits (already 50MB per line 24)
- **Risk**: Network timeout during large uploads
  - **Mitigation**: Request timeout set to 300s (line 428); Vercel maxDuration 300s (vercel.json line 50)

### Course Generation Optimization

#### Decision: Structured Outline → Targeted Generation (MCQ + Open Questions Only)

**Approach**: Two-phase LLM call to control output size and speed. **CRITICAL**: Remove roleplay scenario generation entirely.

**Design**:

1. **Question Type Restriction**
   - **Allowed types**: `mcq` (multiple choice), `open` (open-ended)
   - **Forbidden types**: `roleplay` (removed from all generation paths)
   - Update schema enum in `shared/schema.ts` steps table to only allow `["mcq", "open"]`
   - Remove roleplay from budget calculations, prompts, and validation logic
   
   **Rationale**: Roleplay scenarios with ai_role/user_role require manual curation and cannot be reliably auto-generated from knowledge base content. They introduce quality issues and generation complexity.

2. **Phase 1: Content Outline (Fast)**
   - Input: Course title + KB summary (first 3000 chars or adaptive chunk)
   - Prompt: "Create course outline with 3-5 topics, each with 1-2 subtopics"
   - Timeout: 30 seconds
   - Output: JSON structure with topic hierarchy
   
   **Outline Schema**:
   ```
   {
     topics: [
       { title: string, subtopics: string[], priority: 'high' | 'medium' }
     ]
   }
   ```

3. **Phase 2: Question Generation (Batched, MCQ + Open Only)**
   - Determine batch size based on course size:
     - S (12 questions): 2 batches of 6
     - M (24 questions): 3 batches of 8
     - L (36 questions): 4 batches of 9
   - Question distribution per batch:
     - 60% MCQ (multiple choice with 4 options)
     - 40% Open (open-ended with rubric)
   - For each batch:
     - Select topics from outline proportionally
     - Prompt: "Generate EXACTLY {batch_size} questions from these topics: {topic_subset}. Types: {mcq_count} MCQ, {open_count} Open. NO roleplay scenarios."
     - Include strict JSON schema with question count validator
     - Timeout: 60 seconds per batch
   - Merge batches, validate total count

4. **Budget Enforcement**
   - Hard limits in prompts: "You MUST generate EXACTLY {N} questions. No more, no less."
   - Type restriction: "ONLY mcq and open types. NEVER generate roleplay."
   - Zod validation: reject response if `steps.length !== expected` OR if any step has `type === 'roleplay'`
   - Retry logic: if count mismatch or forbidden type found, regenerate THAT batch only (max 2 retries per batch)
   - Final safeguard: if total > target, trim; if total < target, pad with simple MCQ from outline

5. **Content Summarization**
   - Before Phase 1, if KB > 10,000 chars, run extractive summary:
     - Split into semantic chunks (paragraphs)
     - Score chunks by keyword density (course title terms)
     - Take top 50% by score, concatenate
     - Pass summarized KB to outline generation
   
   **Implementation** (server/ai/parsers.ts or new module):
   - Function `summarizeKnowledgeBase(text: string, title: string, maxChars: number)`
   - Uses simple TF-IDF or keyword matching (no extra LLM call)

#### Benefits
- Deterministic question count (12/24/36)
- Faster generation (parallel batches + smaller prompts)
- Reduced token costs
- **Higher quality**: No auto-generated roleplay scenarios with inconsistent quality
- **Simpler maintenance**: Only 2 question types instead of 3

#### Risks & Mitigations
- **Risk**: Users expect roleplay scenarios
  - **Mitigation**: Document this as a manual curation feature; provide UI to add roleplay steps manually after course creation
- **Risk**: Batching adds complexity
  - **Mitigation**: Existing V2 generator (lines 590-702) already implements batching; refine prompts
- **Risk**: Two-phase increases total latency
  - **Mitigation**: Outline generation is fast (<30s); overall time still under 5 minutes (Vercel limit)

### TypeScript Compilation Fixes

#### Decision: Fix Type Definitions, Don't Circumvent

**Approach**: Address each compilation error directly.

**Design**:

1. **Auth Middleware Type Issues** (server/middleware/auth-supabase.ts)
   
   **Problem** (lines 8-21): `AuthUser` interface defines `emailConfirmed`, but `User` type from schema has `emailVerified`.
   
   **Fix**:
   - Update `hasAuthUser()` type predicate to check correct property
   - Ensure `req.user` can be either `AuthUser` (Supabase JWT) or `User` (Passport session)
   - Use union type for `req.user`: `AuthUser | User`
   - Helper function `isEmailVerified(user: AuthUser | User)` that checks both properties

2. **Drizzle Alias Issues** (reported but not in visible code)
   
   **Context**: `.as("count")` alias errors suggest Drizzle version mismatch or incorrect import.
   
   **Fix**:
   - Verify Drizzle version: `drizzle-orm@^0.39.3` in package.json (line 59)
   - Check if query uses `sql<number>` generic (example at line 162 in storage.ts)
   - Ensure `count(...)` import from `drizzle-orm` (line 8 in storage.ts)
   - If error persists, cast result explicitly: `sql<number>\`COUNT(...)\`::int\``

3. **Express Request Extension**
   
   **Problem**: Adding `req.user` with different types causes conflicts.
   
   **Fix**:
   - Define global augmentation in `server/types.ts`:
     ```
     declare global {
       namespace Express {
         interface User extends Partial<AuthUser & import('@shared/schema').User> {}
         interface Request {
           user?: User;
         }
       }
     }
     ```
   - Update tsconfig.json to include server/types.ts

#### Benefits
- Clean TypeScript build (`npm run check` passes)
- Better IDE autocomplete
- Catch bugs at compile time

#### Risks & Mitigations
- **Risk**: Type changes break existing code
  - **Mitigation**: Test locally before deploying; use type guards in route handlers

## Implementation Plan

### Phase 1: Infrastructure & Routing (Priority: P0)

**Goal**: Fix Vercel deployment basics (static serving, API routing)

**Tasks**:

1. Update `vercel.json` rewrites to explicit precedence order
2. Verify `script/build.ts` bundle copy succeeds (add console.log)
3. Update `api/[...path].ts` import logic with better error handling
4. Test deployment to Vercel preview environment
5. Verify `/` loads SPA, `/api/health` returns JSON

**Acceptance**:
- [ ] SPA loads at root path without white screen
- [ ] `/api/health` returns JSON (not HTML)
- [ ] Static assets load with correct Content-Type headers
- [ ] No 404 on `/assets/*` resources

### Phase 2: Authentication & Profile Sync (Priority: P0)

**Goal**: Ensure user profile exists after registration/login

**Tasks**:

1. Create SQL migration for Supabase auth → users trigger
2. Update `server/middleware/auth-supabase.ts` to handle both user types
3. Add defensive profile creation to `/api/user` endpoint
4. Test registration → email verify → login flow
5. Verify profile appears in `public.users` table

**Acceptance**:
- [ ] After registration, user row exists in `public.users`
- [ ] After email verification, `email_verified = true` in DB
- [ ] `/api/user` returns profile JSON (not 401) for authenticated users
- [ ] No "Не удалось загрузить профиль" errors

### Phase 3: File Upload & Storage (Priority: P1)

**Goal**: Uploaded files persist to Supabase Storage

**Tasks**:

1. Add storage availability check to health endpoint
2. Update upload handler to fail fast if storage unavailable
3. Create Supabase Storage bucket with proper RLS policies
4. Remove all test file references from production code
5. Test file upload → parse → retrieve flow

**Acceptance**:
- [ ] Files upload to Supabase Storage (visible in dashboard)
- [ ] Metadata saved in `knowledge_sources` table
- [ ] No `ENOENT` errors in production logs
- [ ] Files remain accessible after serverless function cold start

### Phase 4: Course Generation (Priority: P1)

**Goal**: Generate exactly 12/24/36 questions quickly (MCQ + Open only, no roleplay)

**Tasks**:

1. Update `shared/schema.ts` steps table type enum to `["mcq", "open"]` (remove `"roleplay"`)
2. Remove roleplay from budget calculations in `server/ai/parsers.ts`
3. Update V1 and V2 generator prompts to exclude roleplay scenarios
4. Add Zod validation to reject roleplay type if returned by LLM
5. Implement content summarization function
6. Refactor V1 generator to two-phase (outline → questions)
7. Update V2 generator batch prompts with strict count enforcement
8. Test with small/medium/large documents

**Acceptance**:
- [ ] S course generates exactly 12 questions (MCQ + Open only)
- [ ] M course generates exactly 24 questions (MCQ + Open only)
- [ ] L course generates exactly 36 questions (MCQ + Open only)
- [ ] Zero roleplay steps generated in all test runs
- [ ] Generation completes in < 3 minutes for typical content
- [ ] No questions exceed 15 words (brevity requirement)
- [ ] Question distribution: ~60% MCQ, ~40% Open

### Phase 5: TypeScript & Build (Priority: P2)

**Goal**: Clean TypeScript compilation

**Tasks**:

1. Fix `AuthUser` vs `User` type conflicts
2. Add global Express type augmentation
3. Fix Drizzle alias issues
4. Run `npm run check` until zero errors
5. Enable TypeScript strict mode checks in CI

**Acceptance**:
- [ ] `npm run check` exits with code 0
- [ ] No `@ts-ignore` or `@ts-expect-error` in new code
- [ ] Vercel build succeeds without TypeScript warnings

## Environment Configuration

### Required Variables (Vercel Production)

**Database**:
- `DATABASE_URL`: PostgreSQL connection string (Supabase)

**Supabase**:
- `DATABASE_FILE_STORAGE_URL`: `https://{project-ref}.supabase.co`
- `DATABASE_FILE_STORAGE_KEY`: Service role key (for server-side storage bypass RLS)
- `SUPABASE_ANON_KEY`: Anon key (for JWT validation)

**Frontend (build-time)**:
- `VITE_SUPABASE_URL`: Same as `DATABASE_FILE_STORAGE_URL`
- `VITE_SUPABASE_ANON_KEY`: Same as `SUPABASE_ANON_KEY`

**Session**:
- `SESSION_SECRET`: 32+ character random string (generate with `openssl rand -base64 32`)
- `COOKIE_SECURE`: `true` (HTTPS required)

**Application**:
- `APP_URL`: Production domain (e.g., `https://adapt-ai.vercel.app`)
- `NODE_ENV`: `production` (auto-set by Vercel)

**AI**:
- `YANDEX_CLOUD_API_KEY`: Yandex API key
- `YANDEX_CLOUD_PROJECT_FOLDER_ID`: Yandex folder ID
- `YANDEX_PROMPT_ID`: Prompt template ID
- `YANDEX_TIMEOUT_MS`: `90000` (90 seconds)

**Email**:
- `SMTP_HOST`: `smtp.yandex.ru`
- `SMTP_PORT`: `465`
- `SMTP_USER`: Email address
- `SMTP_PASSWORD`: App-specific password
- `SMTP_FROM`: Sender name and email

### Vercel Build Configuration

**vercel.json** (updated structure):

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist/public",
  "installCommand": "npm install",
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
    },
    {
      "source": "/(.*)\\.{js,css,woff2,png,jpg,jpeg,svg,webp,ico}",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
    }
  ],
  "rewrites": [
    { "source": "/assets/:path*", "destination": "/assets/:path*" },
    { "source": "/favicon.ico", "destination": "/favicon.ico" },
    { "source": "/api/:path*", "destination": "/api/[...path]" },
    { "source": "/:path*", "destination": "/index.html" }
  ],
  "functions": {
    "api/[...path].ts": {
      "maxDuration": 300,
      "memory": 1024
    }
  }
}
```

## Verification Checklist

### Pre-Deployment

- [ ] Local build succeeds: `npm run build`
- [ ] TypeScript check passes: `npm run check`
- [ ] All environment variables set in `.env` (local) or Vercel dashboard
- [ ] Database migrations applied: `npm run db:push`
- [ ] Supabase Storage bucket created with public access for downloads

### Post-Deployment (Production)

**Frontend**:
- [ ] Navigate to `/` → SPA loads without errors
- [ ] Navigate to `/auth` → Login form renders
- [ ] Open DevTools → No 404 errors for assets

**Authentication Flow**:
- [ ] Register new user → Success message shows
- [ ] Check email → Verification link received
- [ ] Click verification link → Redirects to app
- [ ] Navigate to `/api/user` → Returns JSON profile (not 401)
- [ ] Check Supabase dashboard → User exists in Auth
- [ ] Check database → User row exists in `public.users` table

**File Upload Flow**:
- [ ] Login as curator
- [ ] Create new course → Upload PDF file
- [ ] Submit → Upload succeeds (no errors)
- [ ] Check Supabase Storage → File appears in bucket
- [ ] Check database → Row in `knowledge_sources` table
- [ ] Navigate to course → File listed in Resources

**Course Generation Flow**:
- [ ] Create course with S size → Generates exactly 12 questions (MCQ + Open only)
- [ ] Create course with M size → Generates exactly 24 questions (MCQ + Open only)
- [ ] Create course with L size → Generates exactly 36 questions (MCQ + Open only)
- [ ] Zero roleplay steps in generated courses
- [ ] Question type distribution: approximately 60% MCQ, 40% Open
- [ ] Generation completes in < 5 minutes
- [ ] No server errors in Vercel logs

**API Endpoints**:
- [ ] `GET /api/health` → Returns 200 with service status
- [ ] `GET /api/user` → Returns profile for authenticated user
- [ ] `POST /api/tracks/generate` → Accepts file upload, returns track
- [ ] `GET /api/tracks` → Returns curator's tracks
- [ ] No "Unexpected token" JSON parse errors in browser console

## Monitoring & Rollback

### Production Metrics to Track

**Vercel Dashboard**:
- Function invocation errors (should be < 1%)
- Function execution duration (should be < 3 minutes for generation)
- Static asset 404 rate (should be 0%)

**Database Metrics** (Supabase):
- Active connections (should stay under limit)
- Failed queries (auth trigger failures)

**Application Metrics**:
- User registration → profile creation success rate (target: 100%)
- Course generation success rate (target: > 95%)
- File upload success rate (target: > 99%)

### Rollback Strategy

**If deployment breaks production**:

1. **Immediate**: Revert Vercel deployment to previous stable version
   - Vercel Dashboard → Deployments → Find last working deployment → "Promote to Production"

2. **Database**: No destructive schema changes in this design; safe to keep DB state

3. **Supabase**: If trigger causes issues, disable trigger:
   ```sql
   ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created;
   ```
   Fall back to middleware-only profile creation

4. **Communication**: Notify users via status page if downtime > 5 minutes

## Success Criteria

**Deployment succeeds** when:

1. Vercel build completes without TypeScript errors
2. Production health check returns `{ ok: true }` with all services enabled
3. 10 test users can complete full flow: register → verify → login → create course → upload file → generate
4. Zero "Не удалось загрузить профиль" errors in logs over 24 hours
5. Course generation produces correct question count (12/24/36) with zero roleplay steps in 100% of test cases
6. No ENOENT, ERR_MODULE_NOT_FOUND, or "Unexpected token" errors in production logs

**Acceptance threshold**: All 6 criteria met for 48 hours post-deployment.
### Current State Issues

1. **Frontend serving failure**: "Visit" button causes white screen or file download instead of serving SPA
2. **API route failures**: 401/404 errors on `/api/user`, `/api/tracks/generate` 
3. **JSON parsing errors**: Frontend receives HTML instead of JSON ("Unexpected token 'T'...")
4. **Module resolution errors**: `ERR_MODULE_NOT_FOUND` when importing `server/app` from `api/[...path]`
5. **File system errors**: `ENOENT: open './test/data/05-versions-space.pdf'` in production
6. **Profile synchronization**: User exists in Supabase Auth but missing from `public.users` table
7. **Course generation issues**: Generates 112 questions instead of 12/24/36; slow generation
8. **TypeScript errors**: Build failures due to type mismatches in auth middleware

### Environment Context

- **Frontend**: Vite + React + Wouter + shadcn/ui
- **Backend**: Node.js + Express + Drizzle ORM + PostgreSQL
- **Authentication**: Dual-mode (Supabase Auth for JWT + Passport for session fallback)
- **Storage**: Supabase Storage for persistent files + PostgreSQL for metadata
- **AI**: Yandex Cloud for course generation
- **Deployment**: Vercel serverless functions + static hosting

## Root Cause Analysis

### 1. Serverless Architecture Mismatch

**Problem**: Current setup imports Express app from `server/app.ts` into `api/[...path].ts`, causing module resolution issues in Vercel's bundler.

**Root Cause**: Vercel serverless functions bundle dependencies differently than local Node.js. The ESM import path resolution (`import.meta.dirname`) and relative imports fail when executed in the serverless context.

**Evidence**:
- `api/[...path].ts` lines 20-45 attempt dynamic import with fallback logic
- `vercel.json` includes `"includeFiles": "api/server-app.cjs"` but file may not be in correct location post-build
- Build script copies bundle to `api/server-app.cjs` but timing/path issues persist

### 2. Static vs API Route Conflicts

**Problem**: Vercel routing configuration doesn't properly separate static assets from API requests.

**Root Cause**: Current `vercel.json` rewrites at lines 44-46:
```
{ "source": "/api/:path*", "destination": "/api/[...path]" }
{ "source": "/((?!api/).*)", "destination": "/index.html" }
```

This regex doesn't account for static assets (`/assets/*`, `/favicon.*`) being caught by the API handler or vice versa.

**Evidence**: Reports of "white screen" and "download file" behavior suggest incorrect Content-Type headers or routing.

### 3. Authentication Flow Fragmentation

**Problem**: Three authentication mechanisms (Supabase JWT, Passport session, email verification) operate independently without guaranteed synchronization.

**Root Cause**: 
- `server/middleware/auth-supabase.ts` creates profile on-demand (lines 98-155) but only if JWT token present
- Passport session (lines 294-307 in `server/auth.ts`) expects profile to exist
- Email verification callback doesn't guarantee profile creation before login

**Evidence**:
- Middleware at line 134-155 shows "lazy create" logic that only triggers on JWT request
- No database trigger to auto-create profile when Supabase Auth user created
- `/api/user` endpoint returns 401 if no `req.user` but doesn't attempt lazy creation

### 4. File Storage Strategy Gaps

**Problem**: Uploaded files aren't persisted to production-safe storage.

**Root Cause**:
- `server/routes.ts` lines 530-565 show Supabase Storage upload logic
- Fallback to base64 encoding in DB (line 554) for large files exceeds practical limits
- No verification that Supabase Storage is configured before accepting uploads
- Test file references (`./test/data/...pdf`) exist in code paths that execute in production

**Evidence**:
- Error message `ENOENT: open './test/data/05-versions-space.pdf'`
- Upload handler uses `multer.memoryStorage()` (line 22) which is correct, but downstream storage isn't guaranteed

### 5. Course Generation Scaling Issues

**Problem**: Legacy V1 generator produces excessive questions (112 instead of 12-36) and includes roleplay scenarios that should not be generated.

**Root Cause**:
- `generateTrackContent()` function (lines 143-305 in `server/routes.ts`) uses deterministic budget but LLM prompt allows AI to "expand"
- System prompt at line 188 doesn't enforce hard limit: `"РОВНО ${totalQuestions} элементов в 'steps'"`
- Roleplay type ("ai_role", "user_role", "scenario") is still included in generation despite being unsuitable for automated generation
- No token budget limiting input context size, causing AI to over-generate
- Validation logic (line 273) rejects undercount but only trims excess after 3 attempts

**Evidence**:
- Reported "112 questions from small document"
- V1 prompt passes up to 8000 chars of KB (line 195) with no outline/summary step
- Roleplay type present in budget calculation (line 159) and prompt (line 171)
- No chunking or content reduction strategy

## Solution Design

### Architecture: Vercel Serverless Optimization

#### Decision: Isolated API Handler Pattern

**Approach**: Consolidate Express app bundling and ensure Vercel function receives self-contained CJS module.

**Design**:

1. **Build-time Bundle Creation**
   - `script/build.ts` already creates `dist/server-app.cjs` (lines 68-81)
   - Ensure bundle includes all necessary dependencies (allowlist at lines 9-36)
   - Copy bundle to `api/server-app.cjs` during build (lines 99-102)

2. **Runtime Import Strategy**
   - `api/[...path].ts` imports bundle with environment-based path resolution
   - Production: `import('./server-app.cjs')` (relative to api folder)
   - Development: `import('../server/app')` (TypeScript source)
   - Add explicit error handling for missing bundle

3. **Routing Configuration**
   - Update `vercel.json` rewrites to explicit precedence:
     ```
     Static assets first: /assets/*, /favicon.*, /*.{js,css,woff2,png,jpg,svg}
     API routes second: /api/*
     SPA fallback last: /* -> /index.html
     ```

#### Benefits
- Eliminates ESM resolution issues in serverless environment
- Clear separation of concerns (static vs API)
- Predictable cold start behavior

#### Risks & Mitigations
- **Risk**: Bundle size increases cold start time
  - **Mitigation**: Allowlist keeps bundle minimal; Vercel 1024MB memory config adequate
- **Risk**: Build fails to copy bundle
  - **Mitigation**: Add verification step in build script; fail fast with clear error

### Authentication & Profile Synchronization

#### Decision: Multi-Layer Profile Guarantee

**Approach**: Ensure profile exists at multiple checkpoints, not just lazy creation.

**Design**:

1. **Database Trigger (Primary)**
   - Create PostgreSQL trigger on `auth.users` insert (via Supabase)
   - Auto-insert matching row into `public.users` with `auth_uid` reference
   - Extract metadata (name, role) from `raw_user_meta_data` JSONB
   - Handle conflicts with `ON CONFLICT (auth_uid) DO NOTHING`
   
   **Trigger Logic** (Conceptual):
   ```
   TRIGGER: on_auth_user_created
   FOR EACH ROW AFTER INSERT ON auth.users
   EXECUTE: insert_public_user_profile
   
   Function checks:
   - If public.users WHERE auth_uid = NEW.id exists -> skip
   - Else -> INSERT INTO public.users (
       auth_uid, email, name, role, email_verified, plan, created_courses_count
     ) VALUES (
       NEW.id, NEW.email, 
       NEW.raw_user_meta_data->>'name' OR split_part(NEW.email, '@', 1),
       NEW.raw_user_meta_data->>'role' OR 'employee',
       NEW.email_confirmed_at IS NOT NULL,
       'trial', 0
     ) ON CONFLICT (auth_uid) DO NOTHING
   ```

2. **Middleware Lazy Creation (Secondary)**
   - Keep existing logic in `server/middleware/auth-supabase.ts` lines 134-155
   - Add defensive check: if trigger failed for any reason, create profile
   - Log when lazy creation triggers (indicates trigger didn't fire)

3. **API Endpoint Defensive Creation (Tertiary)**
   - `/api/user` and `/api/me` endpoints check `req.user`
   - If authenticated (JWT valid) but no profile, create immediately
   - Return created profile, don't return 401

4. **Email Verification Sync**
   - Update `server/auth.ts` `/auth/callback` handler (lines 346-421)
   - After Supabase verifies email, ensure local DB `email_verified` updated
   - Already implemented at lines 394-400, verify idempotency

#### Benefits
- Eliminates "Не удалось загрузить профиль" errors
- Robust against race conditions (registration → email verify → login)
- Works even if Supabase webhook/trigger fails

#### Risks & Mitigations
- **Risk**: Duplicate profiles if multiple layers race
  - **Mitigation**: `UNIQUE(auth_uid)` constraint + `ON CONFLICT` clauses
- **Risk**: Trigger requires Supabase project access
  - **Mitigation**: Include SQL migration file in repo; document manual setup if needed

### File Upload & Storage Persistence

#### Decision: Supabase Storage Primary, DB Fallback

**Approach**: Enforce Supabase Storage for production; fail fast if unavailable.

**Design**:

1. **Storage Availability Check**
   - Add startup validation: if `DATABASE_FILE_STORAGE_URL` and `DATABASE_FILE_STORAGE_KEY` missing, log warning
   - In `/api/tracks/generate` handler (line 379), check `isStorageAvailable()` before accepting uploads
   - If unavailable in production, return 503 with clear message: "File storage not configured"

2. **Upload Flow**
   - Client uploads to `/api/tracks/generate` with `multipart/form-data`
   - Backend uses `multer.memoryStorage()` (already implemented, line 22)
   - For each file:
     - Extract text in memory (lines 103-140, no disk writes)
     - Upload buffer to Supabase Storage via `uploadFile()` (lines 539-545)
     - Store metadata in `knowledge_sources` table (lines 567-577)
     - If Supabase upload fails AND file < 5MB, fall back to base64 in DB (line 554)
     - If file > 5MB and Supabase fails, reject upload with error

3. **Storage Path Convention**
   - Bucket: `course-materials` (or configured bucket name)
   - Path: `courses/{courseId}/{uuid}-{sanitized_filename}`
   - Ensure RLS policies allow service role write access

4. **Eliminate Test File References**
   - Search codebase for `./test/data/`, `fixtures/`, hardcoded file paths
   - Replace with proper upload flow or remove if unused
   - Verify no module-level `fs.readFileSync()` calls in production code paths

#### Benefits
- Files persist across serverless function invocations
- Clear failure modes (503 if storage unavailable)
- No filesystem dependencies in Vercel environment

#### Risks & Mitigations
- **Risk**: Supabase Storage quota exceeded
  - **Mitigation**: Monitor usage; implement file size limits (already 50MB per line 24)
- **Risk**: Network timeout during large uploads
  - **Mitigation**: Request timeout set to 300s (line 428); Vercel maxDuration 300s (vercel.json line 50)

### Course Generation Optimization

#### Decision: Structured Outline → Targeted Generation (MCQ + Open Questions Only)

**Approach**: Two-phase LLM call to control output size and speed. **CRITICAL**: Remove roleplay scenario generation entirely.

**Design**:

1. **Question Type Restriction**
   - **Allowed types**: `mcq` (multiple choice), `open` (open-ended)
   - **Forbidden types**: `roleplay` (removed from all generation paths)
   - Update schema enum in `shared/schema.ts` steps table to only allow `["mcq", "open"]`
   - Remove roleplay from budget calculations, prompts, and validation logic
   
   **Rationale**: Roleplay scenarios with ai_role/user_role require manual curation and cannot be reliably auto-generated from knowledge base content. They introduce quality issues and generation complexity.

2. **Phase 1: Content Outline (Fast)**
   - Input: Course title + KB summary (first 3000 chars or adaptive chunk)
   - Prompt: "Create course outline with 3-5 topics, each with 1-2 subtopics"
   - Timeout: 30 seconds
   - Output: JSON structure with topic hierarchy
   
   **Outline Schema**:
   ```
   {
     topics: [
       { title: string, subtopics: string[], priority: 'high' | 'medium' }
     ]
   }
   ```

3. **Phase 2: Question Generation (Batched, MCQ + Open Only)**
   - Determine batch size based on course size:
     - S (12 questions): 2 batches of 6
     - M (24 questions): 3 batches of 8
     - L (36 questions): 4 batches of 9
   - Question distribution per batch:
     - 60% MCQ (multiple choice with 4 options)
     - 40% Open (open-ended with rubric)
   - For each batch:
     - Select topics from outline proportionally
     - Prompt: "Generate EXACTLY {batch_size} questions from these topics: {topic_subset}. Types: {mcq_count} MCQ, {open_count} Open. NO roleplay scenarios."
     - Include strict JSON schema with question count validator
     - Timeout: 60 seconds per batch
   - Merge batches, validate total count

4. **Budget Enforcement**
   - Hard limits in prompts: "You MUST generate EXACTLY {N} questions. No more, no less."
   - Type restriction: "ONLY mcq and open types. NEVER generate roleplay."
   - Zod validation: reject response if `steps.length !== expected` OR if any step has `type === 'roleplay'`
   - Retry logic: if count mismatch or forbidden type found, regenerate THAT batch only (max 2 retries per batch)
   - Final safeguard: if total > target, trim; if total < target, pad with simple MCQ from outline

5. **Content Summarization**
   - Before Phase 1, if KB > 10,000 chars, run extractive summary:
     - Split into semantic chunks (paragraphs)
     - Score chunks by keyword density (course title terms)
     - Take top 50% by score, concatenate
     - Pass summarized KB to outline generation
   
   **Implementation** (server/ai/parsers.ts or new module):
   - Function `summarizeKnowledgeBase(text: string, title: string, maxChars: number)`
   - Uses simple TF-IDF or keyword matching (no extra LLM call)

#### Benefits
- Deterministic question count (12/24/36)
- Faster generation (parallel batches + smaller prompts)
- Reduced token costs
- **Higher quality**: No auto-generated roleplay scenarios with inconsistent quality
- **Simpler maintenance**: Only 2 question types instead of 3

#### Risks & Mitigations
- **Risk**: Users expect roleplay scenarios
  - **Mitigation**: Document this as a manual curation feature; provide UI to add roleplay steps manually after course creation
- **Risk**: Batching adds complexity
  - **Mitigation**: Existing V2 generator (lines 590-702) already implements batching; refine prompts
- **Risk**: Two-phase increases total latency
  - **Mitigation**: Outline generation is fast (<30s); overall time still under 5 minutes (Vercel limit)

### TypeScript Compilation Fixes

#### Decision: Fix Type Definitions, Don't Circumvent

**Approach**: Address each compilation error directly.

**Design**:

1. **Auth Middleware Type Issues** (server/middleware/auth-supabase.ts)
   
   **Problem** (lines 8-21): `AuthUser` interface defines `emailConfirmed`, but `User` type from schema has `emailVerified`.
   
   **Fix**:
   - Update `hasAuthUser()` type predicate to check correct property
   - Ensure `req.user` can be either `AuthUser` (Supabase JWT) or `User` (Passport session)
   - Use union type for `req.user`: `AuthUser | User`
   - Helper function `isEmailVerified(user: AuthUser | User)` that checks both properties

2. **Drizzle Alias Issues** (reported but not in visible code)
   
   **Context**: `.as("count")` alias errors suggest Drizzle version mismatch or incorrect import.
   
   **Fix**:
   - Verify Drizzle version: `drizzle-orm@^0.39.3` in package.json (line 59)
   - Check if query uses `sql<number>` generic (example at line 162 in storage.ts)
   - Ensure `count(...)` import from `drizzle-orm` (line 8 in storage.ts)
   - If error persists, cast result explicitly: `sql<number>\`COUNT(...)\`::int\``

3. **Express Request Extension**
   
   **Problem**: Adding `req.user` with different types causes conflicts.
   
   **Fix**:
   - Define global augmentation in `server/types.ts`:
     ```
     declare global {
       namespace Express {
         interface User extends Partial<AuthUser & import('@shared/schema').User> {}
         interface Request {
           user?: User;
         }
       }
     }
     ```
   - Update tsconfig.json to include server/types.ts

#### Benefits
- Clean TypeScript build (`npm run check` passes)
- Better IDE autocomplete
- Catch bugs at compile time

#### Risks & Mitigations
- **Risk**: Type changes break existing code
  - **Mitigation**: Test locally before deploying; use type guards in route handlers

## Implementation Plan

### Phase 1: Infrastructure & Routing (Priority: P0)

**Goal**: Fix Vercel deployment basics (static serving, API routing)

**Tasks**:

1. Update `vercel.json` rewrites to explicit precedence order
2. Verify `script/build.ts` bundle copy succeeds (add console.log)
3. Update `api/[...path].ts` import logic with better error handling
4. Test deployment to Vercel preview environment
5. Verify `/` loads SPA, `/api/health` returns JSON

**Acceptance**:
- [ ] SPA loads at root path without white screen
- [ ] `/api/health` returns JSON (not HTML)
- [ ] Static assets load with correct Content-Type headers
- [ ] No 404 on `/assets/*` resources

### Phase 2: Authentication & Profile Sync (Priority: P0)

**Goal**: Ensure user profile exists after registration/login

**Tasks**:

1. Create SQL migration for Supabase auth → users trigger
2. Update `server/middleware/auth-supabase.ts` to handle both user types
3. Add defensive profile creation to `/api/user` endpoint
4. Test registration → email verify → login flow
5. Verify profile appears in `public.users` table

**Acceptance**:
- [ ] After registration, user row exists in `public.users`
- [ ] After email verification, `email_verified = true` in DB
- [ ] `/api/user` returns profile JSON (not 401) for authenticated users
- [ ] No "Не удалось загрузить профиль" errors

### Phase 3: File Upload & Storage (Priority: P1)

**Goal**: Uploaded files persist to Supabase Storage

**Tasks**:

1. Add storage availability check to health endpoint
2. Update upload handler to fail fast if storage unavailable
3. Create Supabase Storage bucket with proper RLS policies
4. Remove all test file references from production code
5. Test file upload → parse → retrieve flow

**Acceptance**:
- [ ] Files upload to Supabase Storage (visible in dashboard)
- [ ] Metadata saved in `knowledge_sources` table
- [ ] No `ENOENT` errors in production logs
- [ ] Files remain accessible after serverless function cold start

### Phase 4: Course Generation (Priority: P1)

**Goal**: Generate exactly 12/24/36 questions quickly (MCQ + Open only, no roleplay)

**Tasks**:

1. Update `shared/schema.ts` steps table type enum to `["mcq", "open"]` (remove `"roleplay"`)
2. Remove roleplay from budget calculations in `server/ai/parsers.ts`
3. Update V1 and V2 generator prompts to exclude roleplay scenarios
4. Add Zod validation to reject roleplay type if returned by LLM
5. Implement content summarization function
6. Refactor V1 generator to two-phase (outline → questions)
7. Update V2 generator batch prompts with strict count enforcement
8. Test with small/medium/large documents

**Acceptance**:
- [ ] S course generates exactly 12 questions (MCQ + Open only)
- [ ] M course generates exactly 24 questions (MCQ + Open only)
- [ ] L course generates exactly 36 questions (MCQ + Open only)
- [ ] Zero roleplay steps generated in all test runs
- [ ] Generation completes in < 3 minutes for typical content
- [ ] No questions exceed 15 words (brevity requirement)
- [ ] Question distribution: ~60% MCQ, ~40% Open

### Phase 5: TypeScript & Build (Priority: P2)

**Goal**: Clean TypeScript compilation

**Tasks**:

1. Fix `AuthUser` vs `User` type conflicts
2. Add global Express type augmentation
3. Fix Drizzle alias issues
4. Run `npm run check` until zero errors
5. Enable TypeScript strict mode checks in CI

**Acceptance**:
- [ ] `npm run check` exits with code 0
- [ ] No `@ts-ignore` or `@ts-expect-error` in new code
- [ ] Vercel build succeeds without TypeScript warnings

## Environment Configuration

### Required Variables (Vercel Production)

**Database**:
- `DATABASE_URL`: PostgreSQL connection string (Supabase)

**Supabase**:
- `DATABASE_FILE_STORAGE_URL`: `https://{project-ref}.supabase.co`
- `DATABASE_FILE_STORAGE_KEY`: Service role key (for server-side storage bypass RLS)
- `SUPABASE_ANON_KEY`: Anon key (for JWT validation)

**Frontend (build-time)**:
- `VITE_SUPABASE_URL`: Same as `DATABASE_FILE_STORAGE_URL`
- `VITE_SUPABASE_ANON_KEY`: Same as `SUPABASE_ANON_KEY`

**Session**:
- `SESSION_SECRET`: 32+ character random string (generate with `openssl rand -base64 32`)
- `COOKIE_SECURE`: `true` (HTTPS required)

**Application**:
- `APP_URL`: Production domain (e.g., `https://adapt-ai.vercel.app`)
- `NODE_ENV`: `production` (auto-set by Vercel)

**AI**:
- `YANDEX_CLOUD_API_KEY`: Yandex API key
- `YANDEX_CLOUD_PROJECT_FOLDER_ID`: Yandex folder ID
- `YANDEX_PROMPT_ID`: Prompt template ID
- `YANDEX_TIMEOUT_MS`: `90000` (90 seconds)

**Email**:
- `SMTP_HOST`: `smtp.yandex.ru`
- `SMTP_PORT`: `465`
- `SMTP_USER`: Email address
- `SMTP_PASSWORD`: App-specific password
- `SMTP_FROM`: Sender name and email

### Vercel Build Configuration

**vercel.json** (updated structure):

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist/public",
  "installCommand": "npm install",
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
    },
    {
      "source": "/(.*)\\.{js,css,woff2,png,jpg,jpeg,svg,webp,ico}",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
    }
  ],
  "rewrites": [
    { "source": "/assets/:path*", "destination": "/assets/:path*" },
    { "source": "/favicon.ico", "destination": "/favicon.ico" },
    { "source": "/api/:path*", "destination": "/api/[...path]" },
    { "source": "/:path*", "destination": "/index.html" }
  ],
  "functions": {
    "api/[...path].ts": {
      "maxDuration": 300,
      "memory": 1024
    }
  }
}
```

## Verification Checklist

### Pre-Deployment

- [ ] Local build succeeds: `npm run build`
- [ ] TypeScript check passes: `npm run check`
- [ ] All environment variables set in `.env` (local) or Vercel dashboard
- [ ] Database migrations applied: `npm run db:push`
- [ ] Supabase Storage bucket created with public access for downloads

### Post-Deployment (Production)

**Frontend**:
- [ ] Navigate to `/` → SPA loads without errors
- [ ] Navigate to `/auth` → Login form renders
- [ ] Open DevTools → No 404 errors for assets

**Authentication Flow**:
- [ ] Register new user → Success message shows
- [ ] Check email → Verification link received
- [ ] Click verification link → Redirects to app
- [ ] Navigate to `/api/user` → Returns JSON profile (not 401)
- [ ] Check Supabase dashboard → User exists in Auth
- [ ] Check database → User row exists in `public.users` table

**File Upload Flow**:
- [ ] Login as curator
- [ ] Create new course → Upload PDF file
- [ ] Submit → Upload succeeds (no errors)
- [ ] Check Supabase Storage → File appears in bucket
- [ ] Check database → Row in `knowledge_sources` table
- [ ] Navigate to course → File listed in Resources

**Course Generation Flow**:
- [ ] Create course with S size → Generates exactly 12 questions (MCQ + Open only)
- [ ] Create course with M size → Generates exactly 24 questions (MCQ + Open only)
- [ ] Create course with L size → Generates exactly 36 questions (MCQ + Open only)
- [ ] Zero roleplay steps in generated courses
- [ ] Question type distribution: approximately 60% MCQ, 40% Open
- [ ] Generation completes in < 5 minutes
- [ ] No server errors in Vercel logs

**API Endpoints**:
- [ ] `GET /api/health` → Returns 200 with service status
- [ ] `GET /api/user` → Returns profile for authenticated user
- [ ] `POST /api/tracks/generate` → Accepts file upload, returns track
- [ ] `GET /api/tracks` → Returns curator's tracks
- [ ] No "Unexpected token" JSON parse errors in browser console

## Monitoring & Rollback

### Production Metrics to Track

**Vercel Dashboard**:
- Function invocation errors (should be < 1%)
- Function execution duration (should be < 3 minutes for generation)
- Static asset 404 rate (should be 0%)

**Database Metrics** (Supabase):
- Active connections (should stay under limit)
- Failed queries (auth trigger failures)

**Application Metrics**:
- User registration → profile creation success rate (target: 100%)
- Course generation success rate (target: > 95%)
- File upload success rate (target: > 99%)

### Rollback Strategy

**If deployment breaks production**:

1. **Immediate**: Revert Vercel deployment to previous stable version
   - Vercel Dashboard → Deployments → Find last working deployment → "Promote to Production"

2. **Database**: No destructive schema changes in this design; safe to keep DB state

3. **Supabase**: If trigger causes issues, disable trigger:
   ```sql
   ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created;
   ```
   Fall back to middleware-only profile creation

4. **Communication**: Notify users via status page if downtime > 5 minutes

## Success Criteria

**Deployment succeeds** when:

1. Vercel build completes without TypeScript errors
2. Production health check returns `{ ok: true }` with all services enabled
3. 10 test users can complete full flow: register → verify → login → create course → upload file → generate
4. Zero "Не удалось загрузить профиль" errors in logs over 24 hours
5. Course generation produces correct question count (12/24/36) with zero roleplay steps in 100% of test cases
6. No ENOENT, ERR_MODULE_NOT_FOUND, or "Unexpected token" errors in production logs

**Acceptance threshold**: All 6 criteria met for 48 hours post-deployment.
### Current State Issues

1. **Frontend serving failure**: "Visit" button causes white screen or file download instead of serving SPA
2. **API route failures**: 401/404 errors on `/api/user`, `/api/tracks/generate` 
3. **JSON parsing errors**: Frontend receives HTML instead of JSON ("Unexpected token 'T'...")
4. **Module resolution errors**: `ERR_MODULE_NOT_FOUND` when importing `server/app` from `api/[...path]`
5. **File system errors**: `ENOENT: open './test/data/05-versions-space.pdf'` in production
6. **Profile synchronization**: User exists in Supabase Auth but missing from `public.users` table
7. **Course generation issues**: Generates 112 questions instead of 12/24/36; slow generation
8. **TypeScript errors**: Build failures due to type mismatches in auth middleware

### Environment Context

- **Frontend**: Vite + React + Wouter + shadcn/ui
- **Backend**: Node.js + Express + Drizzle ORM + PostgreSQL
- **Authentication**: Dual-mode (Supabase Auth for JWT + Passport for session fallback)
- **Storage**: Supabase Storage for persistent files + PostgreSQL for metadata
- **AI**: Yandex Cloud for course generation
- **Deployment**: Vercel serverless functions + static hosting

## Root Cause Analysis

### 1. Serverless Architecture Mismatch

**Problem**: Current setup imports Express app from `server/app.ts` into `api/[...path].ts`, causing module resolution issues in Vercel's bundler.

**Root Cause**: Vercel serverless functions bundle dependencies differently than local Node.js. The ESM import path resolution (`import.meta.dirname`) and relative imports fail when executed in the serverless context.

**Evidence**:
- `api/[...path].ts` lines 20-45 attempt dynamic import with fallback logic
- `vercel.json` includes `"includeFiles": "api/server-app.cjs"` but file may not be in correct location post-build
- Build script copies bundle to `api/server-app.cjs` but timing/path issues persist

### 2. Static vs API Route Conflicts

**Problem**: Vercel routing configuration doesn't properly separate static assets from API requests.

**Root Cause**: Current `vercel.json` rewrites at lines 44-46:
```
{ "source": "/api/:path*", "destination": "/api/[...path]" }
{ "source": "/((?!api/).*)", "destination": "/index.html" }
```

This regex doesn't account for static assets (`/assets/*`, `/favicon.*`) being caught by the API handler or vice versa.

**Evidence**: Reports of "white screen" and "download file" behavior suggest incorrect Content-Type headers or routing.

### 3. Authentication Flow Fragmentation

**Problem**: Three authentication mechanisms (Supabase JWT, Passport session, email verification) operate independently without guaranteed synchronization.

**Root Cause**: 
- `server/middleware/auth-supabase.ts` creates profile on-demand (lines 98-155) but only if JWT token present
- Passport session (lines 294-307 in `server/auth.ts`) expects profile to exist
- Email verification callback doesn't guarantee profile creation before login

**Evidence**:
- Middleware at line 134-155 shows "lazy create" logic that only triggers on JWT request
- No database trigger to auto-create profile when Supabase Auth user created
- `/api/user` endpoint returns 401 if no `req.user` but doesn't attempt lazy creation

### 4. File Storage Strategy Gaps

**Problem**: Uploaded files aren't persisted to production-safe storage.

**Root Cause**:
- `server/routes.ts` lines 530-565 show Supabase Storage upload logic
- Fallback to base64 encoding in DB (line 554) for large files exceeds practical limits
- No verification that Supabase Storage is configured before accepting uploads
- Test file references (`./test/data/...pdf`) exist in code paths that execute in production

**Evidence**:
- Error message `ENOENT: open './test/data/05-versions-space.pdf'`
- Upload handler uses `multer.memoryStorage()` (line 22) which is correct, but downstream storage isn't guaranteed

### 5. Course Generation Scaling Issues

**Problem**: Legacy V1 generator produces excessive questions (112 instead of 12-36) and includes roleplay scenarios that should not be generated.

**Root Cause**:
- `generateTrackContent()` function (lines 143-305 in `server/routes.ts`) uses deterministic budget but LLM prompt allows AI to "expand"
- System prompt at line 188 doesn't enforce hard limit: `"РОВНО ${totalQuestions} элементов в 'steps'"`
- Roleplay type ("ai_role", "user_role", "scenario") is still included in generation despite being unsuitable for automated generation
- No token budget limiting input context size, causing AI to over-generate
- Validation logic (line 273) rejects undercount but only trims excess after 3 attempts

**Evidence**:
- Reported "112 questions from small document"
- V1 prompt passes up to 8000 chars of KB (line 195) with no outline/summary step
- Roleplay type present in budget calculation (line 159) and prompt (line 171)
- No chunking or content reduction strategy

## Solution Design

### Architecture: Vercel Serverless Optimization

#### Decision: Isolated API Handler Pattern

**Approach**: Consolidate Express app bundling and ensure Vercel function receives self-contained CJS module.

**Design**:

1. **Build-time Bundle Creation**
   - `script/build.ts` already creates `dist/server-app.cjs` (lines 68-81)
   - Ensure bundle includes all necessary dependencies (allowlist at lines 9-36)
   - Copy bundle to `api/server-app.cjs` during build (lines 99-102)

2. **Runtime Import Strategy**
   - `api/[...path].ts` imports bundle with environment-based path resolution
   - Production: `import('./server-app.cjs')` (relative to api folder)
   - Development: `import('../server/app')` (TypeScript source)
   - Add explicit error handling for missing bundle

3. **Routing Configuration**
   - Update `vercel.json` rewrites to explicit precedence:
     ```
     Static assets first: /assets/*, /favicon.*, /*.{js,css,woff2,png,jpg,svg}
     API routes second: /api/*
     SPA fallback last: /* -> /index.html
     ```

#### Benefits
- Eliminates ESM resolution issues in serverless environment
- Clear separation of concerns (static vs API)
- Predictable cold start behavior

#### Risks & Mitigations
- **Risk**: Bundle size increases cold start time
  - **Mitigation**: Allowlist keeps bundle minimal; Vercel 1024MB memory config adequate
- **Risk**: Build fails to copy bundle
  - **Mitigation**: Add verification step in build script; fail fast with clear error

### Authentication & Profile Synchronization

#### Decision: Multi-Layer Profile Guarantee

**Approach**: Ensure profile exists at multiple checkpoints, not just lazy creation.

**Design**:

1. **Database Trigger (Primary)**
   - Create PostgreSQL trigger on `auth.users` insert (via Supabase)
   - Auto-insert matching row into `public.users` with `auth_uid` reference
   - Extract metadata (name, role) from `raw_user_meta_data` JSONB
   - Handle conflicts with `ON CONFLICT (auth_uid) DO NOTHING`
   
   **Trigger Logic** (Conceptual):
   ```
   TRIGGER: on_auth_user_created
   FOR EACH ROW AFTER INSERT ON auth.users
   EXECUTE: insert_public_user_profile
   
   Function checks:
   - If public.users WHERE auth_uid = NEW.id exists -> skip
   - Else -> INSERT INTO public.users (
       auth_uid, email, name, role, email_verified, plan, created_courses_count
     ) VALUES (
       NEW.id, NEW.email, 
       NEW.raw_user_meta_data->>'name' OR split_part(NEW.email, '@', 1),
       NEW.raw_user_meta_data->>'role' OR 'employee',
       NEW.email_confirmed_at IS NOT NULL,
       'trial', 0
     ) ON CONFLICT (auth_uid) DO NOTHING
   ```

2. **Middleware Lazy Creation (Secondary)**
   - Keep existing logic in `server/middleware/auth-supabase.ts` lines 134-155
   - Add defensive check: if trigger failed for any reason, create profile
   - Log when lazy creation triggers (indicates trigger didn't fire)

3. **API Endpoint Defensive Creation (Tertiary)**
   - `/api/user` and `/api/me` endpoints check `req.user`
   - If authenticated (JWT valid) but no profile, create immediately
   - Return created profile, don't return 401

4. **Email Verification Sync**
   - Update `server/auth.ts` `/auth/callback` handler (lines 346-421)
   - After Supabase verifies email, ensure local DB `email_verified` updated
   - Already implemented at lines 394-400, verify idempotency

#### Benefits
- Eliminates "Не удалось загрузить профиль" errors
- Robust against race conditions (registration → email verify → login)
- Works even if Supabase webhook/trigger fails

#### Risks & Mitigations
- **Risk**: Duplicate profiles if multiple layers race
  - **Mitigation**: `UNIQUE(auth_uid)` constraint + `ON CONFLICT` clauses
- **Risk**: Trigger requires Supabase project access
  - **Mitigation**: Include SQL migration file in repo; document manual setup if needed

### File Upload & Storage Persistence

#### Decision: Supabase Storage Primary, DB Fallback

**Approach**: Enforce Supabase Storage for production; fail fast if unavailable.

**Design**:

1. **Storage Availability Check**
   - Add startup validation: if `DATABASE_FILE_STORAGE_URL` and `DATABASE_FILE_STORAGE_KEY` missing, log warning
   - In `/api/tracks/generate` handler (line 379), check `isStorageAvailable()` before accepting uploads
   - If unavailable in production, return 503 with clear message: "File storage not configured"

2. **Upload Flow**
   - Client uploads to `/api/tracks/generate` with `multipart/form-data`
   - Backend uses `multer.memoryStorage()` (already implemented, line 22)
   - For each file:
     - Extract text in memory (lines 103-140, no disk writes)
     - Upload buffer to Supabase Storage via `uploadFile()` (lines 539-545)
     - Store metadata in `knowledge_sources` table (lines 567-577)
     - If Supabase upload fails AND file < 5MB, fall back to base64 in DB (line 554)
     - If file > 5MB and Supabase fails, reject upload with error

3. **Storage Path Convention**
   - Bucket: `course-materials` (or configured bucket name)
   - Path: `courses/{courseId}/{uuid}-{sanitized_filename}`
   - Ensure RLS policies allow service role write access

4. **Eliminate Test File References**
   - Search codebase for `./test/data/`, `fixtures/`, hardcoded file paths
   - Replace with proper upload flow or remove if unused
   - Verify no module-level `fs.readFileSync()` calls in production code paths

#### Benefits
- Files persist across serverless function invocations
- Clear failure modes (503 if storage unavailable)
- No filesystem dependencies in Vercel environment

#### Risks & Mitigations
- **Risk**: Supabase Storage quota exceeded
  - **Mitigation**: Monitor usage; implement file size limits (already 50MB per line 24)
- **Risk**: Network timeout during large uploads
  - **Mitigation**: Request timeout set to 300s (line 428); Vercel maxDuration 300s (vercel.json line 50)

### Course Generation Optimization

#### Decision: Structured Outline → Targeted Generation (MCQ + Open Questions Only)

**Approach**: Two-phase LLM call to control output size and speed. **CRITICAL**: Remove roleplay scenario generation entirely.

**Design**:

1. **Question Type Restriction**
   - **Allowed types**: `mcq` (multiple choice), `open` (open-ended)
   - **Forbidden types**: `roleplay` (removed from all generation paths)
   - Update schema enum in `shared/schema.ts` steps table to only allow `["mcq", "open"]`
   - Remove roleplay from budget calculations, prompts, and validation logic
   
   **Rationale**: Roleplay scenarios with ai_role/user_role require manual curation and cannot be reliably auto-generated from knowledge base content. They introduce quality issues and generation complexity.

2. **Phase 1: Content Outline (Fast)**
   - Input: Course title + KB summary (first 3000 chars or adaptive chunk)
   - Prompt: "Create course outline with 3-5 topics, each with 1-2 subtopics"
   - Timeout: 30 seconds
   - Output: JSON structure with topic hierarchy
   
   **Outline Schema**:
   ```
   {
     topics: [
       { title: string, subtopics: string[], priority: 'high' | 'medium' }
     ]
   }
   ```

3. **Phase 2: Question Generation (Batched, MCQ + Open Only)**
   - Determine batch size based on course size:
     - S (12 questions): 2 batches of 6
     - M (24 questions): 3 batches of 8
     - L (36 questions): 4 batches of 9
   - Question distribution per batch:
     - 60% MCQ (multiple choice with 4 options)
     - 40% Open (open-ended with rubric)
   - For each batch:
     - Select topics from outline proportionally
     - Prompt: "Generate EXACTLY {batch_size} questions from these topics: {topic_subset}. Types: {mcq_count} MCQ, {open_count} Open. NO roleplay scenarios."
     - Include strict JSON schema with question count validator
     - Timeout: 60 seconds per batch
   - Merge batches, validate total count

4. **Budget Enforcement**
   - Hard limits in prompts: "You MUST generate EXACTLY {N} questions. No more, no less."
   - Type restriction: "ONLY mcq and open types. NEVER generate roleplay."
   - Zod validation: reject response if `steps.length !== expected` OR if any step has `type === 'roleplay'`
   - Retry logic: if count mismatch or forbidden type found, regenerate THAT batch only (max 2 retries per batch)
   - Final safeguard: if total > target, trim; if total < target, pad with simple MCQ from outline

5. **Content Summarization**
   - Before Phase 1, if KB > 10,000 chars, run extractive summary:
     - Split into semantic chunks (paragraphs)
     - Score chunks by keyword density (course title terms)
     - Take top 50% by score, concatenate
     - Pass summarized KB to outline generation
   
   **Implementation** (server/ai/parsers.ts or new module):
   - Function `summarizeKnowledgeBase(text: string, title: string, maxChars: number)`
   - Uses simple TF-IDF or keyword matching (no extra LLM call)

#### Benefits
- Deterministic question count (12/24/36)
- Faster generation (parallel batches + smaller prompts)
- Reduced token costs
- **Higher quality**: No auto-generated roleplay scenarios with inconsistent quality
- **Simpler maintenance**: Only 2 question types instead of 3

#### Risks & Mitigations
- **Risk**: Users expect roleplay scenarios
  - **Mitigation**: Document this as a manual curation feature; provide UI to add roleplay steps manually after course creation
- **Risk**: Batching adds complexity
  - **Mitigation**: Existing V2 generator (lines 590-702) already implements batching; refine prompts
- **Risk**: Two-phase increases total latency
  - **Mitigation**: Outline generation is fast (<30s); overall time still under 5 minutes (Vercel limit)

### TypeScript Compilation Fixes

#### Decision: Fix Type Definitions, Don't Circumvent

**Approach**: Address each compilation error directly.

**Design**:

1. **Auth Middleware Type Issues** (server/middleware/auth-supabase.ts)
   
   **Problem** (lines 8-21): `AuthUser` interface defines `emailConfirmed`, but `User` type from schema has `emailVerified`.
   
   **Fix**:
   - Update `hasAuthUser()` type predicate to check correct property
   - Ensure `req.user` can be either `AuthUser` (Supabase JWT) or `User` (Passport session)
   - Use union type for `req.user`: `AuthUser | User`
   - Helper function `isEmailVerified(user: AuthUser | User)` that checks both properties

2. **Drizzle Alias Issues** (reported but not in visible code)
   
   **Context**: `.as("count")` alias errors suggest Drizzle version mismatch or incorrect import.
   
   **Fix**:
   - Verify Drizzle version: `drizzle-orm@^0.39.3` in package.json (line 59)
   - Check if query uses `sql<number>` generic (example at line 162 in storage.ts)
   - Ensure `count(...)` import from `drizzle-orm` (line 8 in storage.ts)
   - If error persists, cast result explicitly: `sql<number>\`COUNT(...)\`::int\``

3. **Express Request Extension**
   
   **Problem**: Adding `req.user` with different types causes conflicts.
   
   **Fix**:
   - Define global augmentation in `server/types.ts`:
     ```
     declare global {
       namespace Express {
         interface User extends Partial<AuthUser & import('@shared/schema').User> {}
         interface Request {
           user?: User;
         }
       }
     }
     ```
   - Update tsconfig.json to include server/types.ts

#### Benefits
- Clean TypeScript build (`npm run check` passes)
- Better IDE autocomplete
- Catch bugs at compile time

#### Risks & Mitigations
- **Risk**: Type changes break existing code
  - **Mitigation**: Test locally before deploying; use type guards in route handlers

## Implementation Plan

### Phase 1: Infrastructure & Routing (Priority: P0)

**Goal**: Fix Vercel deployment basics (static serving, API routing)

**Tasks**:

1. Update `vercel.json` rewrites to explicit precedence order
2. Verify `script/build.ts` bundle copy succeeds (add console.log)
3. Update `api/[...path].ts` import logic with better error handling
4. Test deployment to Vercel preview environment
5. Verify `/` loads SPA, `/api/health` returns JSON

**Acceptance**:
- [ ] SPA loads at root path without white screen
- [ ] `/api/health` returns JSON (not HTML)
- [ ] Static assets load with correct Content-Type headers
- [ ] No 404 on `/assets/*` resources

### Phase 2: Authentication & Profile Sync (Priority: P0)

**Goal**: Ensure user profile exists after registration/login

**Tasks**:

1. Create SQL migration for Supabase auth → users trigger
2. Update `server/middleware/auth-supabase.ts` to handle both user types
3. Add defensive profile creation to `/api/user` endpoint
4. Test registration → email verify → login flow
5. Verify profile appears in `public.users` table

**Acceptance**:
- [ ] After registration, user row exists in `public.users`
- [ ] After email verification, `email_verified = true` in DB
- [ ] `/api/user` returns profile JSON (not 401) for authenticated users
- [ ] No "Не удалось загрузить профиль" errors

### Phase 3: File Upload & Storage (Priority: P1)

**Goal**: Uploaded files persist to Supabase Storage

**Tasks**:

1. Add storage availability check to health endpoint
2. Update upload handler to fail fast if storage unavailable
3. Create Supabase Storage bucket with proper RLS policies
4. Remove all test file references from production code
5. Test file upload → parse → retrieve flow

**Acceptance**:
- [ ] Files upload to Supabase Storage (visible in dashboard)
- [ ] Metadata saved in `knowledge_sources` table
- [ ] No `ENOENT` errors in production logs
- [ ] Files remain accessible after serverless function cold start

### Phase 4: Course Generation (Priority: P1)

**Goal**: Generate exactly 12/24/36 questions quickly (MCQ + Open only, no roleplay)

**Tasks**:

1. Update `shared/schema.ts` steps table type enum to `["mcq", "open"]` (remove `"roleplay"`)
2. Remove roleplay from budget calculations in `server/ai/parsers.ts`
3. Update V1 and V2 generator prompts to exclude roleplay scenarios
4. Add Zod validation to reject roleplay type if returned by LLM
5. Implement content summarization function
6. Refactor V1 generator to two-phase (outline → questions)
7. Update V2 generator batch prompts with strict count enforcement
8. Test with small/medium/large documents

**Acceptance**:
- [ ] S course generates exactly 12 questions (MCQ + Open only)
- [ ] M course generates exactly 24 questions (MCQ + Open only)
- [ ] L course generates exactly 36 questions (MCQ + Open only)
- [ ] Zero roleplay steps generated in all test runs
- [ ] Generation completes in < 3 minutes for typical content
- [ ] No questions exceed 15 words (brevity requirement)
- [ ] Question distribution: ~60% MCQ, ~40% Open

### Phase 5: TypeScript & Build (Priority: P2)

**Goal**: Clean TypeScript compilation

**Tasks**:

1. Fix `AuthUser` vs `User` type conflicts
2. Add global Express type augmentation
3. Fix Drizzle alias issues
4. Run `npm run check` until zero errors
5. Enable TypeScript strict mode checks in CI

**Acceptance**:
- [ ] `npm run check` exits with code 0
- [ ] No `@ts-ignore` or `@ts-expect-error` in new code
- [ ] Vercel build succeeds without TypeScript warnings

## Environment Configuration

### Required Variables (Vercel Production)

**Database**:
- `DATABASE_URL`: PostgreSQL connection string (Supabase)

**Supabase**:
- `DATABASE_FILE_STORAGE_URL`: `https://{project-ref}.supabase.co`
- `DATABASE_FILE_STORAGE_KEY`: Service role key (for server-side storage bypass RLS)
- `SUPABASE_ANON_KEY`: Anon key (for JWT validation)

**Frontend (build-time)**:
- `VITE_SUPABASE_URL`: Same as `DATABASE_FILE_STORAGE_URL`
- `VITE_SUPABASE_ANON_KEY`: Same as `SUPABASE_ANON_KEY`

**Session**:
- `SESSION_SECRET`: 32+ character random string (generate with `openssl rand -base64 32`)
- `COOKIE_SECURE`: `true` (HTTPS required)

**Application**:
- `APP_URL`: Production domain (e.g., `https://adapt-ai.vercel.app`)
- `NODE_ENV`: `production` (auto-set by Vercel)

**AI**:
- `YANDEX_CLOUD_API_KEY`: Yandex API key
- `YANDEX_CLOUD_PROJECT_FOLDER_ID`: Yandex folder ID
- `YANDEX_PROMPT_ID`: Prompt template ID
- `YANDEX_TIMEOUT_MS`: `90000` (90 seconds)

**Email**:
- `SMTP_HOST`: `smtp.yandex.ru`
- `SMTP_PORT`: `465`
- `SMTP_USER`: Email address
- `SMTP_PASSWORD`: App-specific password
- `SMTP_FROM`: Sender name and email

### Vercel Build Configuration

**vercel.json** (updated structure):

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist/public",
  "installCommand": "npm install",
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
    },
    {
      "source": "/(.*)\\.{js,css,woff2,png,jpg,jpeg,svg,webp,ico}",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
    }
  ],
  "rewrites": [
    { "source": "/assets/:path*", "destination": "/assets/:path*" },
    { "source": "/favicon.ico", "destination": "/favicon.ico" },
    { "source": "/api/:path*", "destination": "/api/[...path]" },
    { "source": "/:path*", "destination": "/index.html" }
  ],
  "functions": {
    "api/[...path].ts": {
      "maxDuration": 300,
      "memory": 1024
    }
  }
}
```

## Verification Checklist

### Pre-Deployment

- [ ] Local build succeeds: `npm run build`
- [ ] TypeScript check passes: `npm run check`
- [ ] All environment variables set in `.env` (local) or Vercel dashboard
- [ ] Database migrations applied: `npm run db:push`
- [ ] Supabase Storage bucket created with public access for downloads

### Post-Deployment (Production)

**Frontend**:
- [ ] Navigate to `/` → SPA loads without errors
- [ ] Navigate to `/auth` → Login form renders
- [ ] Open DevTools → No 404 errors for assets

**Authentication Flow**:
- [ ] Register new user → Success message shows
- [ ] Check email → Verification link received
- [ ] Click verification link → Redirects to app
- [ ] Navigate to `/api/user` → Returns JSON profile (not 401)
- [ ] Check Supabase dashboard → User exists in Auth
- [ ] Check database → User row exists in `public.users` table

**File Upload Flow**:
- [ ] Login as curator
- [ ] Create new course → Upload PDF file
- [ ] Submit → Upload succeeds (no errors)
- [ ] Check Supabase Storage → File appears in bucket
- [ ] Check database → Row in `knowledge_sources` table
- [ ] Navigate to course → File listed in Resources

**Course Generation Flow**:
- [ ] Create course with S size → Generates exactly 12 questions (MCQ + Open only)
- [ ] Create course with M size → Generates exactly 24 questions (MCQ + Open only)
- [ ] Create course with L size → Generates exactly 36 questions (MCQ + Open only)
- [ ] Zero roleplay steps in generated courses
- [ ] Question type distribution: approximately 60% MCQ, 40% Open
- [ ] Generation completes in < 5 minutes
- [ ] No server errors in Vercel logs

**API Endpoints**:
- [ ] `GET /api/health` → Returns 200 with service status
- [ ] `GET /api/user` → Returns profile for authenticated user
- [ ] `POST /api/tracks/generate` → Accepts file upload, returns track
- [ ] `GET /api/tracks` → Returns curator's tracks
- [ ] No "Unexpected token" JSON parse errors in browser console

## Monitoring & Rollback

### Production Metrics to Track

**Vercel Dashboard**:
- Function invocation errors (should be < 1%)
- Function execution duration (should be < 3 minutes for generation)
- Static asset 404 rate (should be 0%)

**Database Metrics** (Supabase):
- Active connections (should stay under limit)
- Failed queries (auth trigger failures)

**Application Metrics**:
- User registration → profile creation success rate (target: 100%)
- Course generation success rate (target: > 95%)
- File upload success rate (target: > 99%)

### Rollback Strategy

**If deployment breaks production**:

1. **Immediate**: Revert Vercel deployment to previous stable version
   - Vercel Dashboard → Deployments → Find last working deployment → "Promote to Production"

2. **Database**: No destructive schema changes in this design; safe to keep DB state

3. **Supabase**: If trigger causes issues, disable trigger:
   ```sql
   ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created;
   ```
   Fall back to middleware-only profile creation

4. **Communication**: Notify users via status page if downtime > 5 minutes

## Success Criteria

**Deployment succeeds** when:

1. Vercel build completes without TypeScript errors
2. Production health check returns `{ ok: true }` with all services enabled
3. 10 test users can complete full flow: register → verify → login → create course → upload file → generate
4. Zero "Не удалось загрузить профиль" errors in logs over 24 hours
5. Course generation produces correct question count (12/24/36) with zero roleplay steps in 100% of test cases
6. No ENOENT, ERR_MODULE_NOT_FOUND, or "Unexpected token" errors in production logs

**Acceptance threshold**: All 6 criteria met for 48 hours post-deployment.
