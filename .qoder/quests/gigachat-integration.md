# GigaChat Integration - Remove Replit AI and Replace All LLM Calls

## Overview

This design outlines the complete removal of Replit AI integrations and replacement of all text generation with Sber's GigaChat API. The migration ensures the ADAPT platform continues to work reliably in Russia without VPN, maintains existing product UX flows, and implements robust error handling without silent failures.

## Design Principles

1. **Security First**: No secrets in frontend bundle; all AI operations server-side only
2. **Reliability**: No silent failures; all errors visible to users via toasts and logged on server
3. **Stability**: Must work in Russia without VPN using GigaChat API
4. **Contract Preservation**: Keep existing frontend API contracts unchanged
5. **Strict Mode Compliance**: Respect knowledge base boundaries when strictMode is enabled

## Phase 1: Audit and Mapping

### Current AI Integration Points

| Location | Current Implementation | Purpose | Input Contract | Output Contract |
|----------|----------------------|---------|----------------|-----------------|
| `server/routes.ts:38-167` | `generateTrackContent()` using OpenAI | Generate course structure from knowledge base | `title: string, knowledgeBase: string, strictMode: boolean` | `Array<{type, tag, content, orderIndex}>` |
| `server/routes.ts:454-519` | `/api/evaluate-answer` using OpenAI | Evaluate open/roleplay answers | `{question, userAnswer, idealAnswer?, context?}` | `{score: 0-10, feedback: string, isCorrect: boolean, improvements: string\|null}` |
| `server/replit_integrations/chat/routes.ts:62-117` | `/api/conversations/:id/messages` using OpenAI | Assistant chat (SSE streaming) | `{conversationId: number, content: string}` | SSE stream of message chunks |
| `server/routes.ts:33-36` | OpenAI client initialization | N/A | Environment variables | OpenAI client instance |

### AI Tasks Requiring GigaChat

1. **Track Generation**: Create multi-module course structure from uploaded knowledge base files
2. **Answer Evaluation**: Score and provide feedback on open-ended and roleplay answers
3. **Assistant Chat**: Conversational Q&A support (currently implemented, must preserve)
4. **Drill Generation**: Generate similar questions by tag (not yet implemented in codebase, mentioned in requirements)

### Dependencies to Remove

| Dependency | Type | Current Usage | Action |
|------------|------|---------------|--------|
| `openai` package | Runtime | All LLM calls | Keep (can be used for GigaChat OpenAI-compatible endpoint if available, or replace) |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | Environment | Authentication | Replace with GigaChat credentials |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | Environment | API endpoint | Replace with GigaChat endpoint |
| `server/replit_integrations/` directory | Code structure | Chat routes, batch utils, image generation | Remove image routes; refactor chat to use GigaChat |

## Phase 2: Remove Replit AI Dependencies

### Environment Variables Cleanup

Update `.env.example` to remove Replit-specific variables and prepare for GigaChat:

**Remove:**
- Any Replit AI keys or references

**Update section:**
```
# AI Integration - GigaChat (Sber)
GIGACHAT_CLIENT_ID=your-gigachat-client-id
GIGACHAT_CLIENT_SECRET=your-gigachat-client-secret
GIGACHAT_SCOPE=GIGACHAT_API_PERS
GIGACHAT_MODEL=GigaChat
GIGACHAT_TIMEOUT_MS=60000
```

### Code Removal Strategy

| File/Directory | Action | Rationale |
|----------------|--------|-----------|
| `server/replit_integrations/image/*` | Delete entirely | Image generation not in scope; not used in core flows |
| `server/replit_integrations/batch/*` | Evaluate and possibly keep | Generic batch processing utils may be useful for future multi-step operations |
| `server/replit_integrations/chat/*` | Refactor into `server/ai/chat.ts` | Chat functionality needed, but should use GigaChat not OpenAI |
| OpenAI client in `server/routes.ts` | Replace with GigaChat client | Core LLM operations |

### Package Dependencies

**Evaluate `openai` package:**
- If GigaChat supports OpenAI-compatible API: Keep package, change base URL
- If GigaChat requires custom client: Remove `openai` from `package.json` and implement custom HTTP client

**Keep these packages** (generic utilities):
- `p-limit`, `p-retry` (for rate limiting and retries)

## Phase 3: Implement GigaChat Client

### Server Module Structure

Create new module: `server/ai/gigachat.ts`

### GigaChat Authentication Flow

GigaChat uses OAuth 2.0 with these characteristics:
- **Token Endpoint**: `https://ngw.devices.sberbank.ru:9443/api/v2/oauth`
- **Authentication**: Basic Auth with `base64(client_id:client_secret)`
- **Request ID**: Each request requires unique `RqUID` header (UUID v4)
- **Token Caching**: Access tokens have expiry time; must cache and refresh automatically
- **Scope**: Specified in request body (from environment variable)

### Authentication Module Design

**Token Management:**
- In-memory cache for access token
- Store token with expiry timestamp
- Automatic refresh when token expires or on 401 error
- Thread-safe token refresh (prevent multiple simultaneous refresh requests)

**Token Refresh Logic:**
```
1. Check if cached token exists and is not expired
2. If valid: return cached token
3. If invalid or missing:
   a. Acquire lock (prevent concurrent refreshes)
   b. Re-check cache (another request may have refreshed)
   c. Make OAuth request to GigaChat
   d. Parse response and extract access_token and expires_in
   e. Calculate expiry timestamp (now + expires_in - safety margin)
   f. Cache token with expiry
   g. Release lock
   h. Return token
```

### Chat Completions Flow

**Endpoint**: `https://gigachat.devices.sberbank.ru/api/v1/chat/completions`

**Request Headers:**
- `Authorization: Bearer <access_token>`
- `Content-Type: application/json`

**Request Body:**
```
{
  "model": "<from_env_GIGACHAT_MODEL>",
  "messages": [
    {"role": "system", "content": "..."},
    {"role": "user", "content": "..."},
    {"role": "assistant", "content": "..."}
  ],
  "temperature": <float>,
  "max_tokens": <integer>
}
```

**Response:**
```
{
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "<response_text>"
      },
      "index": 0,
      "finish_reason": "stop"
    }
  ],
  "usage": {...}
}
```

### Error Handling Strategy

| Error Type | Detection | Handling |
|------------|-----------|----------|
| Token expiry | 401 status code | Refresh token once and retry request |
| Rate limiting | 429 status code | Exponential backoff with retry (max 3 attempts) |
| Timeout | Request exceeds GIGACHAT_TIMEOUT_MS | Return graceful error to client with message |
| Network error | Connection failure | Log error, return user-friendly message |
| Invalid response | Malformed JSON or missing fields | Use fallback response, log error |

### Client Interface Design

**Module exports:**

```
interface GigaChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface GigaChatCompletionOptions {
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
}

interface GigaChatResponse {
  content: string;
  finishReason: string;
}

interface GigaChatError {
  code: string;
  message: string;
  userMessage: string; // Safe message for frontend display
}

async function getChatCompletion(
  messages: GigaChatMessage[],
  options?: GigaChatCompletionOptions
): Promise<GigaChatResponse>

async function getChatCompletionStream(
  messages: GigaChatMessage[],
  onChunk: (chunk: string) => void,
  options?: GigaChatCompletionOptions
): Promise<void>
```

### Retry and Timeout Configuration

**Retry logic:**
- Max retries: 3
- Retry conditions: 401 (after token refresh), 429 (rate limit), 5xx (server errors)
- Backoff strategy: Exponential (1s, 2s, 4s)
- Abort conditions: 400 (bad request), 403 (forbidden), 404 (not found)

**Timeout handling:**
- Default timeout: 60 seconds (from environment)
- Applied to each HTTP request
- On timeout: Log detailed error, return structured error object

## Phase 4: Backend Endpoint Implementation

### Endpoint 1: Chat Assistant

**Route:** `POST /api/ai/chat`

**Purpose:** General-purpose conversational AI for employee questions

**Input Schema:**
```
{
  conversationId?: number,  // Optional: for conversation history context
  messages: Array<{role: 'system' | 'user' | 'assistant', content: string}>,
  context?: string          // Optional: additional context (e.g., current course info)
}
```

**Output Schema:**
```
{
  reply: string,
  conversationId?: number   // If conversation was created/updated
}
```

**Implementation Notes:**
- If `conversationId` provided: Load conversation history from database, append to messages
- Construct system prompt: "Ты - помощник в обучающей платформе ADAPT. Отвечай на русском языке..."
- Call `getChatCompletion()` with messages
- Save user message and assistant reply to database (if conversationId exists)
- Return assistant's reply

**Error Handling:**
- GigaChat timeout: Return `{reply: "Извините, не удалось получить ответ. Попробуйте ещё раз.", error: true}`
- GigaChat error: Log full error, return safe message
- Display error toast on frontend

### Endpoint 2: Generate Track

**Route:** `POST /api/ai/generate-track` (or keep existing `POST /api/tracks/generate`)

**Purpose:** Generate multi-module course structure from knowledge base

**Input Schema:**
```
{
  title: string,
  description?: string,
  strictMode: boolean,
  rawKnowledgeBase: string,
  existingStructure?: any   // For regeneration/editing
}
```

**Output Schema:**
```
{
  trackOutline: {
    modules: Array<{
      title: string,
      steps: Array<{
        type: 'content' | 'quiz' | 'open' | 'roleplay',
        tag?: string,
        content: object,      // Matches current steps.content JSON structure
        orderIndex: number
      }>
    }>
  }
}
```

**System Prompt Strategy:**

The prompt must address the critical product requirement: **generate comprehensive multi-module structure, NOT just 3 questions**.

**Prompt structure:**
1. Role definition: Expert Russian-language course creator
2. Task: Create full multi-module course covering ALL major themes from knowledge base
3. Scale guidelines based on KB size:
   - KB > 5000 chars: 6-12 modules, 15-25 total steps
   - KB 2000-5000 chars: 4-8 modules, 10-15 total steps
   - KB < 2000 chars: 3-5 modules, 6-10 total steps
4. Strict mode instruction: If `strictMode === true`, use ONLY information from KB; do not invent facts
5. Step types distribution:
   - Each module: 2-4 content steps + 1-2 quiz/open questions
   - 2-3 roleplay scenarios distributed across course
6. Tag requirement: Each step must have unique tag (theme identifier)
7. Content format specifications for each step type (quiz, open, roleplay, content)
8. Output format: JSON object with "steps" array

**Strict Mode Handling:**
- When `strictMode === true`: Add explicit instruction "Используй СТРОГО ТОЛЬКО информацию из базы знаний. Если информации недостаточно, упомяни это в content, но не выдумывай факты."
- When `strictMode === false`: Allow AI to supplement with general knowledge

**Response Parsing:**
- Parse JSON response from GigaChat
- Validate structure: must be array of step objects
- Validate each step has required fields: type, content, orderIndex
- Assign tags if missing
- Ensure at least one roleplay step exists (add fallback if missing)
- Return steps array

**Fallback Strategy:**
- If GigaChat fails: Use `getFallbackContent()` function (already exists in codebase)
- Fallback generates 4-6 basic steps from KB text
- Log error for monitoring

