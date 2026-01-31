# Course Generation Flow Fix - Implementation Progress

## Status: Phase A-B Complete, Phase C-F Pending

**Last Updated**: 2026-01-18
**Implementation Session**: 1 of N

## Completed Work

### Phase A: Schema & Validation ✅

**File Created**: `shared/types.ts` (310 lines)

**Implemented**:
1. **Canonical Step Type Definitions**
   - MCQStep with `correct_index` (not correctIdx)
   - OpenStep with rubric array
   - RoleplayStep with `ai_role`, `user_role`, `task` fields
   - All types include `kb_refs`, `source_quote`, `kb_gap`

2. **Zod Validation Schemas**
   - MCQContentSchema: Validates 4 options, correct_index 0-3, char limits
   - OpenContentSchema: Validates rubric (3-5 items)
   - RoleplayContentSchema: Validates all fields with char limits
   - StepSchema: Discriminated union for type-safe parsing

3. **Validation Functions**
   - `validateKBGapRules()`: Ensures kb_gap rules enforced
   - `validateMCQQuality()`: Checks distractor quality, length consistency
   - `validateCourse()`: Validates question count, type distribution, all step rules

4. **Supporting Types**
   - CourseGenerationConfig: Curator UI inputs
   - CourseBudget: Generation targets
   - CourseGenerationError: Error taxonomy with types

**Key Achievement**: All step types now have strict contracts preventing frontend-backend mismatches.

---

### Phase B: KB Processing ✅

**Files Modified**:
- `server/ai/kb-service.ts`
- `server/ai/parsers.ts`

**Implemented**:
1. **Chunking Optimization**
   - Updated CHUNK_SIZE to 950 chars (700-1200 range)
   - CHUNK_OVERLAP to 200 chars (150-250 range)
   - MIN_CHUNK_SIZE to 400 (avoid tiny chunks)
   - Heading detection already present (lines 34-56)

2. **Complexity Calculation**
   - Added `calculateKBComplexity()` in kb-service.ts
   - Calculates heading density factor (1.0-1.3)
   - Used to adjust question counts dynamically

3. **UTF-8 Normalization**
   - Added NFC normalization to `normalizeKnowledgeBase()`
   - Critical for Cyrillic text consistency
   - Prevents encoding issues in questions/answers

4. **Curator Configuration Support**
   - Added `calculateCourseBudgetWithConfig()` in parsers.ts
   - Supports Small/Medium/Large/Custom sizes
   - Accepts type distribution percentages
   - Returns budget with typeDistribution field

**Key Achievement**: KB processing now handles structure detection and curator preferences.

---

## Pending Work

### Phase C: Generation Pipeline (PENDING)

**Tasks**:
1. Update `COURSE_GENERATION_SYSTEM_PROMPT` in `server/ai/prompts.ts`:
   - Add explicit "NO content steps" rule
   - Require `correct_index` field name
   - Add MCQ distractor quality rules
   - Add JSON schema examples

2. Update `buildCourseGenerationUserPrompt()` in `server/ai/prompts.ts`:
   - Pass curator config (enabled types, size, distribution)
   - Pass CourseBudget min/max counts
   - Limit to top 20 chunks for large KB

3. Replace JSON repair with Zod validation in `server/ai/routes.ts`:
   - Use `CourseSchema.parse()` instead of `parseJSONFromLLM()`
   - ONE retry with "fix JSON" prompt on parse failure
   - Return error to frontend if retry fails (no course save)

4. Add post-generation validation in `/api/ai/generate-track`:
   - Check question count within budget range
   - Check type distribution (±15% tolerance)
   - Check all MCQ have 4 options
   - Check all steps have kb_refs or kb_gap=true
   - Return specific validation errors with Russian messages

**Files to Modify**:
- `server/ai/prompts.ts` (system + user prompt builders)
- `server/ai/routes.ts` (POST /api/ai/generate-track endpoint)

---

### Phase D: Curator UI (PENDING)

**Tasks**:
1. Update `client/src/pages/curator/library.tsx`:
   - Add question type checkboxes: "Тест", "Открытый", "Ролевая игра"
   - Add course size radio buttons: "Малый", "Средний", "Большой", "Свой размер"
   - Add collapsible advanced options: type distribution sliders
   - Update error handling: keep dialog open, show Russian errors, "Попробовать ещё раз" button
   - Add loading states in Russian: "Извлечение текста...", "Генерация вопросов...", "Сохранение курса..."

2. Remove strict mode toggle (anti-hallucination always enabled at system level)

**Files to Modify**:
- `client/src/pages/curator/library.tsx` (CreateTrackDialog component)

---

### Phase E: Course Editor (PENDING)

**Tasks**:
1. Create field mapping utilities in `client/src/pages/curator/course-details.tsx`:
   ```typescript
   function mapRoleplayToUI(backendContent) {
     return {
       scenario: backendContent.scenario,
       aiRole: backendContent.ai_role,  // snake_case → camelCase
       userRole: backendContent.user_role,
       task: backendContent.task,
       rubric: backendContent.rubric,
     };
   }
   
   function mapRoleplayFromUI(uiContent) {
     return {
       scenario: uiContent.scenario,
       ai_role: uiContent.aiRole,  // camelCase → snake_case
       user_role: uiContent.userRole,
       task: uiContent.task,
       rubric: uiContent.rubric,
     };
   }
   ```

