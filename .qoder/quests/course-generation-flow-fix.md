# Course Generation Flow - MVP Stabilization Design

## Executive Summary

This design document outlines the comprehensive refactoring of the course generation pipeline to achieve MVP-quality stability. The primary goal is to ensure reliable course creation from knowledge base (KB) upload through generation, validation, storage, and curator editing.

**Core Principle**: Courses are created **only** upon successful generation and validation. Failed generation results in clear error messages to the curator without creating incomplete courses.

## Design Goals

### Primary Objectives
1. **Reliability**: Course generation succeeds consistently or fails gracefully with actionable error messages
2. **Quality Control**: Generated courses contain sufficient, well-formed questions without content-only steps
3. **Data Integrity**: Unified schema across all components with strict validation
4. **Curator Control**: Flexible course configuration (question types, size, distribution)
5. **Editability**: Full CRUD operations on all question types including roleplay fields
6. **UTF-8 Support**: Correct display of Russian filenames and KB text content
7. **Anti-Hallucination**: All generated content strictly based on KB (always enabled, no curator toggle)

### Anti-Goals
- This design does NOT include advanced AI features (embeddings, semantic search beyond keyword matching)
- This design does NOT add new question types
- This design does NOT modify the UI framework or authentication system

## Current System Analysis

### Identified Issues

#### A. Data Flow Problems
1. **Inconsistent Step Schema**
   - Current: Multiple step type formats (`quiz` with `correctIdx` vs `correctIndex`, `open` with `idealAnswer` vs `ideal_answer`)
   - Current: Roleplay fields scattered across `content` object without clear contract
   - Impact: Frontend-backend mismatch causes edit/save failures

2. **Weak Generation Validation**
   - Current: JSON repair as primary strategy (prompts.ts:424-500)
   - Current: No minimum question count enforcement
   - Current: Content steps can dominate course structure
   - Impact: Low-quality courses saved to database

3. **No Curator Configuration**
   - Current: Fixed generation parameters (3 modules, 3 questions/module in routes.ts:54-55)
   - Current: No UI for question type selection
   - Current: No size control (Small/Medium/Large)
   - Impact: Inflexible generation unsuitable for diverse KB sizes

#### B. KB Processing Gaps
1. **Chunking Without Structure**
   - Current: Simple character-based splitting (kb-service.ts)
   - Current: No semantic boundaries or heading preservation
   - Missing: Topic coverage validation
   - Impact: Generated questions miss key KB sections

2. **UTF-8 Handling**
   - Current: Basic UTF-8 support exists in parsers.ts
   - Risk: Filename encoding issues possible in storage paths
   - Verification Needed: End-to-end UTF-8 flow testing required

#### C. UI-Backend Contract Violations
1. **Roleplay Field Mapping**
   - Current UI expects: `scenario`, `aiRole`, `userRole` (course-details.tsx:738-758)
   - Current backend may return: `situation`, `ai_role`, `user_role`
   - Impact: Roleplay editing broken

2. **Generation Feedback Loop**
   - Current: Dialog stays open on error (library.tsx:108-113)
   - Missing: Retry button and detailed error taxonomy
   - Impact: Poor curator experience on failures

## Target Architecture

### Canonical Data Schema

#### Step Type Definitions

**Multiple Choice Question (MCQ)**
```typescript
{
  type: "mcq",
  tag: string,              // Topic/skill tag for drill mode
  objective: string,        // Learning objective being tested
  kb_refs: number[],        // Chunk IDs supporting this question
  source_quote: string,     // Direct KB quote (≤25 words)
  kb_gap: boolean,          // True if KB lacks information
  content: {
    question: string,       // Question text (≤240 chars)
    options: [string, string, string, string], // Exactly 4 options
    correct_index: number,  // 0-3 (MUST be "correct_index" not "correctIdx")
    explanation: string     // Why answer is correct (≤400 chars, empty if kb_gap=true)
  }
}
```

**Open Question**
```typescript
{
  type: "open",
  tag: string,
  objective: string,
  kb_refs: number[],
  source_quote: string,
  kb_gap: boolean,
  content: {
    question: string,       // Question requiring detailed answer
    rubric: [              // 3-5 scoring criteria
      { score: number, criteria: string }
    ],
    ideal_answer?: string  // Omit if kb_gap=true
  }
}
```