**Integration Point:**
- Replace `generateTrackContent()` function in `server/routes.ts`
- Keep existing endpoint `/api/tracks/generate` (POST with file upload)
- Steps are saved to database using existing `storage.createSteps()` method

### Endpoint 3: Evaluate Answer

**Route:** `POST /api/ai/evaluate-answer`

**Purpose:** Score and provide detailed feedback on open-ended and roleplay answers

**Input Schema:**
```
{
  step: {
    type: 'quiz' | 'open' | 'roleplay',
    tag?: string,
    content: object
  },
  userAnswer: string,
  strictMode: boolean,
  rawKnowledgeBase?: string
}
```

**Output Schema (Enhanced for Drill Mode):**
```
{
  isCorrect: boolean,           // true if score >= 6
  score_0_10: number,           // 0-10 scale
  whyWrong: string,             // Explanation of errors
  idealAnswer: string,          // Example of good answer
  missingPoints: string[],      // 2-4 key points user missed
  examplePhrases: string[]      // 1-2 example phrases for improvement
}
```

**System Prompt Strategy:**

**Role:** Strict evaluator of learning responses

**Instructions:**
1. Evaluate user answer against ideal answer and context
2. Score on 0-10 scale:
   - 0-3: Wrong or off-topic
   - 4-5: Partially correct with major gaps
   - 6-7: Mostly correct with minor issues
   - 8-9: Good answer with small improvements possible
   - 10: Perfect answer
3. Identify missing key points (2-4 bullets)
4. Provide 1-2 example phrases for improvement
5. Output ONLY valid JSON in specified format

**Strict Mode Application:**
- If `strictMode === true` AND `rawKnowledgeBase` provided: Include KB excerpt in prompt
- Add instruction: "Оценивай только на основе информации из базы знаний. Если пользователь упомянул факты вне базы, отметь это как ошибку."
- If user answer cannot be evaluated against KB: Return `whyWrong: "В базе знаний нет достаточно информации для оценки этого ответа. Вопрос передан куратору."`

**Response Parsing:**
- Parse JSON response
- Validate all required fields present
- Calculate `isCorrect` from score (>= 6)
- Ensure `missingPoints` is array with 2-4 items
- Ensure `examplePhrases` is array with 1-2 items
- Return structured evaluation

**Error Handling:**
- On GigaChat failure: Return safe default evaluation:
  ```
  {
    isCorrect: true,
    score_0_10: 5,
    whyWrong: "",
    idealAnswer: step.content.ideal_answer || "Ответ принят",
    missingPoints: [],
    examplePhrases: []
  }
  ```
- Log error for monitoring
- Display toast: "Оценка выполнена с ограничениями из-за технической ошибки"

**Integration:**
- Replace existing `/api/evaluate-answer` handler in `server/routes.ts`
- Keep same route path
- Frontend call site: `client/src/pages/employee/player.tsx:239`
- No frontend changes required (contract preserved)

### Endpoint 4: Generate Drill Question

**Route:** `POST /api/ai/generate-drill`

**Purpose:** Create a new practice question similar to failed step, by tag/theme

**Input Schema:**
```
{
  tag: string,                  // Theme/skill tag (e.g., "Возражения")
  stepType: 'quiz' | 'open' | 'roleplay',
  rawKnowledgeBase?: string,
  strictMode: boolean
}
```

**Output Schema:**
```
{
  drillStep: {
    type: 'quiz' | 'open' | 'roleplay',
    tag: string,
    content: object             // Same format as regular step content
  }
}
```

**System Prompt Strategy:**

**Role:** Creator of practice questions for skill reinforcement

**Instructions:**
1. Generate a NEW question on the same theme (tag) as failed step
2. Question should test same skill but with different scenario/wording
3. Difficulty should be similar or slightly easier than original
4. Output format must match step type (quiz with options, open with key_points, roleplay with scenario)
5. Ensure content is in Russian

**Step Type Templates:**

**Quiz:**
```
{
  "question": "Вопрос по теме {tag}?",
  "options": ["Вариант 1", "Вариант 2", "Вариант 3", "Вариант 4"],
  "correctIndex": 0,
  "explanation": "Объяснение правильного ответа"
}
```

**Open:**
```
{
  "question": "Развёрнутый вопрос по теме {tag}?",
  "ideal_answer": "Образец хорошего ответа",
  "key_points": ["ключевой момент 1", "ключевой момент 2"]
}
```

**Roleplay:**
```
{
  "scenario": "Рабочая ситуация по теме {tag}...",
  "context": "Контекст задачи",
  "ideal_answer": "Пример профессионального ответа"
}
```

**Strict Mode:**
- If `strictMode === true`: Use only KB content for question generation
- If KB lacks sufficient info for drill: Return error `{error: "Недостаточно информации в базе знаний для генерации дрилла"}`

**Response Validation:**
- Verify generated step has correct type
- Verify content object has all required fields for step type
- Assign tag from input
- Return drillStep object

**Integration Strategy:**
- Create new endpoint (not currently in codebase)
- This endpoint will be called by Drill Mode logic (mentioned in requirements but not yet fully implemented)
- Frontend integration point: When user fails quiz/open/roleplay with score < 6, trigger drill generation
- After generation, display drill question to user for practice attempt

**Future Enhancement:**
- Drill Mode may require additional frontend components (not in scope for this design)
- Backend endpoint must be ready to support Drill Mode when frontend is implemented

## Phase 5: Integration with Existing Flows

### Track Generation Flow

**Current Flow:**
1. Curator uploads files via `POST /api/tracks/generate`
2. Files extracted to text using `extractTextFromFile()`
3. Combined text stored in `tracks.raw_knowledge_base`
4. `generateTrackContent()` called to create steps
5. Steps saved to database with `storage.createSteps()`
6. Response: `{track, steps}`

**Updated Flow:**
1. Keep file upload and extraction logic unchanged
2. Replace `generateTrackContent()` internal implementation:
   - Use GigaChat client instead of OpenAI
   - Enhanced prompt for multi-module generation
   - Same output format (steps array)
3. Database save logic unchanged
4. Same response contract

**No Frontend Changes Required**

### Answer Evaluation Flow

**Current Flow:**
1. Employee submits answer in player: `client/src/pages/employee/player.tsx`
2. Frontend calls `POST /api/evaluate-answer`
3. Backend evaluates with OpenAI
4. Returns `{score, feedback, isCorrect, improvements}`
5. Frontend displays feedback card
6. Records drill attempt with `storage.createDrillAttempt()`

**Updated Flow:**
1. Keep frontend logic unchanged
2. Replace backend OpenAI call with GigaChat
3. Enhanced evaluation response with additional fields:
   - `whyWrong`: Specific explanation of errors
   - `idealAnswer`: Example of good answer
   - `missingPoints`: Array of missing key points
   - `examplePhrases`: Array of improvement suggestions
4. Frontend can optionally use new fields for richer feedback
5. Drill attempt recording unchanged

**Frontend Enhancement (Optional):**
- Display `missingPoints` as bullet list
- Display `examplePhrases` as highlighted examples
- Show `idealAnswer` in expandable section

### Assistant Chat Flow

**Current Flow:**
1. Chat interface (if exists) sends message
2. Backend routes to `/api/conversations/:id/messages`
3. OpenAI streaming response (SSE)
4. Response chunks sent to frontend
5. Message saved to database

**Updated Flow:**
1. Keep conversation database structure
2. Replace OpenAI streaming with GigaChat streaming
3. GigaChat may support streaming (check API docs)
4. If streaming not supported: Send complete response at once
5. Update SSE format if necessary
6. Maintain conversation history in database

**Implementation Decision:**
- If GigaChat supports streaming: Use `getChatCompletionStream()`
- If not: Use `getChatCompletion()` and send single SSE event with full response
- Frontend must handle both streaming and non-streaming modes gracefully

### Database Schema Updates

**No schema changes required** for basic migration.

**Optional Enhancement for Drill Mode:**
- Add `drillSteps` table to store generated drill questions:
  ```
  drillSteps:
    id: serial
    trackId: integer
    originalStepId: integer
    tag: string
    type: string
    content: jsonb
    createdAt: timestamp
  ```
- Allows caching of drill questions to reduce API calls
- Can pre-generate drills during track creation
- Not required for Phase 1 (P0)

## Phase 6: Testing and Quality Assurance

### Acceptance Criteria

#### A. Curator Flow

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Create track with large KB | 1. Login as curator<br>2. Upload 10+ page document<br>3. Submit track creation | 1. Track created successfully<br>2. At least 15 steps generated<br>3. Multiple modules covering different themes<br>4. 2-3 roleplay scenarios included |
| Create track with small KB | Upload 2-page document | 6-10 steps generated, at least 1 roleplay |
| Track opens and renders | Navigate to created track | 1. All steps visible<br>2. Steps have correct types (content/quiz/open/roleplay)<br>3. Content renders properly |
| Strict mode respected | Create track with strictMode=true | Generated questions only reference KB content, no invented facts |

#### B. Employee Flow

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Join by code | Enter valid join code | Enrollment created, redirected to course player |
| Answer quiz correctly | Select correct option, submit | Feedback shows "Правильно!", can proceed to next step |
| Answer quiz incorrectly | Select wrong option, submit | Feedback shows correct answer, score recorded |
| Answer open question | Type answer, submit | Evaluation returns score 0-10, feedback displayed |
| Answer roleplay | Record voice or type answer, submit | Evaluation with detailed feedback (score, missing points, examples) |
| Progress tracking | Complete several steps | Progress percentage updates, lastStepIndex saved |

#### C. Drill Mode Flow

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Drill triggered on wrong answer | Fail quiz/open/roleplay | 1. Compact feedback shown<br>2. Drill attempt counter visible<br>3. Can retry (if drillAttempt < 2) |
| Drill retry success | Answer drill correctly | Progress to next step, drill counter resets |
| Drill retry failure | Fail both drill attempts | Tag marked as "Нужно повторить", can continue to next step |
| Drill generation | Backend generates drill question | New question with same tag, different content |

#### D. Assistant Chat

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Send message in chat | Type question, send | Receives coherent Russian response from GigaChat |
| Conversation context | Send follow-up question | Response considers previous messages |
| Error handling | Trigger timeout/error | User sees friendly error message, not crash |

#### E. Resilience and Error Handling

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| GigaChat token expiry | Wait for token to expire, make request | Token refreshes automatically, request succeeds |
| GigaChat API error | Simulate 500 error from GigaChat | User sees error toast, app doesn't crash, error logged |
| Network timeout | Simulate slow network | Request times out after 60s, user sees timeout message |
| Invalid GigaChat response | Simulate malformed JSON | Fallback content used, error logged |

### Manual Testing Checklist

**Prerequisites:**
- [ ] GigaChat credentials configured in `.env`
- [ ] Database migrated and seeded
- [ ] Application running locally

**Track Generation:**
- [ ] Upload TXT file (small, < 2KB)
- [ ] Upload DOCX file (medium, 2-5KB)
- [ ] Upload multiple files (large, > 5KB combined)
- [ ] Verify step count appropriate for KB size
- [ ] Check all steps have Russian text
- [ ] Verify roleplay steps included
- [ ] Check tags assigned to steps