2. Update StepItem component:
   - Use mapping functions for roleplay load/save
   - Add `task` field input (currently missing)
   - Display `kb_gap` indicator badge if present
   - Ensure all roleplay fields editable

3. Fix save handler to use correct field names

**Files to Modify**:
- `client/src/pages/curator/course-details.tsx` (StepItem component + handlers)

---

### Phase F: Testing & Documentation (PENDING)

**Tasks**:
1. Unit tests for validation functions:
   - Test `validateMCQQuality()` with various inputs
   - Test `validateCourse()` with edge cases
   - Test `calculateCourseBudgetWithConfig()` with all sizes

2. Integration test:
   - Upload PDF → extract → chunk → generate → validate → save
   - Verify course appears in library
   - Edit roleplay step → verify all fields save

3. Manual test cases (from design doc section):
   - Small KB (5K) → Small course
   - Large KB (100K) → Large course
   - Russian filename upload
   - Cyrillic text in KB
   - PDF with headings
   - Encrypted/scanned/low-text PDFs
   - Generation failure scenarios
   - Roleplay editing

4. Update `IMPLEMENTATION_SUMMARY.md`:
   - List all modified files
   - Document schema changes (correct_index, ai_role/user_role)
   - Document error taxonomy
   - Provide curator testing checklist

**Files to Create/Modify**:
- `server/ai/__tests__/validation.test.ts` (new)
- `IMPLEMENTATION_SUMMARY.md` (update)

---

## Next Steps

### Immediate Priority: Phase C (Generation Pipeline)

**Estimated Effort**: 2-3 hours

**Critical Changes**:
1. Prompt updates to enforce quality rules
2. Zod validation replacing JSON repair
3. Post-generation validation with specific error codes
4. Russian error messages to frontend

**Why This Matters**: Without Phase C, courses will continue to be saved with validation failures. This is the core of the stability fix.

---

### Then: Phase D (Curator UI)

**Estimated Effort**: 2-3 hours

**User-Facing Impact**: Curators can finally control course generation parameters. This dramatically improves UX and reduces generation failures.

---

### Then: Phase E (Editor Fixes)

**Estimated Effort**: 1-2 hours

**Criticality**: HIGH - Roleplay editing currently broken due to field name mismatch.

---

### Finally: Phase F (Testing)

**Estimated Effort**: 3-4 hours

**Essential**: Validates all changes work end-to-end and documents for future maintenance.

---

## Design Document Alignment

All completed work aligns with `/Users/arslanginiatullin/Desktop/AdaptAi/AdaptAi/.qoder/quests/course-generation-flow-fix.md`:

- ✅ Phase A checklist items 1-5: All canonical schemas and validation created
- ✅ Phase B checklist items 1-5: All KB processing improvements implemented
- ⏳ Phase C: Awaiting implementation
- ⏳ Phase D: Awaiting implementation
- ⏳ Phase E: Awaiting implementation
- ⏳ Phase F: Awaiting implementation

## Technical Notes

### Key Decisions Made

1. **Chunk Size**: Chose 950 chars as midpoint of 700-1200 range for balance
2. **Type Distribution**: Default 50% MCQ, 30% Open, 20% Roleplay if curator doesn't specify
3. **Complexity Factor**: Max 1.3x multiplier for highly structured content
4. **UTF-8 NFC**: Applied to all KB text to prevent Cyrillic encoding issues

### Potential Issues

1. **Backward Compatibility**: Existing courses may have `correctIdx` instead of `correct_index`
   - **Mitigation**: Need migration script OR support both during transition
   
2. **Type Distribution Tolerance**: ±15% may be too strict for small courses
   - **Mitigation**: May need to adjust tolerance based on course size

3. **Custom Size Edge Cases**: What if curator specifies 100 questions but KB only supports 20?
   - **Mitigation**: Validation should warn curator and suggest max feasible size

---

## Files Modified Summary

### Created
- `shared/types.ts` (310 lines) - Canonical schemas and validation

### Modified
- `server/ai/kb-service.ts` - Chunk size tuning, complexity calculation
- `server/ai/parsers.ts` - UTF-8 normalization, curator config support

### To Be Modified (Phase C-F)
- `server/ai/prompts.ts`
- `server/ai/routes.ts`
- `client/src/pages/curator/library.tsx`
- `client/src/pages/curator/course-details.tsx`
- `IMPLEMENTATION_SUMMARY.md`

---

## Continuation Instructions

**For Next Implementation Session**:

1. Start with Phase C: Update prompts and validation in generation pipeline
2. Focus on `server/ai/prompts.ts` first (update system prompt)
3. Then `server/ai/routes.ts` (replace JSON repair with Zod validation)
4. Test with real KB upload to verify validation works
5. Then proceed to Phase D (UI) only after backend is stable

**Important**: Do NOT skip Phase C validation. This is the foundation that prevents bad courses from being saved.