**Roleplay**
```typescript
{
  type: "roleplay",
  tag: string,
  objective: string,
  kb_refs: number[],
  source_quote: string,
  kb_gap: boolean,
  content: {
    scenario: string,       // Situation description (≤600 chars)
    ai_role: string,        // AI character role (e.g., "Клиент")
    user_role: string,      // Employee role (e.g., "Менеджер")
    task: string,           // Specific task to accomplish (≤200 chars)
    rubric: [              // 2-6 scoring criteria
      { score: number, criteria: string }
    ],
    ideal_answer?: string  // Example response (omit if kb_gap=true)
  }
}
```

**Rules**:
- `kb_gap=true` → `ideal_answer`, `explanation` must be empty/omitted
- `kb_refs` must contain valid chunk IDs from KB storage
- `source_quote` required when `kb_gap=false`
- All text fields use UTF-8 encoding (NFC normalized)

### Course Generation Configuration

#### Curator UI Inputs

**Basic Settings**
- Название курса (required)
- Описание (optional)

**Загрузка базы знаний**
- Multi-file upload: PDF, DOCX, TXT, MD
- Display: имя файла, размер, статус извлечения
- Validation: Max 50MB per file, UTF-8 filenames

**Настройка вопросов**
- **Типы вопросов** (чекбоксы, минимум один обязателен):
  - [ ] Тест (множественный выбор)
  - [ ] Открытый (развёрнутый ответ)
  - [ ] Ролевая игра (сценарий)
  
- **Размер курса** (radio buttons):
  - ○ Малый (10-15 вопросов, 2-3 модуля)
  - ○ Средний (20-30 вопросов, 3-5 модулей)
  - ○ Большой (40-60 вопросов, 5-8 модулей)
  - ○ Свой размер (куратор указывает точные числа)

- **Дополнительные настройки** (сворачиваемые):
  - Распределение типов: Тест __%  Открытый __%  Ролевая __%  (в сумме 100%)

**Note**: Anti-hallucination mode is always enabled at the system level. All facts, answers, and explanations must come from the uploaded KB. There is no curator toggle for this - it is enforced in all generations.

#### Generation Pipeline

**Stage 1: KB Ingestion**
```
Input: Files[] → Parser → Text Extraction
Output: {
  rawKnowledgeBase: string,
  sources: [{ filename, pageCount, charCount, mimetype }]
}

Validation:
- Total extracted text ≥ 500 chars
- No PDF encryption/scanning errors
- UTF-8 normalization applied
```

**Stage 2: Chunking with Structure**
```
Input: rawKnowledgeBase → Chunker
Output: KBChunk[] = [
  { 
    id: number,
    content: string,        // 700-1200 chars
    section_title?: string, // Heading if chunk starts section
    chunk_index: number,
    metadata: { overlap: boolean }
  }
]

Rules:
- Chunk size: 700-1200 chars
- Overlap: 150-250 chars between chunks
- Preserve sentence boundaries (don't split mid-sentence)
- Extract headings: lines ending with ":", all caps, or markdown ##
- Store in kb_chunks table with track_id foreign key
- Anti-hallucination: ALWAYS ENABLED (all facts must come from KB, no invention)
```

**Stage 3: Course Structure Planning**
```
Input: 
  - KB size (char count)
  - Curator config (size, types, distribution)
  - Chunk count and heading density

Processing:
  Calculate target counts:
  - Modules: based on size selection + KB complexity
  - Questions per module: balanced distribution
  - Type distribution: apply curator percentages
  - NO content-only steps (content steps removed from MVP)
  - Anti-hallucination mode: ALWAYS ON (enforced at system level)

Output: CourseBudget {
  modules_min: number,
  modules_max: number,
  questions_min: number,
  questions_max: number,
  type_distribution: { mcq: %, open: %, roleplay: % }
}
```

**Stage 4: AI Generation with Structured Output**
```
Input:
  - System Prompt: Anti-hallucination rules, strict JSON schema, quality criteria
  - User Prompt: CourseBudget, KB chunks (top 20 relevant), type requirements
  - GigaChat Config: { temperature: 0.7, maxTokens: 8000, responseFormat: 'json_object' }

Processing:
  1. Send generation request
  2. Parse JSON (use schema validator, NOT repair heuristics)
  3. If parse fails → ONE retry with "return valid JSON" prompt
  4. If retry fails → ABORT, return error to curator

Validation (post-generation):
  ✓ Question count within [min, max] range
  ✓ All MCQ have exactly 4 options
  ✓ All steps have kb_refs (non-empty array)
  ✓ All steps have source_quote OR kb_gap=true
  ✓ MCQ distractor quality (similar length, no obvious correct)
  ✓ Type distribution matches curator config (±15% tolerance)
  ✓ No content-only steps exist

Output:
  - Success → Course{ modules[], steps[] }
  - Failure → Error{ type, message, retryable }
```

