# Design Document: GigaChat to Yandex Cloud AI Assistant Migration

## Project Context

**Objective:** Completely remove GigaChat (Sber) integration from the ADAPT platform and migrate to Yandex Cloud AI Assistant using OpenAI-compatible SDK.

**Constraints:**
- No dead code, environment variables, dependencies, or documentation about GigaChat should remain
- All secrets must come from environment variables (never hardcoded)
- Project must build and run successfully after migration
- Maintain all existing functionality and API contracts

**Critical Security Principle:**
All API keys, folder IDs, and credentials must be stored in environment variables only. No hardcoded secrets in source code.

---

## Architecture Overview

### Current State (GigaChat Integration)

The project currently uses a custom GigaChat client with:
- Custom OAuth 2.0 token management
- Manual HTTPS request handling
- Custom retry logic and error handling
- Integration in multiple modules (course generation, evaluation, roleplay, KB service)

**Integration Points:**
1. `server/ai/gigachat.ts` - Main client implementation
2. `server/ai/course-gen-v2.ts` - Batch course generation
3. `server/ai/evaluator.ts` - Answer evaluation
4. `server/ai/kb-service.ts` - Knowledge base operations
5. `server/ai/roleplay-routes.ts` - Roleplay chat
6. `server/ai/routes.ts` - AI assistant endpoints
7. `server/routes.ts` - Track generation and evaluation
8. `test-gigachat.ts` - Test script
9. `docs/GIGACHAT_INTEGRATION.md` - Documentation
10. `PR_SUMMARY.md` - GigaChat migration notes
11. `.env.example` - Environment variable templates

### Target State (Yandex Cloud AI Assistant)

Replace custom GigaChat client with OpenAI SDK configured for Yandex Cloud:
- Use official `openai` npm package (already in dependencies at version 6.15.0)
- Configure base URL: `https://rest-assistant.api.cloud.yandex.net/v1`
- Use `responses.create()` API with prompt ID and variables
- Maintain existing functionality through adapter layer

---

## API Integration Specification

### Yandex Cloud AI Assistant API Contract

**Endpoint:** `https://rest-assistant.api.cloud.yandex.net/v1`

**Authentication:**
- API Key-based authentication (OpenAI-compatible)
- Project identification via `project` parameter (folder ID)

**Request Format:**
```
client.responses.create({
  prompt: {
    id: PROMPT_ID,
    variables: {
      batch_index: string,
      total_batches: string,
      course_title: string,
      course_description: string,
      expected_steps: string,
      kb_chunks: string,
      quota_mcq: string,
      quota_open: string,
      quota_roleplay: string
    }
  },
  input: string (instruction message)
})
```

**Response Format:**
```
{
  output_text: string (JSON response from model)
}
```

### Output Schema: adapt_course_batch_v1

The Yandex AI Assistant must return responses strictly conforming to this schema:

| Field | Type | Description |
|-------|------|-------------|
| `steps` | array | Exactly 12 step objects |
| `steps[].type` | string | One of: `mcq`, `open`, `roleplay` |
| `steps[].tag` | string | Theme/skill label (min 1 char) |
| `steps[].kb_refs` | array[integer] | Referenced KB chunk IDs (min 1 item) |
| `steps[].kb_gap` | boolean | True if KB lacks information |
| `steps[].source_quote` | string (optional) | Quote from KB source |

**Step Type: mcq (Multiple Choice)**

| Field | Type | Constraints |
|-------|------|-------------|
| `question` | string | Min 1 char |
| `options` | array[string] | Exactly 4 items |
| `correct_index` | integer | 0-3 (snake_case, not camelCase) |
| `explanation` | string (optional) | Why answer is correct |

**Step Type: open (Open-ended)**

| Field | Type | Constraints |
|-------|------|-------------|
| `prompt` | string | Min 1 char |
| `rubric` | array[string] | Min 2 items (array of strings, NOT objects) |
| `sample_good_answer` | string (optional) | Example good response |

**Step Type: roleplay (Scenario-based)**

| Field | Type | Constraints |
|-------|------|-------------|
| `scenario` | string | Min 1 char |
| `ai_role` | string | Min 1 char |
| `user_role` | string | Min 1 char |
| `rubric` | array[object] | Min 1 item, each with `criterion` (string, min 1) and `max_score` (integer, min 1) |
| `task` | string (optional) | Task description |
| `ideal_answer` | string (optional) | Example response |

**Critical Validation Rules:**
- Response must be pure JSON (no markdown, no surrounding text)
- Field names use snake_case (e.g., `correct_index`, not `correctIndex`)
- Exactly 12 steps per batch, steps shoudl be modifiable, there is 12/24/36 steps depends on course size
- No "content" type steps (FORBIDDEN - only mcq/open/roleplay allowed)
- MCQ options must be exactly 4 items
- MCQ correct_index must be 0-3
- Open rubric must be array of strings (min 2)
- Roleplay rubric must be array of objects with criterion and max_score

---

## Migration Plan

### Phase 1: Audit Current Integration

**Objective:** Identify all GigaChat references and dependencies

**Activities:**

1. **Code References:**
   - `server/ai/gigachat.ts` - Main client (539 lines)
   - `server/ai/course-gen-v2.ts` - Import and usage of `getChatCompletion`
   - `server/ai/evaluator.ts` - Import of `getChatCompletion`
   - `server/ai/kb-service.ts` - Type imports and dynamic imports
   - `server/ai/roleplay-routes.ts` - Import of `getChatCompletion`
   - `server/ai/routes.ts` - Import of `getChatCompletion` and types
   - `server/routes.ts` - Import of `getChatCompletion` and types
   - `test-gigachat.ts` - Test file

2. **Documentation:**
   - `docs/GIGACHAT_INTEGRATION.md` - Full integration guide
   - `PR_SUMMARY.md` - Migration notes from OpenAI to GigaChat