**Answer Evaluation:**
- [ ] Submit correct quiz answer
- [ ] Submit wrong quiz answer
- [ ] Submit good open answer (should score 8-10)
- [ ] Submit poor open answer (should score 3-5)
- [ ] Submit roleplay answer
- [ ] Verify feedback displays correctly
- [ ] Check missing points and example phrases shown

**Error Scenarios:**
- [ ] Stop GigaChat API (simulate downtime)
- [ ] Create track -> verify fallback content generated
- [ ] Evaluate answer -> verify safe default evaluation
- [ ] Check error toast displayed to user
- [ ] Check server logs contain error details

**Performance:**
- [ ] Track generation completes in < 30 seconds for 5KB KB
- [ ] Answer evaluation completes in < 10 seconds
- [ ] No memory leaks during extended usage
- [ ] Token refresh happens seamlessly

### Automated Testing Strategy

**Unit Tests:**
- GigaChat client authentication
- Token caching and refresh logic
- Error handling for different HTTP status codes
- Response parsing and validation
- Fallback content generation

**Integration Tests:**
- End-to-end track generation flow
- End-to-end answer evaluation flow
- Database operations (saving steps, drill attempts)
- Conversation history management

**Load Tests:**
- Concurrent track generation requests
- Sustained answer evaluation load
- Token refresh under concurrent load

**Not in scope for initial implementation** (future work)

## Phase 7: Deployment and Rollout

### Environment Configuration

**Production Environment Variables:**
```
GIGACHAT_CLIENT_ID=<production_client_id>
GIGACHAT_CLIENT_SECRET=<production_secret>
GIGACHAT_SCOPE=GIGACHAT_API_PERS
GIGACHAT_MODEL=GigaChat
GIGACHAT_TIMEOUT_MS=60000
DATABASE_URL=<production_db_url>
SESSION_SECRET=<production_secret>
NODE_ENV=production
```

**Staging Environment:**
- Use separate GigaChat credentials for staging (if available)
- Test with production-like data volume
- Verify network connectivity to GigaChat from deployment region

### Migration Strategy

**Option 1: Big Bang (Recommended for P0)**
1. Deploy all changes at once
2. Remove Replit AI completely
3. Switch to GigaChat for all operations
4. Rollback plan: Revert to previous deployment if critical issues

**Option 2: Gradual Migration**
1. Deploy GigaChat client alongside OpenAI
2. Route subset of requests to GigaChat (e.g., 10%)
3. Monitor error rates and response quality
4. Gradually increase GigaChat traffic
5. Remove OpenAI when GigaChat at 100%

**Recommendation:** Use Option 1 for simplicity, given requirement to remove ALL Replit AI

### Monitoring and Alerting

**Key Metrics to Track:**
| Metric | Threshold | Alert Condition |
|--------|-----------|-----------------|
| GigaChat API error rate | < 5% | Alert if > 10% |
| Token refresh failures | 0 | Alert on any failure |
| Track generation success rate | > 95% | Alert if < 90% |
| Average evaluation time | < 10s | Alert if > 20s |
| Fallback content usage rate | < 5% | Alert if > 15% |

**Log Events to Monitor:**
- All GigaChat API calls (request, response, duration)
- Token refresh operations
- Fallback content generation
- All errors with full stack traces
- User-facing errors (toast messages)

### Rollback Plan

**Trigger Conditions:**
- GigaChat API unavailable for > 30 minutes
- Error rate > 25% for > 10 minutes
- Critical data corruption detected
- Security vulnerability discovered

**Rollback Steps:**
1. Deploy previous version from git tag
2. Restore database from backup (if schema changed)
3. Verify core flows working
4. Notify users of temporary rollback
5. Investigate issues in staging environment

### Documentation Updates

**Update these files:**
- `README.md`: Replace OpenAI setup with GigaChat setup instructions
- `DATABASE_SETUP.md`: No changes needed (DB schema unchanged)
- `.env.example`: Updated with GigaChat variables (done in Phase 2)
- Create `docs/GIGACHAT_INTEGRATION.md`: Detailed API documentation

**Documentation Content:**
- GigaChat authentication flow
- Token caching mechanism
- Error handling patterns
- Retry logic explanation
- Monitoring and debugging guide
- Troubleshooting common issues

## Risk Assessment and Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| GigaChat API differences from OpenAI | High | Medium | Thorough testing, fallback mechanisms, documented differences |
| Token refresh failures | High | Low | Retry logic, alerting, manual refresh endpoint |
| Response quality degradation | Medium | Medium | Careful prompt engineering, A/B testing, user feedback collection |
| Rate limiting issues | Medium | Low | Exponential backoff, request queuing, monitoring |
| Network instability in Russia | High | Low | Timeout configuration, retry logic, user-facing error messages |
| JSON parsing failures | Low | Low | Strict validation, fallback responses, error logging |

## Success Criteria

**Technical:**
- [ ] Zero Replit AI dependencies in codebase
- [ ] All AI operations use GigaChat
- [ ] No secrets exposed in frontend bundle
- [ ] Error rate < 5% in production
- [ ] All existing tests passing

**Product:**
- [ ] Track generation creates 6-12 modules for large KB (not 3 questions)
- [ ] Evaluation provides detailed feedback (score, missing points, examples)
- [ ] Drill Mode logic supported by backend (even if UI incomplete)
- [ ] No silent failures: all errors visible to users
- [ ] App works in Russia without VPN

**Business:**
- [ ] No user-reported critical bugs in first week
- [ ] Curator and employee flows work end-to-end
- [ ] Response times acceptable (< 30s for generation, < 10s for evaluation)
- [ ] Cost of GigaChat API within budget

## Out of Scope

**Explicitly NOT included in this design:**
- SaluteSpeech integration for TTS
- Voice input enhancements beyond existing Web Speech API
- Frontend Drill Mode UI components (backend ready, UI future work)
- Drill question pre-generation during track creation
- A/B testing between different prompts
- Multi-language support (only Russian)
- Admin dashboard for monitoring AI usage
- Cost optimization strategies
- Performance benchmarking tools

## Appendix: GigaChat API Reference

### Authentication Endpoint

**URL:** `POST https://ngw.devices.sberbank.ru:9443/api/v2/oauth`

**Headers:**
- `Authorization: Basic <base64(client_id:client_secret)>`
- `RqUID: <uuid_v4>`
- `Content-Type: application/x-www-form-urlencoded`

**Body:**
```
scope=<GIGACHAT_SCOPE>
```

**Response:**
```json
{
  "access_token": "string",
  "expires_at": 1234567890
}
```

### Chat Completions Endpoint

**URL:** `POST https://gigachat.devices.sberbank.ru/api/v1/chat/completions`

**Headers:**
- `Authorization: Bearer <access_token>`
- `Content-Type: application/json`

**Request Body:**
```json
{
  "model": "GigaChat",
  "messages": [
    {"role": "system", "content": "System prompt"},
    {"role": "user", "content": "User message"}
  ],
  "temperature": 0.7,
  "max_tokens": 2000
}
```

**Response:**
```json
{
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "Generated response"
      },
      "index": 0,
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 50,
    "completion_tokens": 100,
    "total_tokens": 150
  }
}
```

### Streaming Support

**Check GigaChat documentation** for streaming capabilities. If supported:
- Add `"stream": true` to request body
- Handle Server-Sent Events (SSE) response
- Parse data chunks incrementally

## Next Steps After This Design

1. **Review and Approval**: Product team, engineering lead, security team review this design
2. **Implementation**: Follow phases 1-6 sequentially
3. **Testing**: Execute QA checklist thoroughly
4. **Deployment**: Deploy to staging, then production
5. **Monitoring**: Watch key metrics for 1 week post-deployment
6. **Iteration**: Collect feedback, optimize prompts, improve error handling
7. **Future Work**: Implement SaluteSpeech, complete Drill Mode UI, pre-generate drills

1. **Security First**: No secrets in frontend bundle; all AI operations server-side only
2. **Reliability**: No silent failures; all errors visible to users via toasts and logged on server
3. **Stability**: Must work in Russia without VPN using GigaChat API
4. **Contract Preservation**: Keep existing frontend API contracts unchanged
5. **Strict Mode Compliance**: Respect knowledge base boundaries when strictMode is enabled

## Phase 1: Audit and Mapping

### Current AI Integration Points

| Location | Current Implementation | Purpose | Input Contract | Output Contract |
|----------|----------------------|---------|----------------|-----------------|
| `server/routes.ts:38-167` | `generateTrackContent()` using OpenAI | Generate course structure from knowledge base | `title: string, knowledgeBase: string, strictMode: boolean` | `Array<{type, tag, content, orderIndex}>` |
| `server/routes.ts:454-519` | `/api/evaluate-answer` using OpenAI | Evaluate open/roleplay answers | `{question, userAnswer, idealAnswer?, context?}` | `{score: 0-10, feedback: string, isCorrect: boolean, improvements: string\|null}` |
| `server/replit_integrations/chat/routes.ts:62-117` | `/api/conversations/:id/messages` using OpenAI | Assistant chat (SSE streaming) | `{conversationId: number, content: string}` | SSE stream of message chunks |
| `server/routes.ts:33-36` | OpenAI client initialization | N/A | Environment variables | OpenAI client instance |

### AI Tasks Requiring GigaChat

1. **Track Generation**: Create multi-module course structure from uploaded knowledge base files
2. **Answer Evaluation**: Score and provide feedback on open-ended and roleplay answers
3. **Assistant Chat**: Conversational Q&A support (currently implemented, must preserve)
4. **Drill Generation**: Generate similar questions by tag (not yet implemented in codebase, mentioned in requirements)

### Dependencies to Remove

| Dependency | Type | Current Usage | Action |
|------------|------|---------------|--------|
| `openai` package | Runtime | All LLM calls | Keep (can be used for GigaChat OpenAI-compatible endpoint if available, or replace) |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | Environment | Authentication | Replace with GigaChat credentials |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | Environment | API endpoint | Replace with GigaChat endpoint |
| `server/replit_integrations/` directory | Code structure | Chat routes, batch utils, image generation | Remove image routes; refactor chat to use GigaChat |

## Phase 2: Remove Replit AI Dependencies

### Environment Variables Cleanup

Update `.env.example` to remove Replit-specific variables and prepare for GigaChat:

**Remove:**
- Any Replit AI keys or references

**Update section:**
```
# AI Integration - GigaChat (Sber)
GIGACHAT_CLIENT_ID=your-gigachat-client-id
GIGACHAT_CLIENT_SECRET=your-gigachat-client-secret
GIGACHAT_SCOPE=GIGACHAT_API_PERS
GIGACHAT_MODEL=GigaChat
GIGACHAT_TIMEOUT_MS=60000
```

### Code Removal Strategy

| File/Directory | Action | Rationale |
|----------------|--------|-----------|
| `server/replit_integrations/image/*` | Delete entirely | Image generation not in scope; not used in core flows |
| `server/replit_integrations/batch/*` | Evaluate and possibly keep | Generic batch processing utils may be useful for future multi-step operations |
| `server/replit_integrations/chat/*` | Refactor into `server/ai/chat.ts` | Chat functionality needed, but should use GigaChat not OpenAI |
| OpenAI client in `server/routes.ts` | Replace with GigaChat client | Core LLM operations |

### Package Dependencies