**Stage 5: Database Transaction**
```
BEGIN TRANSACTION;

1. INSERT INTO tracks (title, description, rawKnowledgeBase, strictMode, ...)
   → Get track_id

2. INSERT INTO knowledge_sources (courseId, filename, extractedCharCount, ...)
   FOR EACH uploaded file
   → Get source_ids[]

3. INSERT INTO kb_chunks (trackId, sourceId, content, chunkIndex, sectionTitle, ...)
   FOR EACH chunk
   → Indexed for retrieval

4. INSERT INTO steps (trackId, type, tag, content, orderIndex)
   FOR EACH generated step
   → Linked to track

5. If ANY insert fails:
   ROLLBACK;
   Return error to curator
   ELSE:
   COMMIT;
   Return success with track_id

END TRANSACTION;
```

**Error Handling Taxonomy**

| Error Type | Message to Curator (Russian) | Retryable | Action |
|---|---|---|---|
| `pdf_encrypted` | "PDF защищён паролем. Загрузите незащищённую версию." | No | Ask for different file |
| `pdf_scanned` | "PDF не содержит текстового слоя. Экспортируйте PDF с текстом или используйте TXT/DOCX." | No | Ask for text-based file |
| `insufficient_text` | "Извлечено слишком мало текста (X символов). Загрузите более содержательный документ." | Yes | Add more files |
| `generation_failed` | "AI не смог сгенерировать курс. Попробуйте упростить материал или уменьшить размер." | Yes | Retry with different config |
| `invalid_json` | "AI вернул некорректный формат. Попробуйте ещё раз." | Yes | Retry generation |
| `insufficient_questions` | "Сгенерировано X вопросов, требуется минимум Y. Увеличьте размер KB или выберите меньший размер курса." | Yes | Adjust config |
| `db_transaction_failed` | "Ошибка сохранения курса. Попробуйте позже." | Yes | Retry |

### Curator Course Editor

#### Edit Capabilities

**Module Level**
- ~~Edit module titles~~ (Modules are flat structure, steps have tags instead)

**Step Level (All Types)**
- Edit question/scenario text
- Edit MCQ options and correct answer index
- Edit open question rubric and ideal answer
- Edit roleplay: scenario, ai_role, user_role, task, rubric
- Reorder steps (drag & drop)
- Delete steps
- Add new steps manually
- Change step tag (topic)

**Field Mapping (Critical)**
```typescript
// Backend → Frontend (on load)
{
  type: "roleplay",
  content: {
    scenario: string,
    ai_role: string,    // Map to aiRole
    user_role: string,  // Map to userRole
    task: string,
    rubric: array
  }
}

// Frontend → Backend (on save)
{
  type: "roleplay",
  content: {
    scenario: editContent.scenario,
    ai_role: editContent.aiRole,    // Map from aiRole
    user_role: editContent.userRole, // Map from userRole
    task: editContent.task,
    rubric: editContent.rubric
  }
}
```

**Save Behavior**
1. Optimistic UI update (instant feedback)
2. PATCH /api/steps/:stepId with new content
3. On success: refetch course data, show toast "Сохранено"
4. On failure: revert UI, show error toast with retry button

#### Course List Refresh
- After successful generation: `queryClient.invalidateQueries({ queryKey: ['/api/tracks'] })`
- Automatic redirect to course details page
- Course appears in library immediately (no manual refresh)

## Implementation Checklist

### Phase A: Schema & Validation
- [ ] Define canonical Step type contracts (TypeScript interfaces in `shared/types.ts`)
- [ ] Create Zod schemas for each step type with strict validation
- [ ] Update `steps` table schema if field names differ (migration script)
- [ ] Add validation helpers: `validateMCQ()`, `validateOpen()`, `validateRoleplay()`
- [ ] Add validation helper: `validateCourse()` (checks min questions, type distribution, etc.)

### Phase B: KB Processing
- [ ] Refactor `extractTextFromPDF()` to ensure UTF-8 normalization (NFC)
- [ ] Add heading detection to chunking logic in `kb-service.ts`
- [ ] Store `section_title` in `kb_chunks` table
- [ ] Add function: `calculateKBComplexity(chunks)` → factor based on heading density
- [ ] Add function: `calculateCourseBudget(kbSize, complexityFactor, curatorConfig)` → min/max counts