3. **Configuration:**
   - `.env.example` - GigaChat environment variables
   - Runtime `.env` file (user's environment)

4. **Dependencies:**
   - No GigaChat-specific npm packages (custom implementation)
   - `openai` package already present at version 6.15.0

### Phase 2: Remove GigaChat Completely

**Objective:** Clean removal of all GigaChat code and references

**File Operations:**

| Action | File Path | Reason |
|--------|-----------|--------|
| DELETE | `server/ai/gigachat.ts` | GigaChat client implementation |
| DELETE | `test-gigachat.ts` | GigaChat test script |
| DELETE | `docs/GIGACHAT_INTEGRATION.md` | GigaChat-specific documentation |
| UPDATE | `PR_SUMMARY.md` | Remove or replace GigaChat migration notes |
| UPDATE | `.env.example` | Remove GigaChat vars, add Yandex vars |

**Import Updates:**

All files importing from `./gigachat` must be updated to import from new Yandex client:

| File | Current Import | New Import |
|------|----------------|------------|
| `server/ai/course-gen-v2.ts` | `import { getChatCompletion, type GigaChatMessage } from './gigachat'` | `import { callYandexPrompt, type YandexMessage } from './yandex-client'` |
| `server/ai/evaluator.ts` | `import { getChatCompletion } from "./gigachat"` | `import { callYandexPrompt } from "./yandex-client"` |
| `server/ai/kb-service.ts` | Dynamic imports of `getChatCompletion` | Import from `./yandex-client` |
| `server/ai/roleplay-routes.ts` | `import { getChatCompletion } from './gigachat'` | `import { callYandexPrompt } from './yandex-client'` |
| `server/ai/routes.ts` | `import { getChatCompletion, type GigaChatMessage } from "./gigachat"` | `import { callYandexPrompt, type YandexMessage } from "./yandex-client"` |
| `server/routes.ts` | `import { getChatCompletion, type GigaChatMessage } from "./ai/gigachat"` | `import { callYandexPrompt, type YandexMessage } from "./ai/yandex-client"` |

### Phase 3: Implement Yandex Client Adapter

**Objective:** Create OpenAI-compatible client wrapper for Yandex Cloud AI Assistant

**New Module: `server/ai/yandex-client.ts`**

**Module Responsibilities:**
- Initialize OpenAI client with Yandex Cloud configuration
- Provide backward-compatible API similar to GigaChat's `getChatCompletion`
- Handle prompt-based invocation using `responses.create()`
- Implement error handling and retry logic
- Export types for message structures

**Configuration Requirements:**

Environment Variables (all required):

| Variable | Purpose | Example Value |
|----------|---------|---------------|
| `YANDEX_CLOUD_API_KEY` | Authentication token | (secret) |
| `YANDEX_CLOUD_PROJECT_FOLDER_ID` | Yandex Cloud folder identifier | `b1gob623caihoc2gidh7` |
| `YANDEX_CLOUD_BASE_URL` | API endpoint | `https://rest-assistant.api.cloud.yandex.net/v1` |
| `YANDEX_PROMPT_ID` | Saved prompt/agent ID for course generation | `fvtdajiaidmkggsqelp4` |
| `YANDEX_TIMEOUT_MS` | Request timeout | `90000` (90 seconds) |

**Client Initialization:**

The module must create an OpenAI client instance:
- `apiKey`: from `YANDEX_CLOUD_API_KEY`
- `baseURL`: from `YANDEX_CLOUD_BASE_URL`
- `project`: from `YANDEX_CLOUD_PROJECT_FOLDER_ID`

**Exported Functions:**

1. **`callYandexPrompt(options)`**
   - Purpose: Call Yandex AI Assistant with prompt ID and variables
   - Parameters:
     - `promptId`: Saved prompt identifier
     - `variables`: Object with prompt variables (all string values)
     - `input`: Instruction message string
     - `timeout`: Optional timeout override
   - Returns: `{ content: string, rawResponse: any }`
   - Error handling: Throw structured errors on failure

2. **`callYandexBatchGeneration(params)`**
   - Purpose: Specialized function for batch course generation
   - Parameters:
     - `batchIndex`: 1-based batch number
     - `totalBatches`: Total number of batches
     - `courseTitle`: Course title
     - `courseDescription`: Optional course description
     - `expectedSteps`: Number of steps to generate (12)
     - `quotaMcq`: Number of MCQ questions
     - `quotaOpen`: Number of open questions
     - `quotaRoleplay`: Number of roleplay scenarios
     - `kbChunks`: Array of KB chunks `{ id, content }`
   - Returns: Parsed and validated batch response
   - Validation: Applies Zod schema validation

3. **`isConfigured()`**
   - Purpose: Check if all required environment variables are set
   - Returns: boolean

4. **`getYandexConfig()`**
   - Purpose: Return sanitized configuration for debugging
   - Returns: Object with non-sensitive config values

**Type Definitions:**

```
YandexMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

YandexPromptOptions {
  promptId: string
  variables: Record<string, string>
  input: string
  timeout?: number
}

YandexBatchParams {
  batchIndex: number
  totalBatches: number
  courseTitle: string
  courseDescription?: string
  expectedSteps: number
  quotaMcq: number
  quotaOpen: number
  quotaRoleplay: number
  kbChunks: Array<{ id: number; content: string }>
}
```

**Error Handling Strategy:**

Error Types:
- Configuration errors (missing env vars)
- Network errors (timeout, connection)
- API errors (4xx, 5xx responses)
- Parsing errors (invalid JSON)
- Validation errors (schema mismatch)

Error Response Format:
```
{
  code: string (e.g., 'CONFIG_MISSING', 'TIMEOUT', 'API_ERROR')
  message: string (technical details)
  userMessage: string (user-friendly Russian message)
}
```

**Retry Logic:**

For transient failures:
- Maximum 3 attempts
- Exponential backoff: 1s, 2s, 4s
- Skip retry for client errors (4xx)
- Apply retry for network/timeout/5xx errors

### Phase 4: Adapt Course Generation Pipeline

**Objective:** Integrate Yandex client into batch course generation workflow

**Modified Module: `server/ai/course-gen-v2.ts`**

**Key Changes:**

1. **Import Update:**
   - Remove: `import { getChatCompletion, type GigaChatMessage } from './gigachat'`
   - Add: `import { callYandexBatchGeneration } from './yandex-client'`

2. **Batch Generation Flow:**

The `generateBatch()` function must be updated to:
- Build `YandexBatchParams` from existing batch plan
- Call `callYandexBatchGeneration()` instead of `getChatCompletion()`
- Remove manual message construction (Yandex handles prompt internally)
- Keep existing validation logic (JSON parsing, Zod validation, count checks)

**Prompt Construction Strategy:**

Since Yandex uses saved prompts with variables, the `input` field must contain:
- Instruction emphasizing anti-hallucination rules
- KB chunk presentation in structured format
- Explicit quotas and constraints
- JSON schema requirements

**KB Chunk Formatting for `input`:**

```
[Чанк <id>]
<content>

[Чанк <id>]
<content>
```

Each chunk must be clearly delimited so the model can reference specific IDs in `kb_refs`.

**Validation Pipeline (NO CHANGES):**

Existing validation remains identical:
1. JSON parsing with `parseJSONFromLLMWithMarkers()` from `prompts.ts`
2. Zod validation with `BatchResponseSchema` from `shared/types.ts`
3. Count validation against expected quotas
4. Type validation (no forbidden "content" type)

**Retry Mechanism (NO CHANGES):**

Keep existing retry prompts from `prompts.ts`:
- `BATCH_RETRY_PROMPTS.jsonInvalid()`
- `BATCH_RETRY_PROMPTS.schemaValidation()`
- `BATCH_RETRY_PROMPTS.countMismatch()`
- `BATCH_RETRY_PROMPTS.forbiddenType()`

### Phase 5: Update Additional Integration Points

**Objective:** Migrate all other LLM usage to Yandex client

**CRITICAL:** All prompts in these modules must be reviewed and translated to Russian if not already.

**Files Requiring Updates:**

1. **`server/ai/evaluator.ts`** - Answer evaluation
   - Update import to use Yandex client
   - Adapt evaluation flow if needed
   - **VERIFY:** Existing evaluation prompts in `prompts.ts` are already in Russian

2. **`server/ai/kb-service.ts`** - Knowledge base operations
   - Update dynamic imports
   - Replace type references
   - **TRANSLATE:** Outline generation prompts to Russian
   - **TRANSLATE:** Semantic search prompts to Russian

3. **`server/ai/roleplay-routes.ts`** - Roleplay chat
   - Update import
   - Adapt chat flow to Yandex API
   - **VERIFY:** Roleplay system prompts are in Russian
   - Maintain conversation history

4. **`server/ai/routes.ts`** - AI assistant endpoints
   - Update import
   - **TRANSLATE:** Chat assistant system prompts to Russian
   - **TRANSLATE:** Drill generation prompts to Russian
   - Maintain endpoint contracts

5. **`server/routes.ts`** - Track generation and evaluation
   - Update import
   - **VERIFY:** Track generation prompts are in Russian
   - Keep evaluation endpoint unchanged

**Backward Compatibility Strategy:**

For modules that don't use batch generation (evaluation, chat, drill), provide a compatibility function:

`callYandexChatCompletion(messages, options)` that:
- Accepts array of messages (system, user, assistant)
- Converts to Yandex prompt format
- Calls Yandex API
- Returns response in same format as old `getChatCompletion()`

This minimizes changes in existing code while using new backend.

### Phase 6: Validation Schema Alignment

**Objective:** Ensure Zod schemas match Yandex output contract

**Current State Analysis:**

The project has two validation layers:
1. `shared/types.ts`: BatchResponseSchema (used in course-gen-v2)
2. `server/ai/prompts.ts`: StepSchema with content union (legacy format)

**Required Changes:**

**`shared/types.ts` - Already Compliant:**

The existing `BatchStepSchema` discriminated union already matches the Yandex contract:
- `BatchStepMcqSchema`: Has `correct_index` (snake_case), 4 options
- `BatchStepOpenSchema`: Has `rubric` as string array or object array (flexible)
- `BatchStepRoleplaySchema`: Has `rubric` as object array with criterion/max_score

**Action:** No changes needed in `shared/types.ts`

**`server/ai/prompts.ts` - Needs Update:**

The `StepSchema` has a `content` field that wraps type-specific data. This is legacy format.

**Action:** Create separate `YandexBatchStepSchema` that:
- Removes the `content` wrapper
- Uses discriminated union like `BatchStepSchema` in shared/types
- Enforces snake_case field names
- Validates exactly 4 options for MCQ
- Validates rubric formats per type

Alternatively, deprecate `StepSchema` and use `BatchStepSchema` from shared/types everywhere.

**Prompt Update Requirements:**

All system prompts in `prompts.ts` must be audited and updated:

**Language Requirement:**
- **MUST** be in Russian for Yandex Cloud compatibility
- Only technical terms (JSON, snake_case, mcq, open, roleplay) remain in English
- Field names in schema remain in English

**Content Requirements:**
- Emphasize snake_case (`correct_index`, not `correctIndex`)
- Prohibit `content` type explicitly
- Specify exact rubric formats per type
- Warn that violations will cause rejection

**Prompts to Translate (if not already in Russian):**

| Prompt Constant | Current Language | Action |
|-----------------|------------------|--------|
| `COURSE_GENERATION_SYSTEM_PROMPT` | Russian | ✓ Already correct |
| `COURSE_BATCH_SYSTEM_PROMPT` | To verify | Translate if needed |
| `EVALUATION_SYSTEM_PROMPT` | Russian | ✓ Already correct |
| `DRILL_GENERATION_SYSTEM_PROMPT` | Mixed | Translate to Russian |
| `BLUEPRINT_SYSTEM_PROMPT` | Russian | ✓ Already correct |
| `LESSON_SYSTEM_PROMPT` | Russian | ✓ Already correct |
| `KB_OUTLINE_SYSTEM_PROMPT` | Mixed | Translate to Russian |
| `BATCH_RETRY_PROMPTS.*` | To verify | Translate all to Russian |

**User Prompt Builders:**
- `buildCourseBatchUserPrompt()` - Must generate Russian text
- `buildCourseGenerationUserPrompt()` - Already in Russian
- `buildEvaluationUserPrompt()` - Already in Russian
- `buildDrillGenerationUserPrompt()` - Translate to Russian
- `buildBlueprintUserPrompt()` - Already in Russian
- `buildLessonUserPrompt()` - Already in Russian
- `buildKBOutlineUserPrompt()` - Translate to Russian
- `buildChatAssistantSystemPrompt()` - Translate to Russian

### Phase 7: Environment Configuration

**Objective:** Update environment variable templates and documentation

**`.env.example` Updates:**

Remove GigaChat section:
```
# AI Integration - GigaChat (Sber)
GIGACHAT_CLIENT_ID=...
GIGACHAT_CLIENT_SECRET=...
GIGACHAT_SCOPE=...
GIGACHAT_MODEL=...
GIGACHAT_TIMEOUT_MS=...
```

Add Yandex Cloud section:
```
# AI Integration - Yandex Cloud AI Assistant
YANDEX_CLOUD_API_KEY=your-yandex-api-key-here
YANDEX_CLOUD_PROJECT_FOLDER_ID=your-folder-id-here
YANDEX_CLOUD_BASE_URL=https://rest-assistant.api.cloud.yandex.net/v1
YANDEX_PROMPT_ID=your-saved-prompt-id-here
YANDEX_TIMEOUT_MS=90000
```

**Runtime `.env` Configuration:**

Users must update their local `.env` files with:
- Yandex Cloud API key
- Yandex Cloud project folder ID
- Saved prompt ID for batch generation
- Base URL (can use default)
- Timeout (can use default)

**Validation on Startup:**

The `yandex-client.ts` module must validate configuration on initialization:
- Log warning if any required variable is missing
- Expose `isConfigured()` function for health checks
- Provide clear error messages with environment variable names

### Phase 8: Documentation Updates

**Objective:** Document Yandex Cloud integration and migration

**New Documentation: `docs/YANDEX_CLOUD_INTEGRATION.md`**

Structure:
1. **Overview** - What changed and why
2. **Configuration** - Environment variables and setup
3. **API Reference** - Client functions and parameters
4. **Course Generation Flow** - Batch generation process
5. **Prompt Management** - How to create/update prompts in Yandex Cloud
6. **Language Requirements** - **CRITICAL: All prompts must be in Russian**
7. **Troubleshooting** - Common issues and solutions
8. **Migration Notes** - Key differences from GigaChat

**Critical Documentation Points:**

**Language Requirement Section:**
```markdown
## Language Requirements

**CRITICAL:** Yandex Cloud AI Assistant performs optimally ONLY with Russian language prompts.

### What Must Be in Russian:
- All system prompts
- All user prompts and instructions
- All retry and error correction messages
- All KB chunk descriptions and context

### What Stays in English:
- JSON field names (technical schema)
- Type names: mcq, open, roleplay
- Technical terms: JSON, snake_case, array

### Migration from GigaChat:
GigaChat prompts were already in Russian, so most prompts require minimal changes.
However, verify all prompts are in Russian before deployment.

### Testing Language Compliance:
Run test script with verbose logging to verify all prompts sent to Yandex are in Russian.
```

**README.md Updates:**

Add section on AI Integration:
- Link to Yandex Cloud documentation
- Required environment variables
- Setup instructions

**Remove GigaChat References:**

- Delete `docs/GIGACHAT_INTEGRATION.md`
- Update `PR_SUMMARY.md` to remove GigaChat migration notes (or mark as historical)
- Update any inline comments mentioning GigaChat

### Phase 9: Testing and Validation

**Objective:** Ensure migration is successful and system is operational

**Test Script: `test-yandex-cloud.ts`**

Create a new test script to validate:
1. Configuration is loaded correctly
2. Client initializes successfully
3. Batch generation completes with valid output
4. JSON parsing works
5. Zod validation passes
6. Error handling works (simulated failures)

**Test Cases:**

| Test Case | Description | Expected Outcome |
|-----------|-------------|------------------|
| Config validation | Missing environment variables | Clear error messages |
| Client initialization | Valid config provided | Client instance created |
| Batch generation | Valid batch parameters | 12 valid steps returned |
| JSON parsing | LLM response with markdown | Successfully parsed JSON |
| Schema validation | Valid batch response | Zod validation passes |
| Count validation | 12 steps, correct quotas | No validation errors |
| Retry logic | Simulated API failure | Retries 3 times with backoff |
| Error handling | Invalid API key | User-friendly error message |

**Integration Testing:**

Manual testing workflow:
1. Create a test track with KB upload
2. Trigger course generation (batch mode)
3. Verify all batches complete successfully
4. Check generated steps in database
5. Validate step types and structure
6. Test evaluation on generated course
7. Test roleplay and chat features

**Validation Checklist:**

- [ ] All GigaChat imports removed
- [ ] No compilation errors
- [ ] No GigaChat references in codebase
- [ ] Environment variables updated
- [ ] Test script passes
- [ ] Course generation works end-to-end
- [ ] Answer evaluation works
- [ ] Roleplay chat works
- [ ] Documentation updated
- [ ] `.env.example` updated

---

## Prompt Engineering Strategy

### Critical Language Requirement

**IMPORTANT:** All prompts and instructions sent to Yandex Cloud AI Assistant MUST be in Russian. The model performs optimally only with Russian language input.

**Scope:**
- All system prompts in `server/ai/prompts.ts`
- All `input` field content in `responses.create()` calls
- All retry prompts and error correction messages
- All instructions and constraints

**Exception:**
- Field names in JSON schema remain in English (snake_case: `correct_index`, `kb_refs`, etc.)
- Technical terms: `JSON`, `snake_case`, `mcq`, `open`, `roleplay`

### Input Message Construction

The `input` field in `responses.create()` must guide the model to:

1. **Follow Anti-Hallucination Rules:**
   - Use ONLY information from provided KB chunks
   - Set `kb_gap: true` when information is missing
   - Never invent facts, terms, or examples
   - Reference specific KB chunk IDs in `kb_refs`

2. **Respect Output Schema:**
   - Return pure JSON without markdown
   - Use snake_case for all field names
   - Generate exactly 12 steps
   - Follow type-specific field requirements

3. **Meet Quality Standards:**
   - MCQ: All 4 options must be plausible, similar length, avoid obvious patterns
   - Open: Rubric must have minimum 2 criteria
   - Roleplay: Must include scenario, roles, and scoring rubric

**IMPORTANT:** The full comprehensive Russian prompt template (11 sections, ~200 lines) has been provided by the user and must be used exactly as-is in the `input` field. The template includes:
- Section 0: Language and style requirements
- Section 1-2: Anti-hallucination rules and input parameters
- Section 3-5: Output format and step type specifications
- Section 6-9: Batch assembly, KB referencing, counts synchronization, corner cases
- Section 10-11: Self-check checklist and output requirements

This template ensures strict compliance with the adapt_course_batch_v1 schema and enforces all quality standards including snake_case field names, exactly 4 MCQ options, 12 steps per batch, and proper KB referencing.

**Input Template Structure (SHORT VERSION FOR REFERENCE):****

```
Ты — методист и экзаменатор корпоративной обучающей платформы ADAPT.
Твоя задача: сгенерировать ОДИН БАТЧ обучающих заданий (steps) для курса по базе знаний (KB), строго в формате JSON по схеме "adapt_course_batch_v1".

========================
0) ЯЗЫК И СТИЛЬ
========================
- Язык: русский.
- Стиль: коротко, точно, без воды.
- Тон: профессиональный, дружелюбный, без канцелярита.
- Запрещены: эмодзи, markdown, пояснения вне JSON, “как ИИ…”, “по моему мнению…”.

========================
1) КРИТИЧЕСКИЕ ПРАВИЛА (ANTI-HALLUCINATION)
========================
ТЫ ДОЛЖЕН ОПИРАТЬСЯ ТОЛЬКО НА ПРЕДОСТАВЛЕННУЮ БАЗУ ЗНАНИЙ (KB CHUNKS).
Запрещено:
- выдумывать факты, цифры, процедуры, политики, термины и названия, которых нет в KB;
- добавлять “общие знания” или “типовые практики”, если их нет в KB;
- ссылаться на источники кроме KB.

Если нужной информации НЕТ в KB:
- ставь "kb_gap": true
- делай задание как уточняющий вопрос к куратору/материалам
- НЕ генерируй “идеальный ответ из головы”
- при kb_gap=true всё равно верни валидный шаг, но содержание должно отражать нехватку KB.

========================
2) ВХОДНЫЕ ПАРАМЕТРЫ (ОНИ ПРИХОДЯТ В USER INPUT / VARIABLES)
========================
Тебе будут переданы:
- batch_index (integer >=1)
- total_batches (integer >=1)
- expected_steps (обычно 12) — СКОЛЬКО шагов вернуть
- quota_mcq, quota_open, quota_roleplay — точные квоты по типам шагов в этом батче
- course_title, course_description — контекст курса
- kb_chunks — массив фрагментов знаний, каждый содержит:
  - id (integer)
  - content (string)
  - score (number, optional)

Ты обязан:
- вернуть steps длиной РОВНО expected_steps
- распределить типы РОВНО по квотам
- каждый шаг должен ссылаться на существующие kb_chunks.id через kb_refs

========================
3) ФОРМАТ ВЫХОДА (СТРОГО)
========================
Верни ТОЛЬКО валидный JSON-объект (без markdown, без текста до/после) в формате:

{
  "batch": {
    "batch_index": <int>,
    "total_batches": <int>,
    "module_title": "<короткое название темы батча>",
    "steps": [ ...ровно expected_steps шагов... ],
    "counts": { "mcq": <int>, "open": <int>, "roleplay": <int> }
  }
}

- Никаких лишних ключей верхнего уровня, кроме "batch".
- Никаких комментариев.
- snake_case в названиях полей (correct_index, kb_refs, kb_gap, source_quote).
- Запрещены любые типы шагов кроме: "mcq", "open", "roleplay".
- Тип "content" ЗАПРЕЩЁН.

========================
4) ОБЯЗАТЕЛЬНЫЕ ПОЛЯ В КАЖДОМ ШАГЕ
========================
Каждый элемент массива steps ОБЯЗАН содержать:
- "type": "mcq" | "open" | "roleplay"
- "tag": короткая тема/навык (1–5 слов)
- "kb_refs": массив ID чанков (integer), min 1, ТОЛЬКО существующие id из kb_chunks
- "kb_gap": boolean
- "source_quote": string (РЕКОМЕНДУЕТСЯ ВСЕГДА) — короткая цитата из KB <= 25 слов, дословно или почти дословно

ВАЖНО:
- source_quote должен быть взят из одного из чанков, указанных в kb_refs.
- Если kb_gap=true и всё равно есть релевантный кусочек контекста — укажи его в source_quote; если контекста нет вообще — source_quote оставь пустой строкой "" (если валидатор позволяет) ИЛИ коротко: "Информация отсутствует в KB." (предпочтительнее).

========================
5) ТРЕБОВАНИЯ К ТИПАМ ШАГОВ (СТРОГО ПО СХЕМЕ)
========================

5.1) MCQ (множественный выбор) — type="mcq"
ОБЯЗАТЕЛЬНЫЕ поля:
- question: string
- options: массив РОВНО из 4 строк
- correct_index: integer 0..3
- explanation: string (коротко почему верно, строго по KB)

КАЧЕСТВО MCQ (обязательно):
- Все 4 варианта правдоподобные и одного “типа” (все действия / все причины / все определения / все числа)
- Дистракторы = распространённые ошибки/заблуждения, а НЕ бессмыслица
- Длина вариантов примерно одинаковая (макс 2x разница)
- Запрещены: “все вышеперечисленное”, “ничего из”, “всегда/никогда” (если KB явно не говорит “всегда/никогда”), шутки
- correct_index должен быть на “случайной” позиции (не всегда 0)
- Проверка на “можно ли угадать без KB”: если да — переработай вопрос, добавь контекст из KB

Если KB не даёт точного ответа:
- kb_gap=true
- сделай вопрос как уточняющий к куратору (“Как по нашему регламенту…?”)
- correct_index всё равно обязателен по схеме: выбери вариант “Нужно уточнение в регламенте/KB” как правильный, и в explanation скажи что KB не содержит ответа (НЕ выдумывай).

5.2) OPEN (развёрнутый ответ) — type="open"
ОБЯЗАТЕЛЬНЫЕ поля:
- prompt: string
- rubric: массив строк (min 2), критерии оценивания

Опционально:
- sample_good_answer: string (ТОЛЬКО если KB содержит явный пример/описание ответа)

Требования:
- prompt должен требовать применения правил/процесса из KB (не “перескажи”)
- rubric должен быть конкретным и проверяемым (“упомянул X”, “описал шаги Y”, “соблюл условие Z”)
- Если KB не хватает: kb_gap=true, prompt — уточняющий, rubric — критерии “что нужно найти/уточнить”

5.3) ROLEPLAY (сценарий) — type="roleplay"
ОБЯЗАТЕЛЬНЫЕ поля:
- scenario: string
- ai_role: string
- user_role: string
- rubric: массив объектов [{criterion, max_score}]
Опционально:
- task: string
- ideal_answer: string (ТОЛЬКО если KB содержит пример/скрипт/регламент ответа)

Требования:
- scenario: реалистичная рабочая ситуация, 2–6 предложений
- ai_role и user_role: чёткие роли (“Клиент”, “Менеджер поддержки”, “Куратор”, …)
- rubric: 3–6 критериев, каждый max_score обычно 1–5
- НЕ добавляй политики/условия, которых нет в KB
- Если KB не хватает: kb_gap=true, scenario фиксирует нехватку (“у нас нет информации в KB о …”), rubric оценивает корректные действия: “задал уточняющие вопросы”, “не выдумывал”, “эскалировал куратору”, “сослался на отсутствие данных в KB”

========================
6) СБОРКА БАТЧА: ТЕМАТИКА И РАЗНООБРАЗИЕ
========================
- module_title: коротко описывает “главную тему” батча, опираясь на наиболее частые/важные мотивы kb_chunks.
- steps должны покрывать НЕ одно и то же: избегай дублей, меняй углы (процесс, исключения, ответственность, коммуникация, ошибки).
- tag должен быть разнообразным: не повторяй один и тот же tag подряд.
- Не делай шаги “на угадывание термина”. Делай на применение.

========================
7) KB_REFS И SOURCE_QUOTE: ПРАВИЛА ПРИВЯЗКИ
========================
- kb_refs: только реальные id из входных kb_chunks.
- На каждый шаг: 1–3 чанка обычно достаточно.
- source_quote:
  - короткая выдержка (<=25 слов)
  - должна быть из одного из kb_refs
  - не добавляй туда то, чего нет в тексте чанка

========================
8) COUNTS: ОБЯЗАТЕЛЬНАЯ СИНХРОНИЗАЦИЯ
========================
В batch.counts ты ОБЯЗАН поставить:
- mcq = quota_mcq
- open = quota_open
- roleplay = quota_roleplay

И steps должны фактически содержать ровно такое количество типов.

========================
9) CORNER CASES (ОБРАБОТКА ОШИБОК ВХОДА)
========================
Если kb_chunks пустой или слишком маленький/нерелевантный:
- Всё равно верни валидный JSON
- Все steps: kb_gap=true
- kb_refs: если нет чанков — НО schema требует minItems=1.
  В этом случае:
  - используй kb_refs: [0] ТОЛЬКО если во входе реально есть чанк id=0.
  - иначе выбери любой существующий id чанка (если хоть один есть) и честно укажи в source_quote/тексте, что информация отсутствует.
  - если чанков реально 0 (ни одного id), то ты всё равно обязан вернуть массив kb_refs по схеме.
    В таком крайнем случае используй kb_refs: [1] и source_quote: "KB пуста: нет чанков для ссылок." (это технический fallback).
    НЕ ПРИДУМЫВАЙ факты — только сообщи о пустоте KB.

Если квоты несовместимы с expected_steps (например, quota sum != expected_steps):
- Приоритет: expected_steps.
- Постарайся соблюсти квоты, но если сумма квот НЕ равна expected_steps, то:
  - скорректируй counts и фактические типы так, чтобы сумма совпала с expected_steps
  - и в module_title добавь пометку "(quota mismatch)" нельзя — потому что это лишний смысл.
  - поэтому просто соблюдай expected_steps и сделай counts равными факту.
(НО: если пользователь явно требует counts=квоты, то выполняй квоты как истину и под expected_steps подстрой длину. В обычном режиме: expected_steps = истина.)

========================
10) SELF-CHECK ПЕРЕД ОТВЕТОМ (ОБЯЗАТЕЛЬНО ВНУТРИ МЫСЛЕЙ, НО НЕ ПИШИ НАРУЖУ)
========================
Перед тем как вернуть JSON, проверь:
- [ ] JSON валиден (кавычки, запятые, типы)
- [ ] Есть только ключ "batch" на верхнем уровне
- [ ] batch_index/total_batches из входа
- [ ] steps.length == expected_steps
- [ ] Типы шагов распределены ровно по квотам (или по ожидаемому контракту)
- [ ] Для каждого mcq: options ровно 4, correct_index 0..3, explanation есть
- [ ] Для каждого open: prompt и rubric (>=2 строки)
- [ ] Для каждого roleplay: scenario, ai_role, user_role, rubric массив объектов {criterion,max_score}
- [ ] В каждом шаге есть tag, kb_refs (min 1), kb_gap
- [ ] kb_refs указывают на существующие chunk id (если возможно)
- [ ] source_quote <= 25 слов и соответствует чанку
- [ ] Нет запрещённых типов (особенно "content")
- [ ] Нет выдуманных фактов, цифр, политик

========================
11) ВЫХОД
========================
Верни ТОЛЬКО JSON. Никакого текста вокруг. Никакого markdown.

```

### Variable Mapping

Prompt variables must be stringified from runtime values:

| Runtime Value | Variable Name | Format |
|---------------|---------------|--------|
| Batch number (1-based) | `batch_index` | String number: "1" |
| Total batches | `total_batches` | String number: "2" |
| Course title | `course_title` | String |
| Course description | `course_description` | String or empty |
| Expected steps count | `expected_steps` | String number: "12" |
| MCQ quota | `quota_mcq` | String number: "8" |
| Open quota | `quota_open` | String number: "3" |
| Roleplay quota | `quota_roleplay` | String number: "1" |
| KB chunks | `kb_chunks` | JSON string array of objects |

**KB Chunks Serialization:**

```
JSON.stringify(kbChunks.map(chunk => ({
  id: chunk.id,
  content: chunk.content.substring(0, 800)
})))
```

Limit each chunk content to 800 characters to stay within token limits.

### Response Parsing and Validation

**Step 1: Extract JSON**

Use existing `parseJSONFromLLMWithMarkers()` from `prompts.ts`:
- Removes markdown code blocks
- Extracts JSON between BEGIN_JSON/END_JSON markers
- Falls back to `jsonrepair` library for malformed JSON

**Step 2: Zod Validation**

Apply `BatchResponseSchema.safeParse()`:
- Validates overall structure
- Validates each step type (discriminated union)
- Checks field types and constraints
- Returns detailed error messages on failure

**Step 3: Business Logic Validation**

Custom validation in `course-gen-v2.ts`:
- Count check: exactly 12 steps (or batch-specific count)
- Quota check: type counts match requested quotas (with tolerance)
- Forbidden type check: no "content" type steps
- Reference check: kb_refs are valid integers

**Step 4: Retry on Failure**

If any validation fails:
- Log specific error details
- Append retry prompt with error explanation
- Retry up to 3 times total
- Return error result if all attempts fail

---

## Error Handling and Retry Strategy

### Error Classification

| Error Type | Code | Retry? | User Message (Russian) |
|------------|------|--------|------------------------|
| Missing config | `CONFIG_MISSING` | No | Не настроен AI сервис. Обратитесь к администратору. |
| Network timeout | `TIMEOUT` | Yes | Превышено время ожидания ответа. Попробуйте ещё раз. |
| Connection error | `NETWORK_ERROR` | Yes | Ошибка подключения к AI сервису. Проверьте соединение. |
| Bad request (400) | `BAD_REQUEST` | No | Некорректный запрос к AI сервису. |
| Unauthorized (401) | `UNAUTHORIZED` | No | Неверный API ключ. Проверьте настройки. |
| Forbidden (403) | `FORBIDDEN` | No | Доступ к AI сервису запрещён. Проверьте настройки. |
| Not found (404) | `NOT_FOUND` | No | AI сервис недоступен. |
| Rate limit (429) | `RATE_LIMIT` | Yes | Слишком много запросов. Подождите немного. |
| Server error (5xx) | `SERVER_ERROR` | Yes | Сервер AI временно недоступен. Попробуйте позже. |
| JSON parse error | `JSON_PARSE` | Yes | Получен некорректный ответ от AI. |
| Schema validation | `SCHEMA_VALIDATION` | Yes | Ответ не соответствует ожидаемой схеме. |

### Retry Configuration

**Automatic Retry (Network/Transient):**
- Max attempts: 3
- Backoff delays: [1000ms, 2000ms, 4000ms]
- Total max time: ~90 seconds with timeout

**Prompted Retry (Validation):**
- Max attempts: 3 (including initial)
- Add error-specific retry message to conversation
- Use BATCH_RETRY_PROMPTS from prompts.ts
- Track error type for appropriate retry prompt

**No Retry (Client Errors):**
- Configuration errors (missing env vars)
- Authentication errors (401, 403)
- Bad request errors (400)
- Not found errors (404)

### Fallback Behavior

If all retries fail:

**Course Generation:**
- Return `BatchGenerationResult` with success: false
- Include error message and error type
- Set canRetry: true if transient error
- Batch result included in overall CourseGenV2Result
- Allow user to retry failed batches manually

**Evaluation:**
- Return safe default evaluation (score: 5, isCorrect: true)
- Log error for debugging
- Display generic feedback to user

**Chat/Drill:**
- Return error message to frontend
- User can retry manually
- Log error details server-side

---

## Migration Workflow Summary

### Step-by-Step Execution

**Phase 1: Preparation**
1. Review current GigaChat integration points
2. Confirm OpenAI SDK version compatibility
3. Obtain Yandex Cloud credentials and prompt ID
4. Document current functionality baseline
5. **Audit all prompts in `prompts.ts` for Russian language compliance**

**Phase 2: Implementation**
1. Create `server/ai/yandex-client.ts` with OpenAI SDK wrapper
2. Update `.env.example` with Yandex variables
3. **Translate all non-Russian prompts to Russian in `prompts.ts`**
4. Update all imports in integration files
5. Adapt `course-gen-v2.ts` batch generation logic (ensure Russian prompts)
6. Update other integration points (evaluator, KB, roleplay, routes)
7. **Verify all prompt builders generate Russian text**
8. Create `test-yandex-cloud.ts` test script

**Phase 3: Cleanup**
1. Delete `server/ai/gigachat.ts`
2. Delete `test-gigachat.ts`
3. Delete `docs/GIGACHAT_INTEGRATION.md`
4. Update `PR_SUMMARY.md`
5. Remove GigaChat environment variables from examples

**Phase 4: Documentation**
1. Create `docs/YANDEX_CLOUD_INTEGRATION.md`
2. Update README.md with setup instructions
3. Document environment variable requirements
4. Create troubleshooting guide

**Phase 5: Testing**
1. Run test script
2. Manual integration testing
3. Verify all functionality works
4. Test error scenarios
5. Validate no GigaChat references remain

**Phase 6: Deployment**
1. Update production environment variables
2. Deploy updated code
3. Monitor for errors
4. Validate production functionality

### Success Criteria

The migration is complete when:
- [ ] No compilation errors
- [ ] No GigaChat references in code or documentation
- [ ] **All prompts verified to be in Russian language**
- [ ] All environment variables updated
- [ ] Test script passes
- [ ] Course generation works end-to-end
- [ ] Answer evaluation works
- [ ] Roleplay chat works
- [ ] Chat assistant works
- [ ] Drill generation works
- [ ] Error handling works correctly
- [ ] **Prompt language compliance verified in logs**
- [ ] Documentation is complete
- [ ] Production deployment successful

### Rollback Plan

If migration fails in production:

1. **Immediate:** Revert code deployment to previous version
2. **Configuration:** Restore GigaChat environment variables
3. **Verification:** Confirm GigaChat functionality restored
4. **Analysis:** Debug Yandex integration issues offline
5. **Retry:** Fix issues and attempt migration again

**Rollback Safety:**
- Keep GigaChat credentials available during initial deployment
- Deploy during low-traffic period
- Have monitoring and alerts active
- Prepare communication to users if downtime occurs

---

## Files Summary

### Files to Create

| File Path | Purpose |
|-----------|---------|
| `server/ai/yandex-client.ts` | Yandex Cloud OpenAI-compatible client wrapper |
| `test-yandex-cloud.ts` | Integration test script |
| `docs/YANDEX_CLOUD_INTEGRATION.md` | Integration documentation |

### Files to Delete

| File Path | Reason |
|-----------|--------|
| `server/ai/gigachat.ts` | GigaChat client implementation |
| `test-gigachat.ts` | GigaChat test script |
| `docs/GIGACHAT_INTEGRATION.md` | GigaChat-specific documentation |

### Files to Modify

| File Path | Changes |
|-----------|---------|
| `server/ai/course-gen-v2.ts` | Update import, adapt batch generation to Yandex API, ensure Russian prompts |
| `server/ai/evaluator.ts` | Update import to Yandex client, verify Russian prompts |
| `server/ai/kb-service.ts` | Update dynamic imports and types, translate prompts to Russian |
| `server/ai/roleplay-routes.ts` | Update import to Yandex client, verify Russian prompts |
| `server/ai/routes.ts` | Update import to Yandex client, translate chat/drill prompts to Russian |
| `server/routes.ts` | Update import to Yandex client, verify Russian prompts |
| `server/ai/prompts.ts` | **CRITICAL: Translate all prompts to Russian, emphasize snake_case and schema compliance** |
| `.env.example` | Remove GigaChat vars, add Yandex vars |
| `PR_SUMMARY.md` | Remove or mark GigaChat notes as historical |
| `README.md` | Add Yandex Cloud setup instructions, note Russian language requirement |

### Files Not Affected

| File Path | Reason |
|-----------|--------|
| `shared/types.ts` | BatchResponseSchema already matches Yandex output |
| `server/ai/parsers.ts` | Batch planning logic unchanged |
| `server/db.ts` | Database operations unchanged |
| `server/routes.ts` (API contracts) | Endpoint contracts preserved |
| Frontend files (`client/**`) | No frontend changes needed |

---

## Security Considerations

### Environment Variable Management

**Never Hardcode:**
- API keys
- Folder IDs
- Prompt IDs
- Base URLs (use environment variable with default)

**Required Variables:**
All sensitive values must come from environment:
```
YANDEX_CLOUD_API_KEY
YANDEX_CLOUD_PROJECT_FOLDER_ID
YANDEX_PROMPT_ID
```

**Optional Variables (with defaults):**
```
YANDEX_CLOUD_BASE_URL (default: https://rest-assistant.api.cloud.yandex.net/v1)
YANDEX_TIMEOUT_MS (default: 90000)
```

### Credential Storage

**Development:**
- Use `.env` file (in `.gitignore`)
- Never commit real credentials to repository
- Use placeholder values in `.env.example`

**Production:**
- Use environment variable injection (e.g., Replit Secrets, Docker secrets, cloud provider secrets manager)
- Rotate API keys periodically
- Monitor API usage for anomalies

### API Security

**Request Security:**
- Use HTTPS (enforced by base URL)
- Include API key in headers (handled by OpenAI SDK)
- Set reasonable timeouts to prevent hanging requests

**Response Security:**
- Validate all responses before use
- Sanitize any user-generated content in prompts
- Log errors without exposing sensitive details to users

### Access Control

**Server-Side Only:**
- All AI API calls from backend only
- Never expose API keys to frontend
- Authenticate all API endpoints requiring AI access

**User Data:**
- Do not log user answers or personal data
- Sanitize KB content before sending to AI
- Respect user privacy in conversation logs

---

## Monitoring and Observability

### Logging Strategy

**Log Levels:**
- `INFO`: Successful operations, configuration loaded
- `WARN`: Missing optional config, retries, fallback behavior
- `ERROR`: Failures, validation errors, API errors

**Log Format:**

```
[YandexClient] Client initialized: { configured: true, timeout: 90000 }
[YandexClient:abc123] Starting batch generation (batch 1/2)
[YandexClient:abc123] Response received (2543ms, 5234 chars)
[YandexClient:abc123] Validation failed: count mismatch (expected 12, got 11)
[YandexClient:abc123] Retry attempt 2/3
[YandexClient:abc123] SUCCESS: 12 steps validated
```

**Correlation IDs:**
- Generate unique ID per batch generation
- Include in all related log messages
- Pass to AI logs table for tracking

### Metrics to Track

| Metric | Purpose |
|--------|---------|
| Request count | Total API calls to Yandex |
| Success rate | % of successful requests |
| Latency p50/p95/p99 | Response time distribution |
| Error rate by type | Track common failure modes |
| Retry rate | % of requests requiring retries |
| Token usage | Monitor API consumption |
| Validation failures | Track schema compliance issues |

### Health Checks

**Configuration Check:**
```
GET /api/health/ai
Response: { configured: boolean, service: 'yandex-cloud' }
```

**Functionality Check:**
- Periodic test generation (off-hours)
- Alert if success rate drops below threshold
- Monitor error logs for spikes

### Debugging Tools

**Test Script:**
Run `test-yandex-cloud.ts` to validate:
- Configuration
- Client initialization
- Batch generation
- Parsing and validation

**AI Logs Table:**
Record each AI interaction:
- Correlation ID
- Action type (generate_course, evaluate, chat)
- Prompt text (truncated)
- Response text (truncated)
- Latency
- Status (success/failure)
- Error details

**Log Queries:**
```sql
-- Recent failures
SELECT * FROM ai_logs 
WHERE status = 'error' 
ORDER BY created_at DESC 
LIMIT 20;

-- High latency requests
SELECT * FROM ai_logs 
WHERE latency_ms > 10000 
ORDER BY created_at DESC;

-- Validation failures
SELECT * FROM ai_logs 
WHERE response_text LIKE '%validation%' 
ORDER BY created_at DESC;
```

---

## Risk Assessment

### High-Risk Areas

| Risk | Impact | Mitigation |
|------|--------|------------|
| API authentication failure | Course generation completely broken | Validate config on startup, clear error messages, rollback plan |
| Schema mismatch | Validation failures, no courses generated | Extensive testing, schema documentation, retry with corrective prompts |
| Prompt ID misconfiguration | Wrong prompt invoked, invalid responses | Document prompt creation process, validate prompt ID exists |
| Token limit exceeded | Truncated responses, parsing errors | Limit KB chunk sizes, monitor token usage, implement chunking |
| Rate limiting | Failed requests, degraded service | Implement backoff, queue requests, monitor usage |

### Medium-Risk Areas

| Risk | Impact | Mitigation |
|------|--------|------------|
| Import path errors | Build failures | Careful refactoring, test compilation after each change |
| Type mismatches | TypeScript errors | Update type definitions, use strict types |
| Retry loop infinite | Hung requests | Hard limit on retry attempts, timeout enforcement |
| Log spam | Difficult debugging | Structured logging, appropriate log levels |
| Environment variable typos | Runtime failures | Validation on startup, clear documentation |

### Low-Risk Areas

| Risk | Impact | Mitigation |
|------|--------|------------|
| Documentation outdated | Confusion for developers | Keep docs in sync with code changes |
| Test script failures | Delayed validation | Run tests frequently during development |
| Unused imports | Cluttered codebase | Linting, code review |

---

## Confidence Assessment

**Confidence Level:** High

**Confidence Basis:**

**Strengths:**
1. OpenAI SDK already in dependencies (version 6.15.0)
2. Yandex Cloud API is OpenAI-compatible (documented)
3. Existing validation schemas (BatchResponseSchema) match Yandex output contract
4. Clear integration points identified (8 files to update)
5. Retry logic and error handling patterns already established
6. Test infrastructure in place (can adapt existing tests)

**Risks:**
1. Prompt ID configuration requires external Yandex Cloud setup
2. OpenAI SDK version may need specific configuration for Yandex base URL
3. Variable stringification may have edge cases
4. KB chunk serialization must stay within token limits

**Mitigations:**
1. Provide detailed prompt creation documentation
2. Test OpenAI SDK with Yandex base URL early
3. Implement robust type coercion for variables
4. Implement chunk truncation and monitoring

**Assumptions:**
1. Yandex Cloud AI Assistant supports OpenAI SDK without modifications
2. `responses.create()` API is stable and documented
3. Saved prompts in Yandex can reference variables correctly
4. Output schema adapt_course_batch_v1 is enforced by Yandex configuration

**Validation Plan:**
1. Create test Yandex Cloud project
2. Create saved prompt with variables
3. Test OpenAI SDK integration
4. Validate response parsing
5. Run full integration test

This design provides a clear, systematic approach to migrating from GigaChat to Yandex Cloud AI Assistant while maintaining all existing functionality and ensuring security best practices.
ORDER BY created_at DESC;

-- Validation failures
SELECT * FROM ai_logs 
WHERE response_text LIKE '%validation%' 
ORDER BY created_at DESC;
```

---

## Risk Assessment

### High-Risk Areas

| Risk | Impact | Mitigation |
|------|--------|------------|
| API authentication failure | Course generation completely broken | Validate config on startup, clear error messages, rollback plan |
| Schema mismatch | Validation failures, no courses generated | Extensive testing, schema documentation, retry with corrective prompts |
| Prompt ID misconfiguration | Wrong prompt invoked, invalid responses | Document prompt creation process, validate prompt ID exists |
| Token limit exceeded | Truncated responses, parsing errors | Limit KB chunk sizes, monitor token usage, implement chunking |
| Rate limiting | Failed requests, degraded service | Implement backoff, queue requests, monitor usage |

### Medium-Risk Areas

| Risk | Impact | Mitigation |
|------|--------|------------|
| Import path errors | Build failures | Careful refactoring, test compilation after each change |
| Type mismatches | TypeScript errors | Update type definitions, use strict types |
| Retry loop infinite | Hung requests | Hard limit on retry attempts, timeout enforcement |
| Log spam | Difficult debugging | Structured logging, appropriate log levels |
| Environment variable typos | Runtime failures | Validation on startup, clear documentation |

### Low-Risk Areas

| Risk | Impact | Mitigation |
|------|--------|------------|
| Documentation outdated | Confusion for developers | Keep docs in sync with code changes |
| Test script failures | Delayed validation | Run tests frequently during development |
| Unused imports | Cluttered codebase | Linting, code review |

---

## Confidence Assessment

**Confidence Level:** High

**Confidence Basis:**

**Strengths:**
1. OpenAI SDK already in dependencies (version 6.15.0)
2. Yandex Cloud API is OpenAI-compatible (documented)
3. Existing validation schemas (BatchResponseSchema) match Yandex output contract
4. Clear integration points identified (8 files to update)
5. Retry logic and error handling patterns already established
6. Test infrastructure in place (can adapt existing tests)

**Risks:**
1. Prompt ID configuration requires external Yandex Cloud setup
2. OpenAI SDK version may need specific configuration for Yandex base URL
3. Variable stringification may have edge cases
4. KB chunk serialization must stay within token limits

**Mitigations:**
1. Provide detailed prompt creation documentation
2. Test OpenAI SDK with Yandex base URL early
3. Implement robust type coercion for variables
4. Implement chunk truncation and monitoring

**Assumptions:**
1. Yandex Cloud AI Assistant supports OpenAI SDK without modifications
2. `responses.create()` API is stable and documented
3. Saved prompts in Yandex can reference variables correctly
4. Output schema adapt_course_batch_v1 is enforced by Yandex configuration

**Validation Plan:**
1. Create test Yandex Cloud project
2. Create saved prompt with variables
3. Test OpenAI SDK integration
4. Validate response parsing
5. Run full integration test

This design provides a clear, systematic approach to migrating from GigaChat to Yandex Cloud AI Assistant while maintaining all existing functionality and ensuring security best practices.