**Evaluate `openai` package:**
- If GigaChat supports OpenAI-compatible API: Keep package, change base URL
- If GigaChat requires custom client: Remove `openai` from `package.json` and implement custom HTTP client

**Keep these packages** (generic utilities):
- `p-limit`, `p-retry` (for rate limiting and retries)

## Phase 3: Implement GigaChat Client

### Server Module Structure

Create new module: `server/ai/gigachat.ts`

### GigaChat Authentication Flow

GigaChat uses OAuth 2.0 with these characteristics:
- **Token Endpoint**: `https://ngw.devices.sberbank.ru:9443/api/v2/oauth`
- **Authentication**: Basic Auth with `base64(client_id:client_secret)`
- **Request ID**: Each request requires unique `RqUID` header (UUID v4)
- **Token Caching**: Access tokens have expiry time; must cache and refresh automatically
- **Scope**: Specified in request body (from environment variable)

### Authentication Module Design

**Token Management:**
- In-memory cache for access token
- Store token with expiry timestamp
- Automatic refresh when token expires or on 401 error
- Thread-safe token refresh (prevent multiple simultaneous refresh requests)

**Token Refresh Logic:**
```
1. Check if cached token exists and is not expired
2. If valid: return cached token
3. If invalid or missing:
   a. Acquire lock (prevent concurrent refreshes)
   b. Re-check cache (another request may have refreshed)
   c. Make OAuth request to GigaChat
   d. Parse response and extract access_token and expires_in
   e. Calculate expiry timestamp (now + expires_in - safety margin)
   f. Cache token with expiry
   g. Release lock
   h. Return token
```

### Chat Completions Flow

**Endpoint**: `https://gigachat.devices.sberbank.ru/api/v1/chat/completions`

**Request Headers:**
- `Authorization: Bearer <access_token>`
- `Content-Type: application/json`

**Request Body:**
```
{
  "model": "<from_env_GIGACHAT_MODEL>",
  "messages": [
    {"role": "system", "content": "..."},
    {"role": "user", "content": "..."},
    {"role": "assistant", "content": "..."}
  ],
  "temperature": <float>,
  "max_tokens": <integer>
}
```

**Response:**
```
{
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "<response_text>"
      },
      "index": 0,
      "finish_reason": "stop"
    }
  ],
  "usage": {...}
}
```

### Error Handling Strategy

| Error Type | Detection | Handling |
|------------|-----------|----------|
| Token expiry | 401 status code | Refresh token once and retry request |
| Rate limiting | 429 status code | Exponential backoff with retry (max 3 attempts) |
| Timeout | Request exceeds GIGACHAT_TIMEOUT_MS | Return graceful error to client with message |
| Network error | Connection failure | Log error, return user-friendly message |
| Invalid response | Malformed JSON or missing fields | Use fallback response, log error |

### Client Interface Design

**Module exports:**

```
interface GigaChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface GigaChatCompletionOptions {
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
}

interface GigaChatResponse {
  content: string;
  finishReason: string;
}

interface GigaChatError {
  code: string;
  message: string;
  userMessage: string; // Safe message for frontend display
}

async function getChatCompletion(
  messages: GigaChatMessage[],
  options?: GigaChatCompletionOptions
): Promise<GigaChatResponse>

async function getChatCompletionStream(
  messages: GigaChatMessage[],
  onChunk: (chunk: string) => void,
  options?: GigaChatCompletionOptions
): Promise<void>
```

### Retry and Timeout Configuration

**Retry logic:**
- Max retries: 3
- Retry conditions: 401 (after token refresh), 429 (rate limit), 5xx (server errors)
- Backoff strategy: Exponential (1s, 2s, 4s)
- Abort conditions: 400 (bad request), 403 (forbidden), 404 (not found)

**Timeout handling:**
- Default timeout: 60 seconds (from environment)
- Applied to each HTTP request
- On timeout: Log detailed error, return structured error object

## Phase 4: Backend Endpoint Implementation

### Endpoint 1: Chat Assistant

**Route:** `POST /api/ai/chat`

**Purpose:** General-purpose conversational AI for employee questions

**Input Schema:**
```
{
  conversationId?: number,  // Optional: for conversation history context
  messages: Array<{role: 'system' | 'user' | 'assistant', content: string}>,
  context?: string          // Optional: additional context (e.g., current course info)
}
```

**Output Schema:**
```
{
  reply: string,
  conversationId?: number   // If conversation was created/updated
}
```

**Implementation Notes:**
- If `conversationId` provided: Load conversation history from database, append to messages
- Construct system prompt: "Ты - помощник в обучающей платформе ADAPT. Отвечай на русском языке..."
- Call `getChatCompletion()` with messages
- Save user message and assistant reply to database (if conversationId exists)
- Return assistant's reply

**Error Handling:**
- GigaChat timeout: Return `{reply: "Извините, не удалось получить ответ. Попробуйте ещё раз.", error: true}`
- GigaChat error: Log full error, return safe message
- Display error toast on frontend

### Endpoint 2: Generate Track

**Route:** `POST /api/ai/generate-track` (or keep existing `POST /api/tracks/generate`)

**Purpose:** Generate multi-module course structure from knowledge base

**Input Schema:**
```
{
  title: string,
  description?: string,
  strictMode: boolean,
  rawKnowledgeBase: string,
  existingStructure?: any   // For regeneration/editing
}
```

**Output Schema:**
```
{
  trackOutline: {
    modules: Array<{
      title: string,
      steps: Array<{
        type: 'content' | 'quiz' | 'open' | 'roleplay',
        tag?: string,
        content: object,      // Matches current steps.content JSON structure
        orderIndex: number
      }>
    }>
  }
}
```

**System Prompt Strategy:**

The prompt must address the critical product requirement: **generate comprehensive multi-module structure, NOT just 3 questions**.

**Prompt structure:**
1. Role definition: Expert Russian-language course creator
2. Task: Create full multi-module course covering ALL major themes from knowledge base
3. Scale guidelines based on KB size:
   - KB > 5000 chars: 6-12 modules, 15-25 total steps
   - KB 2000-5000 chars: 4-8 modules, 10-15 total steps
   - KB < 2000 chars: 3-5 modules, 6-10 total steps
4. Strict mode instruction: If `strictMode === true`, use ONLY information from KB; do not invent facts
5. Step types distribution:
   - Each module: 2-4 content steps + 1-2 quiz/open questions
   - 2-3 roleplay scenarios distributed across course
6. Tag requirement: Each step must have unique tag (theme identifier)
7. Content format specifications for each step type (quiz, open, roleplay, content)
8. Output format: JSON object with "steps" array

**Strict Mode Handling:**
- When `strictMode === true`: Add explicit instruction "Используй СТРОГО ТОЛЬКО информацию из базы знаний. Если информации недостаточно, упомяни это в content, но не выдумывай факты."
- When `strictMode === false`: Allow AI to supplement with general knowledge

**Response Parsing:**
- Parse JSON response from GigaChat
- Validate structure: must be array of step objects
- Validate each step has required fields: type, content, orderIndex
- Assign tags if missing
- Ensure at least one roleplay step exists (add fallback if missing)
- Return steps array

**Fallback Strategy:**
- If GigaChat fails: Use `getFallbackContent()` function (already exists in codebase)
- Fallback generates 4-6 basic steps from KB text
- Log error for monitoring

**Integration Point:**
- Replace `generateTrackContent()` function in `server/routes.ts`
- Keep existing endpoint `/api/tracks/generate` (POST with file upload)
- Steps are saved to database using existing `storage.createSteps()` method

### Endpoint 3: Evaluate Answer

**Route:** `POST /api/ai/evaluate-answer`

**Purpose:** Score and provide detailed feedback on open-ended and roleplay answers

**Input Schema:**
```
{
  step: {
    type: 'quiz' | 'open' | 'roleplay',
    tag?: string,
    content: object
  },
  userAnswer: string,
  strictMode: boolean,
  rawKnowledgeBase?: string
}
```

**Output Schema (Enhanced for Drill Mode):**
```
{
  isCorrect: boolean,           // true if score >= 6
  score_0_10: number,           // 0-10 scale
  whyWrong: string,             // Explanation of errors
  idealAnswer: string,          // Example of good answer
  missingPoints: string[],      // 2-4 key points user missed
  examplePhrases: string[]      // 1-2 example phrases for improvement
}
```

**System Prompt Strategy:**

**Role:** Strict evaluator of learning responses

**Instructions:**
1. Evaluate user answer against ideal answer and context
2. Score on 0-10 scale:
   - 0-3: Wrong or off-topic
   - 4-5: Partially correct with major gaps
   - 6-7: Mostly correct with minor issues
   - 8-9: Good answer with small improvements possible
   - 10: Perfect answer
3. Identify missing key points (2-4 bullets)
4. Provide 1-2 example phrases for improvement
5. Output ONLY valid JSON in specified format

**Strict Mode Application:**
- If `strictMode === true` AND `rawKnowledgeBase` provided: Include KB excerpt in prompt
- Add instruction: "Оценивай только на основе информации из базы знаний. Если пользователь упомянул факты вне базы, отметь это как ошибку."
- If user answer cannot be evaluated against KB: Return `whyWrong: "В базе знаний нет достаточно информации для оценки этого ответа. Вопрос передан куратору."`

**Response Parsing:**
- Parse JSON response
- Validate all required fields present
- Calculate `isCorrect` from score (>= 6)
- Ensure `missingPoints` is array with 2-4 items
- Ensure `examplePhrases` is array with 1-2 items
- Return structured evaluation

**Error Handling:**
- On GigaChat failure: Return safe default evaluation:
  ```
  {
    isCorrect: true,
    score_0_10: 5,
    whyWrong: "",
    idealAnswer: step.content.ideal_answer || "Ответ принят",
    missingPoints: [],
    examplePhrases: []
  }
  ```
- Log error for monitoring
- Display toast: "Оценка выполнена с ограничениями из-за технической ошибки"

**Integration:**
- Replace existing `/api/evaluate-answer` handler in `server/routes.ts`
- Keep same route path
- Frontend call site: `client/src/pages/employee/player.tsx:239`
- No frontend changes required (contract preserved)

### Endpoint 4: Generate Drill Question

**Route:** `POST /api/ai/generate-drill`

**Purpose:** Create a new practice question similar to failed step, by tag/theme

**Input Schema:**
```
{
  tag: string,                  // Theme/skill tag (e.g., "Возражения")
  stepType: 'quiz' | 'open' | 'roleplay',
  rawKnowledgeBase?: string,
  strictMode: boolean
}
```

**Output Schema:**
```
{
  drillStep: {
    type: 'quiz' | 'open' | 'roleplay',
    tag: string,
    content: object             // Same format as regular step content
  }
}
```

**System Prompt Strategy:**

**Role:** Creator of practice questions for skill reinforcement

**Instructions:**
1. Generate a NEW question on the same theme (tag) as failed step
2. Question should test same skill but with different scenario/wording
3. Difficulty should be similar or slightly easier than original
4. Output format must match step type (quiz with options, open with key_points, roleplay with scenario)
5. Ensure content is in Russian

**Step Type Templates:**