### Phase C: Generation Pipeline
- [ ] Update `COURSE_GENERATION_SYSTEM_PROMPT` to:
  - Explicitly forbid content steps
  - Require exact field names (`correct_index` not `correctIdx`)
  - Emphasize MCQ distractor quality rules
  - Specify JSON schema with examples
- [ ] Update `buildCourseGenerationUserPrompt()` to pass:
  - Type requirements (which types enabled)
  - Distribution percentages
  - CourseBudget min/max counts
  - Top 20 relevant chunks (not full KB if large)
- [ ] Replace JSON repair logic with strict schema validation:
  - Use Zod to parse LLM response
  - ONE retry on parse failure with "fix JSON" prompt
  - Return error if retry fails (do not save course)
- [ ] Add post-generation validation in `/api/ai/generate-track`:
  - Check question count range
  - Check type distribution
  - Check MCQ quality (4 options, similar length)
  - Check all steps have `kb_refs` and `source_quote` OR `kb_gap=true`
- [ ] Return validation errors to frontend with error type codes

### Phase D: Curator UI
- [ ] Add question type checkboxes to library.tsx CreateTrackDialog (Тест, Открытый, Ролевая игра)
- [ ] Add course size selector (Малый/Средний/Большой/Свой размер)
- [ ] Add advanced options (distribution sliders for type percentages)
- [ ] Update generateMutation error handling:
  - Keep dialog open on error
  - Show error message with error type (in Russian)
  - Enable "Попробовать ещё раз" button if error is retryable
  - Clear error on config change
- [ ] Add loading state details in Russian (e.g., "Извлечение текста...", "Генерация вопросов...", "Сохранение курса...")
- [ ] Remove strict mode toggle (anti-hallucination is always enabled)

### Phase E: Course Editor
- [ ] Add field mapping utility: `mapRoleplayToUI(backendContent)` and `mapRoleplayFromUI(uiContent)`
- [ ] Update StepItem component in course-details.tsx:
  - Use mapped field names for roleplay (aiRole ↔ ai_role)
  - Ensure all roleplay fields editable (scenario, ai_role, user_role, task, rubric)
  - Add task field input (currently missing)
  - Display kb_gap indicator if present
- [ ] Update save handler to use correct field names
- [ ] Add unsaved changes warning (optional enhancement)

### Phase F: Testing & Documentation
- [ ] Unit tests for validation functions (validateMCQ, validateCourse, etc.)
- [ ] Integration test: Full flow from PDF upload → course save → edit → save
- [ ] Manual test cases:
  - Small KB (5K chars) → Small course
  - Large KB (100K chars) → Large course
  - Russian filename upload → verify display in UI
  - Cyrillic text in KB → verify question generation
  - PDF with headings → verify topic distribution
  - Encrypted PDF → verify error message
  - Scanned PDF → verify error message
  - Low-text PDF → verify error message
  - Generation failure → verify retry flow
  - Roleplay edit → verify all fields save correctly
- [ ] Update IMPLEMENTATION_SUMMARY.md:
  - List all modified files
  - Explain schema changes
  - Describe error handling taxonomy
  - Provide curator testing checklist
  - Document known limitations

## Acceptance Criteria

### Generation Reliability
- ✅ Curator can upload 1+ KB files (PDF, DOCX, TXT, MD) with Russian filenames
- ✅ System extracts text and shows character count to curator
- ✅ Course generation succeeds OR fails with clear, actionable error
- ✅ Generated course has ≥ MIN questions based on size selection
- ✅ NO content-only steps exist in generated course
- ✅ All MCQ have exactly 4 options with plausible distractors
- ✅ Failed generation does NOT create incomplete course in database
- ✅ Course appears in library immediately after successful generation

### Curator Control
- ✅ Curator selects question types (Тест, Открытый, Ролевая игра) via checkboxes
- ✅ Curator selects course size (Малый/Средний/Большой/Свой размер)
- ✅ Generated course respects type distribution (±15% tolerance)
- ✅ Generated course question count within [min, max] range for selected size
- ✅ Anti-hallucination mode always enabled (no toggle, enforced at system level)