**Quiz:**
```
{
  "question": "Вопрос по теме {tag}?",
  "options": ["Вариант 1", "Вариант 2", "Вариант 3", "Вариант 4"],
  "correctIndex": 0,
  "explanation": "Объяснение правильного ответа"
}
```

**Open:**
```
{
  "question": "Развёрнутый вопрос по теме {tag}?",
  "ideal_answer": "Образец хорошего ответа",
  "key_points": ["ключевой момент 1", "ключевой момент 2"]
}
```

**Roleplay:**
```
{
  "scenario": "Рабочая ситуация по теме {tag}...",
  "context": "Контекст задачи",
  "ideal_answer": "Пример профессионального ответа"
}
```

**Strict Mode:**
- If `strictMode === true`: Use only KB content for question generation
- If KB lacks sufficient info for drill: Return error `{error: "Недостаточно информации в базе знаний для генерации дрилла"}`

**Response Validation:**
- Verify generated step has correct type
- Verify content object has all required fields for step type
- Assign tag from input
- Return drillStep object

**Integration Strategy:**
- Create new endpoint (not currently in codebase)
- This endpoint will be called by Drill Mode logic (mentioned in requirements but not yet fully implemented)
- Frontend integration point: When user fails quiz/open/roleplay with score < 6, trigger drill generation
- After generation, display drill question to user for practice attempt

**Future Enhancement:**
- Drill Mode may require additional frontend components (not in scope for this design)
- Backend endpoint must be ready to support Drill Mode when frontend is implemented

## Phase 5: Integration with Existing Flows

### Track Generation Flow

**Current Flow:**
1. Curator uploads files via `POST /api/tracks/generate`
2. Files extracted to text using `extractTextFromFile()`
3. Combined text stored in `tracks.raw_knowledge_base`
4. `generateTrackContent()` called to create steps
5. Steps saved to database with `storage.createSteps()`
6. Response: `{track, steps}`

**Updated Flow:**
1. Keep file upload and extraction logic unchanged
2. Replace `generateTrackContent()` internal implementation:
   - Use GigaChat client instead of OpenAI
   - Enhanced prompt for multi-module generation
   - Same output format (steps array)
3. Database save logic unchanged
4. Same response contract

**No Frontend Changes Required**

### Answer Evaluation Flow

**Current Flow:**
1. Employee submits answer in player: `client/src/pages/employee/player.tsx`
2. Frontend calls `POST /api/evaluate-answer`
3. Backend evaluates with OpenAI
4. Returns `{score, feedback, isCorrect, improvements}`
5. Frontend displays feedback card
6. Records drill attempt with `storage.createDrillAttempt()`

**Updated Flow:**
1. Keep frontend logic unchanged
2. Replace backend OpenAI call with GigaChat
3. Enhanced evaluation response with additional fields:
   - `whyWrong`: Specific explanation of errors
   - `idealAnswer`: Example of good answer
   - `missingPoints`: Array of missing key points
   - `examplePhrases`: Array of improvement suggestions
4. Frontend can optionally use new fields for richer feedback
5. Drill attempt recording unchanged

**Frontend Enhancement (Optional):**
- Display `missingPoints` as bullet list
- Display `examplePhrases` as highlighted examples
- Show `idealAnswer` in expandable section

### Assistant Chat Flow

**Current Flow:**
1. Chat interface (if exists) sends message
2. Backend routes to `/api/conversations/:id/messages`
3. OpenAI streaming response (SSE)
4. Response chunks sent to frontend
5. Message saved to database

**Updated Flow:**
1. Keep conversation database structure
2. Replace OpenAI streaming with GigaChat streaming
3. GigaChat may support streaming (check API docs)
4. If streaming not supported: Send complete response at once
5. Update SSE format if necessary
6. Maintain conversation history in database

**Implementation Decision:**
- If GigaChat supports streaming: Use `getChatCompletionStream()`
- If not: Use `getChatCompletion()` and send single SSE event with full response
- Frontend must handle both streaming and non-streaming modes gracefully

### Database Schema Updates

**No schema changes required** for basic migration.

**Optional Enhancement for Drill Mode:**
- Add `drillSteps` table to store generated drill questions:
  ```
  drillSteps:
    id: serial
    trackId: integer
    originalStepId: integer
    tag: string
    type: string
    content: jsonb
    createdAt: timestamp
  ```
- Allows caching of drill questions to reduce API calls
- Can pre-generate drills during track creation
- Not required for Phase 1 (P0)

## Phase 6: Testing and Quality Assurance

### Acceptance Criteria

#### A. Curator Flow

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Create track with large KB | 1. Login as curator<br>2. Upload 10+ page document<br>3. Submit track creation | 1. Track created successfully<br>2. At least 15 steps generated<br>3. Multiple modules covering different themes<br>4. 2-3 roleplay scenarios included |
| Create track with small KB | Upload 2-page document | 6-10 steps generated, at least 1 roleplay |
| Track opens and renders | Navigate to created track | 1. All steps visible<br>2. Steps have correct types (content/quiz/open/roleplay)<br>3. Content renders properly |
| Strict mode respected | Create track with strictMode=true | Generated questions only reference KB content, no invented facts |

#### B. Employee Flow

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Join by code | Enter valid join code | Enrollment created, redirected to course player |
| Answer quiz correctly | Select correct option, submit | Feedback shows "Правильно!", can proceed to next step |
| Answer quiz incorrectly | Select wrong option, submit | Feedback shows correct answer, score recorded |
| Answer open question | Type answer, submit | Evaluation returns score 0-10, feedback displayed |
| Answer roleplay | Record voice or type answer, submit | Evaluation with detailed feedback (score, missing points, examples) |
| Progress tracking | Complete several steps | Progress percentage updates, lastStepIndex saved |

#### C. Drill Mode Flow

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Drill triggered on wrong answer | Fail quiz/open/roleplay | 1. Compact feedback shown<br>2. Drill attempt counter visible<br>3. Can retry (if drillAttempt < 2) |
| Drill retry success | Answer drill correctly | Progress to next step, drill counter resets |
| Drill retry failure | Fail both drill attempts | Tag marked as "Нужно повторить", can continue to next step |
| Drill generation | Backend generates drill question | New question with same tag, different content |

#### D. Assistant Chat

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Send message in chat | Type question, send | Receives coherent Russian response from GigaChat |
| Conversation context | Send follow-up question | Response considers previous messages |
| Error handling | Trigger timeout/error | User sees friendly error message, not crash |

#### E. Resilience and Error Handling

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| GigaChat token expiry | Wait for token to expire, make request | Token refreshes automatically, request succeeds |
| GigaChat API error | Simulate 500 error from GigaChat | User sees error toast, app doesn't crash, error logged |
| Network timeout | Simulate slow network | Request times out after 60s, user sees timeout message |
| Invalid GigaChat response | Simulate malformed JSON | Fallback content used, error logged |

### Manual Testing Checklist

**Prerequisites:**
- [ ] GigaChat credentials configured in `.env`
- [ ] Database migrated and seeded
- [ ] Application running locally

**Track Generation:**
- [ ] Upload TXT file (small, < 2KB)
- [ ] Upload DOCX file (medium, 2-5KB)
- [ ] Upload multiple files (large, > 5KB combined)
- [ ] Verify step count appropriate for KB size
- [ ] Check all steps have Russian text
- [ ] Verify roleplay steps included
- [ ] Check tags assigned to steps

**Answer Evaluation:**
- [ ] Submit correct quiz answer
- [ ] Submit wrong quiz answer
- [ ] Submit good open answer (should score 8-10)
- [ ] Submit poor open answer (should score 3-5)
- [ ] Submit roleplay answer
- [ ] Verify feedback displays correctly
- [ ] Check missing points and example phrases shown

**Error Scenarios:**
- [ ] Stop GigaChat API (simulate downtime)
- [ ] Create track -> verify fallback content generated
- [ ] Evaluate answer -> verify safe default evaluation
- [ ] Check error toast displayed to user
- [ ] Check server logs contain error details

**Performance:**
- [ ] Track generation completes in < 30 seconds for 5KB KB
- [ ] Answer evaluation completes in < 10 seconds
- [ ] No memory leaks during extended usage
- [ ] Token refresh happens seamlessly

### Automated Testing Strategy

**Unit Tests:**
- GigaChat client authentication
- Token caching and refresh logic
- Error handling for different HTTP status codes
- Response parsing and validation
- Fallback content generation

**Integration Tests:**
- End-to-end track generation flow
- End-to-end answer evaluation flow
- Database operations (saving steps, drill attempts)
- Conversation history management

**Load Tests:**
- Concurrent track generation requests
- Sustained answer evaluation load
- Token refresh under concurrent load

**Not in scope for initial implementation** (future work)

## Phase 7: Deployment and Rollout

### Environment Configuration

**Production Environment Variables:**
```
GIGACHAT_CLIENT_ID=<production_client_id>
GIGACHAT_CLIENT_SECRET=<production_secret>
GIGACHAT_SCOPE=GIGACHAT_API_PERS
GIGACHAT_MODEL=GigaChat
GIGACHAT_TIMEOUT_MS=60000
DATABASE_URL=<production_db_url>
SESSION_SECRET=<production_secret>
NODE_ENV=production
```

**Staging Environment:**
- Use separate GigaChat credentials for staging (if available)
- Test with production-like data volume
- Verify network connectivity to GigaChat from deployment region

### Migration Strategy

**Option 1: Big Bang (Recommended for P0)**
1. Deploy all changes at once
2. Remove Replit AI completely
3. Switch to GigaChat for all operations
4. Rollback plan: Revert to previous deployment if critical issues

**Option 2: Gradual Migration**
1. Deploy GigaChat client alongside OpenAI
2. Route subset of requests to GigaChat (e.g., 10%)
3. Monitor error rates and response quality
4. Gradually increase GigaChat traffic
5. Remove OpenAI when GigaChat at 100%

**Recommendation:** Use Option 1 for simplicity, given requirement to remove ALL Replit AI

### Monitoring and Alerting

**Key Metrics to Track:**
| Metric | Threshold | Alert Condition |
|--------|-----------|-----------------|
| GigaChat API error rate | < 5% | Alert if > 10% |
| Token refresh failures | 0 | Alert on any failure |
| Track generation success rate | > 95% | Alert if < 90% |
| Average evaluation time | < 10s | Alert if > 20s |
| Fallback content usage rate | < 5% | Alert if > 15% |

**Log Events to Monitor:**
- All GigaChat API calls (request, response, duration)
- Token refresh operations
- Fallback content generation
- All errors with full stack traces
- User-facing errors (toast messages)

### Rollback Plan

**Trigger Conditions:**
- GigaChat API unavailable for > 30 minutes
- Error rate > 25% for > 10 minutes
- Critical data corruption detected
- Security vulnerability discovered

**Rollback Steps:**
1. Deploy previous version from git tag
2. Restore database from backup (if schema changed)
3. Verify core flows working
4. Notify users of temporary rollback
5. Investigate issues in staging environment

### Documentation Updates

**Update these files:**
- `README.md`: Replace OpenAI setup with GigaChat setup instructions
- `DATABASE_SETUP.md`: No changes needed (DB schema unchanged)
- `.env.example`: Updated with GigaChat variables (done in Phase 2)
- Create `docs/GIGACHAT_INTEGRATION.md`: Detailed API documentation

**Documentation Content:**
- GigaChat authentication flow
- Token caching mechanism
- Error handling patterns
- Retry logic explanation
- Monitoring and debugging guide
- Troubleshooting common issues

## Risk Assessment and Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| GigaChat API differences from OpenAI | High | Medium | Thorough testing, fallback mechanisms, documented differences |
| Token refresh failures | High | Low | Retry logic, alerting, manual refresh endpoint |
| Response quality degradation | Medium | Medium | Careful prompt engineering, A/B testing, user feedback collection |
| Rate limiting issues | Medium | Low | Exponential backoff, request queuing, monitoring |
| Network instability in Russia | High | Low | Timeout configuration, retry logic, user-facing error messages |
| JSON parsing failures | Low | Low | Strict validation, fallback responses, error logging |

## Success Criteria

**Technical:**
- [ ] Zero Replit AI dependencies in codebase
- [ ] All AI operations use GigaChat
- [ ] No secrets exposed in frontend bundle
- [ ] Error rate < 5% in production
- [ ] All existing tests passing

**Product:**
- [ ] Track generation creates 6-12 modules for large KB (not 3 questions)
- [ ] Evaluation provides detailed feedback (score, missing points, examples)
- [ ] Drill Mode logic supported by backend (even if UI incomplete)
- [ ] No silent failures: all errors visible to users
- [ ] App works in Russia without VPN

**Business:**
- [ ] No user-reported critical bugs in first week
- [ ] Curator and employee flows work end-to-end
- [ ] Response times acceptable (< 30s for generation, < 10s for evaluation)
- [ ] Cost of GigaChat API within budget

## Out of Scope

**Explicitly NOT included in this design:**
- SaluteSpeech integration for TTS
- Voice input enhancements beyond existing Web Speech API
- Frontend Drill Mode UI components (backend ready, UI future work)
- Drill question pre-generation during track creation
- A/B testing between different prompts
- Multi-language support (only Russian)
- Admin dashboard for monitoring AI usage
- Cost optimization strategies
- Performance benchmarking tools

## Appendix: GigaChat API Reference

### Authentication Endpoint

**URL:** `POST https://ngw.devices.sberbank.ru:9443/api/v2/oauth`

**Headers:**
- `Authorization: Basic <base64(client_id:client_secret)>`
- `RqUID: <uuid_v4>`
- `Content-Type: application/x-www-form-urlencoded`

**Body:**
```
scope=<GIGACHAT_SCOPE>
```

**Response:**
```json
{
  "access_token": "string",
  "expires_at": 1234567890
}
```

### Chat Completions Endpoint

**URL:** `POST https://gigachat.devices.sberbank.ru/api/v1/chat/completions`

**Headers:**
- `Authorization: Bearer <access_token>`
- `Content-Type: application/json`

**Request Body:**
```json
{
  "model": "GigaChat",
  "messages": [
    {"role": "system", "content": "System prompt"},
    {"role": "user", "content": "User message"}
  ],
  "temperature": 0.7,
  "max_tokens": 2000
}
```

**Response:**
```json
{
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "Generated response"
      },
      "index": 0,
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 50,
    "completion_tokens": 100,
    "total_tokens": 150
  }
}
```

### Streaming Support

**Check GigaChat documentation** for streaming capabilities. If supported:
- Add `"stream": true` to request body
- Handle Server-Sent Events (SSE) response
- Parse data chunks incrementally

## Next Steps After This Design

1. **Review and Approval**: Product team, engineering lead, security team review this design
2. **Implementation**: Follow phases 1-6 sequentially
3. **Testing**: Execute QA checklist thoroughly
4. **Deployment**: Deploy to staging, then production
5. **Monitoring**: Watch key metrics for 1 week post-deployment
6. **Iteration**: Collect feedback, optimize prompts, improve error handling
7. **Future Work**: Implement SaluteSpeech, complete Drill Mode UI, pre-generate drills

1. **Security First**: No secrets in frontend bundle; all AI operations server-side only
2. **Reliability**: No silent failures; all errors visible to users via toasts and logged on server
3. **Stability**: Must work in Russia without VPN using GigaChat API
4. **Contract Preservation**: Keep existing frontend API contracts unchanged
5. **Strict Mode Compliance**: Respect knowledge base boundaries when strictMode is enabled

## Phase 1: Audit and Mapping

### Current AI Integration Points

| Location | Current Implementation | Purpose | Input Contract | Output Contract |
|----------|----------------------|---------|----------------|-----------------|
| `server/routes.ts:38-167` | `generateTrackContent()` using OpenAI | Generate course structure from knowledge base | `title: string, knowledgeBase: string, strictMode: boolean` | `Array<{type, tag, content, orderIndex}>` |
| `server/routes.ts:454-519` | `/api/evaluate-answer` using OpenAI | Evaluate open/roleplay answers | `{question, userAnswer, idealAnswer?, context?}` | `{score: 0-10, feedback: string, isCorrect: boolean, improvements: string\|null}` |
| `server/replit_integrations/chat/routes.ts:62-117` | `/api/conversations/:id/messages` using OpenAI | Assistant chat (SSE streaming) | `{conversationId: number, content: string}` | SSE stream of message chunks |
| `server/routes.ts:33-36` | OpenAI client initialization | N/A | Environment variables | OpenAI client instance |

### AI Tasks Requiring GigaChat

1. **Track Generation**: Create multi-module course structure from uploaded knowledge base files
2. **Answer Evaluation**: Score and provide feedback on open-ended and roleplay answers
3. **Assistant Chat**: Conversational Q&A support (currently implemented, must preserve)
4. **Drill Generation**: Generate similar questions by tag (not yet implemented in codebase, mentioned in requirements)

### Dependencies to Remove

| Dependency | Type | Current Usage | Action |
|------------|------|---------------|--------|
| `openai` package | Runtime | All LLM calls | Keep (can be used for GigaChat OpenAI-compatible endpoint if available, or replace) |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | Environment | Authentication | Replace with GigaChat credentials |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | Environment | API endpoint | Replace with GigaChat endpoint |
| `server/replit_integrations/` directory | Code structure | Chat routes, batch utils, image generation | Remove image routes; refactor chat to use GigaChat |

## Phase 2: Remove Replit AI Dependencies

### Environment Variables Cleanup

Update `.env.example` to remove Replit-specific variables and prepare for GigaChat:

**Remove:**
- Any Replit AI keys or references

**Update section:**
```
# AI Integration - GigaChat (Sber)
GIGACHAT_CLIENT_ID=your-gigachat-client-id
GIGACHAT_CLIENT_SECRET=your-gigachat-client-secret
GIGACHAT_SCOPE=GIGACHAT_API_PERS
GIGACHAT_MODEL=GigaChat
GIGACHAT_TIMEOUT_MS=60000
```

### Code Removal Strategy

| File/Directory | Action | Rationale |
|----------------|--------|-----------|
| `server/replit_integrations/image/*` | Delete entirely | Image generation not in scope; not used in core flows |
| `server/replit_integrations/batch/*` | Evaluate and possibly keep | Generic batch processing utils may be useful for future multi-step operations |
| `server/replit_integrations/chat/*` | Refactor into `server/ai/chat.ts` | Chat functionality needed, but should use GigaChat not OpenAI |
| OpenAI client in `server/routes.ts` | Replace with GigaChat client | Core LLM operations |

### Package Dependencies

**Evaluate `openai` package:**
- If GigaChat supports OpenAI-compatible API: Keep package, change base URL
- If GigaChat requires custom client: Remove `openai` from `package.json` and implement custom HTTP client

**Keep these packages** (generic utilities):
- `p-limit`, `p-retry` (for rate limiting and retries)

## Phase 3: Implement GigaChat Client

### Server Module Structure

Create new module: `server/ai/gigachat.ts`

### GigaChat Authentication Flow

GigaChat uses OAuth 2.0 with these characteristics:
- **Token Endpoint**: `https://ngw.devices.sberbank.ru:9443/api/v2/oauth`
- **Authentication**: Basic Auth with `base64(client_id:client_secret)`
- **Request ID**: Each request requires unique `RqUID` header (UUID v4)
- **Token Caching**: Access tokens have expiry time; must cache and refresh automatically
- **Scope**: Specified in request body (from environment variable)

### Authentication Module Design

**Token Management:**
- In-memory cache for access token
- Store token with expiry timestamp
- Automatic refresh when token expires or on 401 error
- Thread-safe token refresh (prevent multiple simultaneous refresh requests)

**Token Refresh Logic:**
```
1. Check if cached token exists and is not expired
2. If valid: return cached token
3. If invalid or missing:
   a. Acquire lock (prevent concurrent refreshes)
   b. Re-check cache (another request may have refreshed)
   c. Make OAuth request to GigaChat
   d. Parse response and extract access_token and expires_in
   e. Calculate expiry timestamp (now + expires_in - safety margin)
   f. Cache token with expiry
   g. Release lock
   h. Return token
```

### Chat Completions Flow

**Endpoint**: `https://gigachat.devices.sberbank.ru/api/v1/chat/completions`

**Request Headers:**
- `Authorization: Bearer <access_token>`
- `Content-Type: application/json`

**Request Body:**
```
{
  "model": "<from_env_GIGACHAT_MODEL>",
  "messages": [
    {"role": "system", "content": "..."},
    {"role": "user", "content": "..."},
    {"role": "assistant", "content": "..."}
  ],
  "temperature": <float>,
  "max_tokens": <integer>
}
```

**Response:**
```
{
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "<response_text>"
      },
      "index": 0,
      "finish_reason": "stop"
    }
  ],
  "usage": {...}
}
```

### Error Handling Strategy

| Error Type | Detection | Handling |
|------------|-----------|----------|
| Token expiry | 401 status code | Refresh token once and retry request |
| Rate limiting | 429 status code | Exponential backoff with retry (max 3 attempts) |
| Timeout | Request exceeds GIGACHAT_TIMEOUT_MS | Return graceful error to client with message |
| Network error | Connection failure | Log error, return user-friendly message |
| Invalid response | Malformed JSON or missing fields | Use fallback response, log error |

### Client Interface Design

**Module exports:**

```
interface GigaChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface GigaChatCompletionOptions {
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
}

interface GigaChatResponse {
  content: string;
  finishReason: string;
}

interface GigaChatError {
  code: string;
  message: string;
  userMessage: string; // Safe message for frontend display
}

async function getChatCompletion(
  messages: GigaChatMessage[],
  options?: GigaChatCompletionOptions
): Promise<GigaChatResponse>

async function getChatCompletionStream(
  messages: GigaChatMessage[],
  onChunk: (chunk: string) => void,
  options?: GigaChatCompletionOptions
): Promise<void>
```

### Retry and Timeout Configuration

**Retry logic:**
- Max retries: 3
- Retry conditions: 401 (after token refresh), 429 (rate limit), 5xx (server errors)
- Backoff strategy: Exponential (1s, 2s, 4s)
- Abort conditions: 400 (bad request), 403 (forbidden), 404 (not found)

**Timeout handling:**
- Default timeout: 60 seconds (from environment)
- Applied to each HTTP request
- On timeout: Log detailed error, return structured error object

## Phase 4: Backend Endpoint Implementation