### Editability
- ✅ Curator can edit all fields of MCQ (question, options, correct_index, explanation)
- ✅ Curator can edit all fields of Open (question, rubric, ideal_answer)
- ✅ Curator can edit all fields of Roleplay (scenario, ai_role, user_role, task, rubric, ideal_answer)
- ✅ Roleplay fields display correctly on load (no undefined values)
- ✅ Roleplay fields save correctly (backend receives correct field names)
- ✅ Step tag (topic) is editable
- ✅ Steps can be reordered and deleted

### Error Handling
- ✅ PDF encryption error shows clear Russian message with no-retry indication
- ✅ Scanned PDF error shows clear Russian message suggesting text export
- ✅ Low-text error shows character count and suggests adding more content (in Russian)
- ✅ Generation failures show "Попробовать ещё раз" button in UI
- ✅ Validation errors list specific issues in Russian (e.g., "Тест: отсутствуют варианты")
- ✅ Database transaction failures allow retry without data corruption

### UTF-8 Support
- ✅ Russian filenames display correctly in UI
- ✅ Cyrillic KB text generates questions without garbled characters
- ✅ Cyrillic text in questions/answers displays correctly
- ✅ File download preserves original filename with Cyrillic characters

## Technical Constraints

### Performance
- Generation timeout: 90 seconds for GigaChat API call
- Upload timeout: 300 seconds for multi-file processing
- Chunking: Process files in parallel to reduce latency

### LLM Constraints
- GigaChat max tokens: 8000 output tokens per request
- For large KB (>100K chars): Pass only top 20 relevant chunks to LLM (not full KB)
- Temperature: 0.7 (balance creativity and consistency)
- Retry limit: 1 (avoid infinite loops, fast failure)

### Database
- Use transactions for atomic course creation
- All foreign keys enforce referential integrity
- kb_chunks indexed by track_id for fast retrieval

## Dependencies

### External Libraries
- pdf-parse (PDFParse class): PDF text extraction
- mammoth: DOCX text extraction
- zod: Schema validation
- multer: File upload handling

### Internal Modules
- server/ai/gigachat.ts: LLM API wrapper
- server/ai/parsers.ts: File text extraction
- server/ai/prompts.ts: System/user prompt builders
- server/ai/kb-service.ts: Chunking and retrieval
- server/routes.ts: Course generation endpoint
- client/hooks/use-tracks.ts: React Query hooks
- client/pages/curator/library.tsx: Upload UI
- client/pages/curator/course-details.tsx: Editor UI

## Migration Path

### Database Migrations
1. Add `task` field to roleplay content (if missing in current step.content JSONB)
2. Rename `correctIdx` → `correct_index` in existing MCQ steps (data migration script)
3. Ensure `kb_chunks.section_title` column exists (already in schema.ts)

### Backward Compatibility
- Existing courses: Keep as-is, apply new validation only to new courses
- Editor: Support both old (`correctIdx`) and new (`correct_index`) field names during transition period
- Deprecation: Remove old field name support in v2.0 after data migration complete

## Monitoring & Observability

### Key Metrics
- Generation success rate: % of attempts that save a course
- Average generation time: seconds from upload to course save
- Error distribution: count by error type (pdf_encrypted, generation_failed, etc.)
- Question quality: % of MCQ with plausible distractors (manual sampling)
- KB utilization: % of chunks referenced in at least one question

### Logging
- All generation attempts logged to `ai_logs` table with correlationId
- Error messages include correlationId for curator support tickets
- Chunk retrieval logged with relevance scores
- Validation failures logged with specific rule violations

## Known Limitations

### Out of Scope (Post-MVP)
- Advanced semantic search (embeddings, vector DB)
- Real-time collaboration on course editing
- Course versioning and rollback
- Automated course quality scoring
- Multi-language support (only Russian in MVP)
- OCR for scanned PDFs (manual text input workaround)
- Drag-and-drop step reordering (use manual ordering for MVP)

## Glossary

- **KB (Knowledge Base)**: Uploaded text corpus used as factual foundation for course generation
- **Chunk**: Text segment (700-1200 chars) stored for retrieval and LLM context
- **Step**: Single learning activity (MCQ, Open, Roleplay)
- **Module**: Logical grouping of steps by topic (represented by step tags in flat structure)
- **CourseBudget**: Target counts for modules and questions based on KB size and curator config
- **kb_gap**: Flag indicating LLM lacked KB information to answer/validate (requires curator input)
- **Distractor**: Incorrect MCQ option designed to be plausible (not obviously wrong)
- **Anti-hallucination Mode**: System-level enforcement requiring all facts sourced from KB (always enabled, no toggle)
- **correlationId**: Unique identifier for tracing a single generation attempt across logs