### Endpoint 1: Chat Assistant

**Route:** `POST /api/ai/chat`

**Purpose:** General-purpose conversational AI for employee questions

**Input Schema:**
```
{
  conversationId?: number,  // Optional: for conversation history context
  messages: Array<{role: 'system' | 'user' | 'assistant', content: string}>,
  context?: string          // Optional: additional context (e.g., current course info)
}
```

**Output Schema:**
```
{
  reply: string,
  conversationId?: number   // If conversation was created/updated
}
```

**Implementation Notes:**
- If `conversationId` provided: Load conversation history from database, append to messages
- Construct system prompt: "Ты - помощник в обучающей платформе ADAPT. Отвечай на русском языке..."
- Call `getChatCompletion()` with messages
- Save user message and assistant reply to database (if conversationId exists)
- Return assistant's reply

**Error Handling:**
- GigaChat timeout: Return `{reply: "Извините, не удалось получить ответ. Попробуйте ещё раз.", error: true}`
- GigaChat error: Log full error, return safe message
- Display error toast on frontend

### Endpoint 2: Generate Track

**Route:** `POST /api/ai/generate-track` (or keep existing `POST /api/tracks/generate`)

**Purpose:** Generate multi-module course structure from knowledge base

**Input Schema:**
```
{
  title: string,
  description?: string,
  strictMode: boolean,
  rawKnowledgeBase: string,
  existingStructure?: any   // For regeneration/editing
}
```

**Output Schema:**
```
{
  trackOutline: {
    modules: Array<{
      title: string,
      steps: Array<{
        type: 'content' | 'quiz' | 'open' | 'roleplay',
        tag?: string,
        content: object,      // Matches current steps.content JSON structure
        orderIndex: number
      }>
    }>
  }
}
```

**System Prompt Strategy:**

The prompt must address the critical product requirement: **generate comprehensive multi-module structure, NOT just 3 questions**.

**Prompt structure:**
1. Role definition: Expert Russian-language course creator
2. Task: Create full multi-module course covering ALL major themes from knowledge base
3. Scale guidelines based on KB size:
   - KB > 5000 chars: 6-12 modules, 15-25 total steps
   - KB 2000-5000 chars: 4-8 modules, 10-15 total steps
   - KB < 2000 chars: 3-5 modules, 6-10 total steps
4. Strict mode instruction: If `strictMode === true`, use ONLY information from KB; do not invent facts
5. Step types distribution:
   - Each module: 2-4 content steps + 1-2 quiz/open questions
   - 2-3 roleplay scenarios distributed across course
6. Tag requirement: Each step must have unique tag (theme identifier)
7. Content format specifications for each step type (quiz, open, roleplay, content)
8. Output format: JSON object with "steps" array

**Strict Mode Handling:**
- When `strictMode === true`: Add explicit instruction "Используй СТРОГО ТОЛЬКО информацию из базы знаний. Если информации недостаточно, упомяни это в content, но не выдумывай факты."
- When `strictMode === false`: Allow AI to supplement with general knowledge

**Response Parsing:**
- Parse JSON response from GigaChat
- Validate structure: must be array of step objects
- Validate each step has required fields: type, content, orderIndex
- Assign tags if missing
- Ensure at least one roleplay step exists (add fallback if missing)
- Return steps array

**Fallback Strategy:**
- If GigaChat fails: Use `getFallbackContent()` function (already exists in codebase)
- Fallback generates 4-6 basic steps from KB text
- Log error for monitoring

**Integration Point:**
- Replace `generateTrackContent()` function in `server/routes.ts`
- Keep existing endpoint `/api/tracks/generate` (POST with file upload)
- Steps are saved to database using existing `storage.createSteps()` method

### Endpoint 3: Evaluate Answer

**Route:** `POST /api/ai/evaluate-answer`

**Purpose:** Score and provide detailed feedback on open-ended and roleplay answers

**Input Schema:**
```
{
  step: {
    type: 'quiz' | 'open' | 'roleplay',
    tag?: string,
    content: object
  },
  userAnswer: string,
  strictMode: boolean,
  rawKnowledgeBase?: string
}
```

**Output Schema (Enhanced for Drill Mode):**
```
{
  isCorrect: boolean,           // true if score >= 6
  score_0_10: number,           // 0-10 scale
  whyWrong: string,             // Explanation of errors
  idealAnswer: string,          // Example of good answer
  missingPoints: string[],      // 2-4 key points user missed
  examplePhrases: string[]      // 1-2 example phrases for improvement
}
```

**System Prompt Strategy:**

**Role:** Strict evaluator of learning responses

**Instructions:**
1. Evaluate user answer against ideal answer and context
2. Score on 0-10 scale:
   - 0-3: Wrong or off-topic
   - 4-5: Partially correct with major gaps
   - 6-7: Mostly correct with minor issues
   - 8-9: Good answer with small improvements possible
   - 10: Perfect answer
3. Identify missing key points (2-4 bullets)
4. Provide 1-2 example phrases for improvement
5. Output ONLY valid JSON in specified format

**Strict Mode Application:**
- If `strictMode === true` AND `rawKnowledgeBase` provided: Include KB excerpt in prompt
- Add instruction: "Оценивай только на основе информации из базы знаний. Если пользователь упомянул факты вне базы, отметь это как ошибку."
- If user answer cannot be evaluated against KB: Return `whyWrong: "В базе знаний нет достаточно информации для оценки этого ответа. Вопрос передан куратору."`

**Response Parsing:**
- Parse JSON response
- Validate all required fields present
- Calculate `isCorrect` from score (>= 6)
- Ensure `missingPoints` is array with 2-4 items
- Ensure `examplePhrases` is array with 1-2 items
- Return structured evaluation

**Error Handling:**
- On GigaChat failure: Return safe default evaluation:
  ```
  {
    isCorrect: true,
    score_0_10: 5,
    whyWrong: "",
    idealAnswer: step.content.ideal_answer || "Ответ принят",
    missingPoints: [],
    examplePhrases: []
  }
  ```
- Log error for monitoring
- Display toast: "Оценка выполнена с ограничениями из-за технической ошибки"

**Integration:**
- Replace existing `/api/evaluate-answer` handler in `server/routes.ts`
- Keep same route path
- Frontend call site: `client/src/pages/employee/player.tsx:239`
- No frontend changes required (contract preserved)

### Endpoint 4: Generate Drill Question

**Route:** `POST /api/ai/generate-drill`

**Purpose:** Create a new practice question similar to failed step, by tag/theme

**Input Schema:**
```
{
  tag: string,                  // Theme/skill tag (e.g., "Возражения")
  stepType: 'quiz' | 'open' | 'roleplay',
  rawKnowledgeBase?: string,
  strictMode: boolean
}
```

**Output Schema:**
```
{
  drillStep: {
    type: 'quiz' | 'open' | 'roleplay',
    tag: string,
    content: object             // Same format as regular step content
  }
}
```

**System Prompt Strategy:**

**Role:** Creator of practice questions for skill reinforcement

**Instructions:**
1. Generate a NEW question on the same theme (tag) as failed step
2. Question should test same skill but with different scenario/wording
3. Difficulty should be similar or slightly easier than original
4. Output format must match step type (quiz with options, open with key_points, roleplay with scenario)
5. Ensure content is in Russian

**Step Type Templates:**

**Quiz:**
```
{
  "question": "Вопрос по теме {tag}?",
  "options": ["Вариант 1", "Вариант 2", "Вариант 3", "Вариант 4"],
  "correctIndex": 0,
  "explanation": "Объяснение правильного ответа"
}
```

**Open:**
```
{
  "question": "Развёрнутый вопрос по теме {tag}?",
  "ideal_answer": "Образец хорошего ответа",
  "key_points": ["ключевой момент 1", "ключевой момент 2"]
}
```

**Roleplay:**
```
{
  "scenario": "Рабочая ситуация по теме {tag}...",
  "context": "Контекст задачи",
  "ideal_answer": "Пример профессионального ответа"
}
```

**Strict Mode:**
- If `strictMode === true`: Use only KB content for question generation
- If KB lacks sufficient info for drill: Return error `{error: "Недостаточно информации в базе знаний для генерации дрилла"}`

**Response Validation:**
- Verify generated step has correct type
- Verify content object has all required fields for step type
- Assign tag from input
- Return drillStep object

**Integration Strategy:**
- Create new endpoint (not currently in codebase)
- This endpoint will be called by Drill Mode logic (mentioned in requirements but not yet fully implemented)
- Frontend integration point: When user fails quiz/open/roleplay with score < 6, trigger drill generation
- After generation, display drill question to user for practice attempt

**Future Enhancement:**
- Drill Mode may require additional frontend components (not in scope for this design)
- Backend endpoint must be ready to support Drill Mode when frontend is implemented

## Phase 5: Integration with Existing Flows

### Track Generation Flow

**Current Flow:**
1. Curator uploads files via `POST /api/tracks/generate`
2. Files extracted to text using `extractTextFromFile()`
3. Combined text stored in `tracks.raw_knowledge_base`
4. `generateTrackContent()` called to create steps
5. Steps saved to database with `storage.createSteps()`
6. Response: `{track, steps}`

**Updated Flow:**
1. Keep file upload and extraction logic unchanged
2. Replace `generateTrackContent()` internal implementation:
   - Use GigaChat client instead of OpenAI
   - Enhanced prompt for multi-module generation
   - Same output format (steps array)
3. Database save logic unchanged
4. Same response contract

**No Frontend Changes Required**

### Answer Evaluation Flow

**Current Flow:**
1. Employee submits answer in player: `client/src/pages/employee/player.tsx`
2. Frontend calls `POST /api/evaluate-answer`
3. Backend evaluates with OpenAI
4. Returns `{score, feedback, isCorrect, improvements}`
5. Frontend displays feedback card
6. Records drill attempt with `storage.createDrillAttempt()`

**Updated Flow:**
1. Keep frontend logic unchanged
2. Replace backend OpenAI call with GigaChat
3. Enhanced evaluation response with additional fields:
   - `whyWrong`: Specific explanation of errors
   - `idealAnswer`: Example of good answer
   - `missingPoints`: Array of missing key points
   - `examplePhrases`: Array of improvement suggestions
4. Frontend can optionally use new fields for richer feedback
5. Drill attempt recording unchanged

**Frontend Enhancement (Optional):**
- Display `missingPoints` as bullet list
- Display `examplePhrases` as highlighted examples
- Show `idealAnswer` in expandable section

### Assistant Chat Flow

**Current Flow:**
1. Chat interface (if exists) sends message
2. Backend routes to `/api/conversations/:id/messages`
3. OpenAI streaming response (SSE)
4. Response chunks sent to frontend
5. Message saved to database

**Updated Flow:**
1. Keep conversation database structure
2. Replace OpenAI streaming with GigaChat streaming
3. GigaChat may support streaming (check API docs)
4. If streaming not supported: Send complete response at once
5. Update SSE format if necessary
6. Maintain conversation history in database

**Implementation Decision:**
- If GigaChat supports streaming: Use `getChatCompletionStream()`
- If not: Use `getChatCompletion()` and send single SSE event with full response
- Frontend must handle both streaming and non-streaming modes gracefully

### Database Schema Updates

**No schema changes required** for basic migration.

**Optional Enhancement for Drill Mode:**
- Add `drillSteps` table to store generated drill questions:
  ```
  drillSteps:
    id: serial
    trackId: integer
    originalStepId: integer
    tag: string
    type: string
    content: jsonb
    createdAt: timestamp
  ```
- Allows caching of drill questions to reduce API calls
- Can pre-generate drills during track creation
- Not required for Phase 1 (P0)

## Phase 6: Testing and Quality Assurance

### Acceptance Criteria

#### A. Curator Flow

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Create track with large KB | 1. Login as curator<br>2. Upload 10+ page document<br>3. Submit track creation | 1. Track created successfully<br>2. At least 15 steps generated<br>3. Multiple modules covering different themes<br>4. 2-3 roleplay scenarios included |
| Create track with small KB | Upload 2-page document | 6-10 steps generated, at least 1 roleplay |
| Track opens and renders | Navigate to created track | 1. All steps visible<br>2. Steps have correct types (content/quiz/open/roleplay)<br>3. Content renders properly |
| Strict mode respected | Create track with strictMode=true | Generated questions only reference KB content, no invented facts |

#### B. Employee Flow

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Join by code | Enter valid join code | Enrollment created, redirected to course player |
| Answer quiz correctly | Select correct option, submit | Feedback shows "Правильно!", can proceed to next step |
| Answer quiz incorrectly | Select wrong option, submit | Feedback shows correct answer, score recorded |
| Answer open question | Type answer, submit | Evaluation returns score 0-10, feedback displayed |
| Answer roleplay | Record voice or type answer, submit | Evaluation with detailed feedback (score, missing points, examples) |
| Progress tracking | Complete several steps | Progress percentage updates, lastStepIndex saved |

#### C. Drill Mode Flow

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Drill triggered on wrong answer | Fail quiz/open/roleplay | 1. Compact feedback shown<br>2. Drill attempt counter visible<br>3. Can retry (if drillAttempt < 2) |
| Drill retry success | Answer drill correctly | Progress to next step, drill counter resets |
| Drill retry failure | Fail both drill attempts | Tag marked as "Нужно повторить", can continue to next step |
| Drill generation | Backend generates drill question | New question with same tag, different content |

#### D. Assistant Chat

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Send message in chat | Type question, send | Receives coherent Russian response from GigaChat |
| Conversation context | Send follow-up question | Response considers previous messages |
| Error handling | Trigger timeout/error | User sees friendly error message, not crash |

#### E. Resilience and Error Handling

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| GigaChat token expiry | Wait for token to expire, make request | Token refreshes automatically, request succeeds |
| GigaChat API error | Simulate 500 error from GigaChat | User sees error toast, app doesn't crash, error logged |
| Network timeout | Simulate slow network | Request times out after 60s, user sees timeout message |
| Invalid GigaChat response | Simulate malformed JSON | Fallback content used, error logged |

### Manual Testing Checklist

**Prerequisites:**
- [ ] GigaChat credentials configured in `.env`
- [ ] Database migrated and seeded
- [ ] Application running locally

**Track Generation:**
- [ ] Upload TXT file (small, < 2KB)
- [ ] Upload DOCX file (medium, 2-5KB)
- [ ] Upload multiple files (large, > 5KB combined)
- [ ] Verify step count appropriate for KB size
- [ ] Check all steps have Russian text
- [ ] Verify roleplay steps included
- [ ] Check tags assigned to steps

**Answer Evaluation:**
- [ ] Submit correct quiz answer
- [ ] Submit wrong quiz answer
- [ ] Submit good open answer (should score 8-10)
- [ ] Submit poor open answer (should score 3-5)
- [ ] Submit roleplay answer
- [ ] Verify feedback displays correctly
- [ ] Check missing points and example phrases shown

**Error Scenarios:**
- [ ] Stop GigaChat API (simulate downtime)
- [ ] Create track -> verify fallback content generated
- [ ] Evaluate answer -> verify safe default evaluation
- [ ] Check error toast displayed to user
- [ ] Check server logs contain error details

**Performance:**
- [ ] Track generation completes in < 30 seconds for 5KB KB
- [ ] Answer evaluation completes in < 10 seconds
- [ ] No memory leaks during extended usage
- [ ] Token refresh happens seamlessly

### Automated Testing Strategy

**Unit Tests:**
- GigaChat client authentication
- Token caching and refresh logic
- Error handling for different HTTP status codes
- Response parsing and validation
- Fallback content generation

**Integration Tests:**
- End-to-end track generation flow
- End-to-end answer evaluation flow
- Database operations (saving steps, drill attempts)
- Conversation history management

**Load Tests:**
- Concurrent track generation requests
- Sustained answer evaluation load
- Token refresh under concurrent load

**Not in scope for initial implementation** (future work)

## Phase 7: Deployment and Rollout

### Environment Configuration

**Production Environment Variables:**
```
GIGACHAT_CLIENT_ID=<production_client_id>
GIGACHAT_CLIENT_SECRET=<production_secret>
GIGACHAT_SCOPE=GIGACHAT_API_PERS
GIGACHAT_MODEL=GigaChat
GIGACHAT_TIMEOUT_MS=60000
DATABASE_URL=<production_db_url>
SESSION_SECRET=<production_secret>
NODE_ENV=production
```

**Staging Environment:**
- Use separate GigaChat credentials for staging (if available)
- Test with production-like data volume
- Verify network connectivity to GigaChat from deployment region

### Migration Strategy

**Option 1: Big Bang (Recommended for P0)**
1. Deploy all changes at once
2. Remove Replit AI completely
3. Switch to GigaChat for all operations
4. Rollback plan: Revert to previous deployment if critical issues

**Option 2: Gradual Migration**
1. Deploy GigaChat client alongside OpenAI
2. Route subset of requests to GigaChat (e.g., 10%)
3. Monitor error rates and response quality
4. Gradually increase GigaChat traffic
5. Remove OpenAI when GigaChat at 100%

**Recommendation:** Use Option 1 for simplicity, given requirement to remove ALL Replit AI

### Monitoring and Alerting

**Key Metrics to Track:**
| Metric | Threshold | Alert Condition |
|--------|-----------|-----------------|
| GigaChat API error rate | < 5% | Alert if > 10% |
| Token refresh failures | 0 | Alert on any failure |
| Track generation success rate | > 95% | Alert if < 90% |
| Average evaluation time | < 10s | Alert if > 20s |
| Fallback content usage rate | < 5% | Alert if > 15% |

**Log Events to Monitor:**
- All GigaChat API calls (request, response, duration)
- Token refresh operations
- Fallback content generation
- All errors with full stack traces
- User-facing errors (toast messages)

### Rollback Plan

**Trigger Conditions:**
- GigaChat API unavailable for > 30 minutes
- Error rate > 25% for > 10 minutes
- Critical data corruption detected
- Security vulnerability discovered

**Rollback Steps:**
1. Deploy previous version from git tag
2. Restore database from backup (if schema changed)
3. Verify core flows working
4. Notify users of temporary rollback
5. Investigate issues in staging environment

### Documentation Updates

**Update these files:**
- `README.md`: Replace OpenAI setup with GigaChat setup instructions
- `DATABASE_SETUP.md`: No changes needed (DB schema unchanged)
- `.env.example`: Updated with GigaChat variables (done in Phase 2)
- Create `docs/GIGACHAT_INTEGRATION.md`: Detailed API documentation

**Documentation Content:**
- GigaChat authentication flow
- Token caching mechanism
- Error handling patterns
- Retry logic explanation
- Monitoring and debugging guide
- Troubleshooting common issues

## Risk Assessment and Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| GigaChat API differences from OpenAI | High | Medium | Thorough testing, fallback mechanisms, documented differences |
| Token refresh failures | High | Low | Retry logic, alerting, manual refresh endpoint |
| Response quality degradation | Medium | Medium | Careful prompt engineering, A/B testing, user feedback collection |
| Rate limiting issues | Medium | Low | Exponential backoff, request queuing, monitoring |
| Network instability in Russia | High | Low | Timeout configuration, retry logic, user-facing error messages |
| JSON parsing failures | Low | Low | Strict validation, fallback responses, error logging |

## Success Criteria

**Technical:**
- [ ] Zero Replit AI dependencies in codebase
- [ ] All AI operations use GigaChat
- [ ] No secrets exposed in frontend bundle
- [ ] Error rate < 5% in production
- [ ] All existing tests passing

**Product:**
- [ ] Track generation creates 6-12 modules for large KB (not 3 questions)
- [ ] Evaluation provides detailed feedback (score, missing points, examples)
- [ ] Drill Mode logic supported by backend (even if UI incomplete)
- [ ] No silent failures: all errors visible to users
- [ ] App works in Russia without VPN

**Business:**
- [ ] No user-reported critical bugs in first week
- [ ] Curator and employee flows work end-to-end
- [ ] Response times acceptable (< 30s for generation, < 10s for evaluation)
- [ ] Cost of GigaChat API within budget

## Out of Scope

**Explicitly NOT included in this design:**
- SaluteSpeech integration for TTS
- Voice input enhancements beyond existing Web Speech API
- Frontend Drill Mode UI components (backend ready, UI future work)
- Drill question pre-generation during track creation
- A/B testing between different prompts
- Multi-language support (only Russian)
- Admin dashboard for monitoring AI usage
- Cost optimization strategies
- Performance benchmarking tools

## Appendix: GigaChat API Reference

### Authentication Endpoint

**URL:** `POST https://ngw.devices.sberbank.ru:9443/api/v2/oauth`

**Headers:**
- `Authorization: Basic <base64(client_id:client_secret)>`
- `RqUID: <uuid_v4>`
- `Content-Type: application/x-www-form-urlencoded`

**Body:**
```
scope=<GIGACHAT_SCOPE>
```

**Response:**
```json
{
  "access_token": "string",
  "expires_at": 1234567890
}
```

### Chat Completions Endpoint

**URL:** `POST https://gigachat.devices.sberbank.ru/api/v1/chat/completions`

**Headers:**
- `Authorization: Bearer <access_token>`
- `Content-Type: application/json`

**Request Body:**
```json
{
  "model": "GigaChat",
  "messages": [
    {"role": "system", "content": "System prompt"},
    {"role": "user", "content": "User message"}
  ],
  "temperature": 0.7,
  "max_tokens": 2000
}
```

**Response:**
```json
{
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "Generated response"
      },
      "index": 0,
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 50,
    "completion_tokens": 100,
    "total_tokens": 150
  }
}
```

### Streaming Support

**Check GigaChat documentation** for streaming capabilities. If supported:
- Add `"stream": true` to request body
- Handle Server-Sent Events (SSE) response
- Parse data chunks incrementally

## Next Steps After This Design

1. **Review and Approval**: Product team, engineering lead, security team review this design
2. **Implementation**: Follow phases 1-6 sequentially
3. **Testing**: Execute QA checklist thoroughly
4. **Deployment**: Deploy to staging, then production
5. **Monitoring**: Watch key metrics for 1 week post-deployment
6. **Iteration**: Collect feedback, optimize prompts, improve error handling
7. **Future Work**: Implement SaluteSpeech, complete Drill Mode UI, pre-generate drills