## Rollout Strategy

### Stage 1: Schema & Validation (Week 1)
- Implement and test canonical schemas
- Run data migration scripts on staging
- Verify no existing courses broken

### Stage 2: KB Processing (Week 1-2)
- Refactor chunking with heading detection
- Test with real PDFs (10+ diverse samples)
- Benchmark extraction and chunking performance

### Stage 3: Generation Pipeline (Week 2-3)
- Update prompts and validation logic
- Test generation with all error scenarios
- Tune CourseBudget calculations

### Stage 4: UI Updates (Week 3-4)
- Implement curator configuration controls
- Update error handling and feedback
- Fix roleplay field mapping

### Stage 5: Testing & Stabilization (Week 4)
- Execute full test plan
- Fix discovered bugs
- Deploy to production with monitoring

## Success Metrics (Post-Launch)

- **Generation Success Rate**: ≥ 85% (target: 95%)
- **Curator Satisfaction**: NPS ≥ 40 for course creation experience
- **Time to Course Creation**: ≤ 5 minutes from upload to published course
- **Editing Completeness**: 100% of question types fully editable
- **Error Resolution Time**: ≤ 2 attempts to resolve generation failure

---

**Document Version**: 1.0  
**Last Updated**: 2026-01-18  
**Owner**: Engineering Team  
**Status**: Ready for Implementation
## Rollout Strategy

### Stage 1: Schema & Validation (Week 1)
- Implement and test canonical schemas
- Run data migration scripts on staging
- Verify no existing courses broken

### Stage 2: KB Processing (Week 1-2)
- Refactor chunking with heading detection
- Test with real PDFs (10+ diverse samples)
- Benchmark extraction and chunking performance

### Stage 3: Generation Pipeline (Week 2-3)
- Update prompts and validation logic
- Test generation with all error scenarios
- Tune CourseBudget calculations

### Stage 4: UI Updates (Week 3-4)
- Implement curator configuration controls
- Update error handling and feedback
- Fix roleplay field mapping

### Stage 5: Testing & Stabilization (Week 4)
- Execute full test plan
- Fix discovered bugs
- Deploy to production with monitoring

## Success Metrics (Post-Launch)

- **Generation Success Rate**: ≥ 85% (target: 95%)
- **Curator Satisfaction**: NPS ≥ 40 for course creation experience
- **Time to Course Creation**: ≤ 5 minutes from upload to published course
- **Editing Completeness**: 100% of question types fully editable
- **Error Resolution Time**: ≤ 2 attempts to resolve generation failure

---

**Document Version**: 1.0  
**Last Updated**: 2026-01-18  
**Owner**: Engineering Team  
**Status**: Ready for Implementation
## Rollout Strategy

### Stage 1: Schema & Validation (Week 1)
- Implement and test canonical schemas
- Run data migration scripts on staging
- Verify no existing courses broken

### Stage 2: KB Processing (Week 1-2)
- Refactor chunking with heading detection
- Test with real PDFs (10+ diverse samples)
- Benchmark extraction and chunking performance

### Stage 3: Generation Pipeline (Week 2-3)
- Update prompts and validation logic
- Test generation with all error scenarios
- Tune CourseBudget calculations

### Stage 4: UI Updates (Week 3-4)
- Implement curator configuration controls
- Update error handling and feedback
- Fix roleplay field mapping

### Stage 5: Testing & Stabilization (Week 4)
- Execute full test plan
- Fix discovered bugs
- Deploy to production with monitoring

## Success Metrics (Post-Launch)

- **Generation Success Rate**: ≥ 85% (target: 95%)
- **Curator Satisfaction**: NPS ≥ 40 for course creation experience
- **Time to Course Creation**: ≤ 5 minutes from upload to published course
- **Editing Completeness**: 100% of question types fully editable
- **Error Resolution Time**: ≤ 2 attempts to resolve generation failure

---

**Document Version**: 1.0  
**Last Updated**: 2026-01-18  
**Owner**: Engineering Team  
**Status**: Ready for Implementation
**Status**: Ready for Implementation
**Status**: Ready for Implementation
**Status**: Ready for Implementation
**Status**: Ready for Implementation
**Status**: Ready for Implementation
**Status**: Ready for Implementation
