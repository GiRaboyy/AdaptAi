# GigaChat Integration: Remove Replit AI & Implement Enterprise Course Generation

## 1. Executive Overview

### 1.1 Objective

Complete migration from Replit AI to GigaChat as the sole text-based LLM provider for the ADAPT employee onboarding platform, with focus on:

- **Anti-hallucination**: Strict knowledge base grounding with KB_GAP detection
- **Big Course Generation**: Multi-module courses (8–12 modules, 50+ steps) from large KB (2MB+)
- **Semantic Grading**: Synonym-aware evaluation with partial credit and source citations
- **File Format Support**: PDF, DOC/DOCX, and image uploads with proper extraction
- **Reliability**: Resilient API integration with retry logic and structured error handling

### 1.2 Success Criteria

| Criterion | Target |
|-----------|--------|
| Replit AI dependencies | Zero references, build passes |
| Course generation quality | 8–12 modules with 50+ steps for large KB |
| Topic coverage | All main themes from KB represented |
| Semantic grading accuracy | Accepts synonyms, provides partial credit |
| KB grounding | No fabricated facts when strictMode=true |
| PDF upload success rate | 100% for valid PDFs up to 20MB |
| API resilience | Automatic token refresh, 3-retry strategy |

## 2. Current State Analysis

### 2.1 Existing Replit AI Usage

**Identified Dependencies:**

| Location | Type | Status |
|----------|------|--------|
| `/server/replit_integrations/chat/` | OpenAI chat module | TO BE REMOVED |
| `/server/replit_integrations/batch/` | Batch utilities | TO BE REMOVED |
| `/server/ai/routes.ts` | Import from replit storage | TO BE REPLACED |
| `/vite.config.ts` | Replit dev plugins | TO BE RETAINED (dev only) |
| `/script/build.ts` | OpenAI dependency reference | TO BE CLEANED |

**Current GigaChat Implementation:**

- **GigaChat Client**: Already implemented in `/server/ai/gigachat.ts`
  - OAuth token management with caching
  - Self-signed certificate handling
  - Retry logic with exponential backoff
  - JSON response format support

**Current Chat Storage:**

- **Storage Module**: `/server/replit_integrations/chat/storage.ts`
  - Already uses Supabase (conversations/messages tables)
  - Interface: `IChatStorage` with CRUD operations
  - Status: **Functionally correct but in wrong directory**

### 2.2 Database Schema

**Existing Tables (Supabase Postgres):**

| Table | Purpose | Key Fields |
|-------|---------|-----------|
| users | User accounts | id, email, role, name |
| tracks | Training courses | id, curatorId, title, rawKnowledgeBase, strictMode, joinCode |
| steps | Course content units | id, trackId, type, tag, content (JSONB), orderIndex |
| enrollments | User progress | id, userId, trackId, progressPct, lastStepIndex, needsRepeatTags |
| drill_attempts | Answer evaluation history | id, userId, stepId, attemptType, isCorrect, score, userAnswer, correctAnswer, errorReason |
| conversations | Chat threads | id, title, createdAt |
| messages | Chat messages | id, conversationId, role, content, createdAt |

**Step Types:**

- **content**: Informational text with optional bullets, do/don't lists
- **quiz**: Multiple choice (4 options) with explanation
- **open**: Free-form answer with ideal_answer and key_points
- **roleplay**: Scenario-based practice with context and rubric

### 2.3 Current AI Endpoints

| Endpoint | Purpose | Status |
|----------|---------|--------|
| POST /api/ai/chat | General assistant Q&A | Uses GigaChat, needs strictMode enhancement |
| POST /api/ai/generate-drill | Drill question generation | Implemented, needs KB grounding |
| POST /api/conversations/:id/messages | Chat message handling | Uses GigaChat via storage |

**Missing Endpoints:**

- POST /api/ai/generate-track (or equivalent)
- POST /api/ai/evaluate-answer

### 2.4 File Upload Limitation

**Current Support:**

- TXT, MD: Direct buffer read
- DOCX: Mammoth extraction
- **Missing**: PDF, image formats

**Current Logic Location:** `/server/routes.ts` lines 19–32 (`extractTextFromFile`)

## 3. Architecture Design

### 3.1 High-Level Architecture

```mermaid
graph TB
    subgraph Client
        UI[React Frontend]
    end
    
    subgraph Server
        Routes[Express Routes]
        Auth[Authentication]
        AIRoutes[AI Routes Module]
        ChatStorage[Chat Storage]
        FileHandler[File Processor]
    end
    
    subgraph AI Layer
        GigaClient[GigaChat Client]
        TokenMgr[Token Manager]
        PromptEngine[Prompt Templates]
    end
    
    subgraph Data
        Supabase[(Supabase PostgreSQL)]
    end
    
    subgraph External
        GigaAPI[GigaChat API]
    end
    
    UI --> Routes
    Routes --> Auth
    Routes --> AIRoutes
    AIRoutes --> GigaClient
    AIRoutes --> ChatStorage
    AIRoutes --> FileHandler
    GigaClient --> TokenMgr
    GigaClient --> PromptEngine
    GigaClient --> GigaAPI
    ChatStorage --> Supabase
    Routes --> Supabase
    
    style GigaClient fill:#e1f5ff
    style Supabase fill:#d4edda
    style GigaAPI fill:#fff3cd
```

### 3.2 Module Organization

**Proposed Structure:**

```
server/
├── ai/
│   ├── gigachat.ts              [KEEP] Core client
│   ├── routes.ts                [MODIFY] Remove replit import
│   ├── prompts.ts               [NEW] Centralized prompt templates
│   ├── parsers.ts               [NEW] KB extraction logic
│   └── evaluator.ts             [NEW] Semantic grading engine
├── chat/
│   └── storage.ts               [MOVE] From replit_integrations/chat/storage.ts
├── replit_integrations/         [DELETE ENTIRE DIRECTORY]
├── routes.ts                    [MODIFY] Add generate-track, evaluate-answer
├── storage.ts                   [KEEP] Track/step/enrollment logic
└── ... (other files)
```

### 3.3 Data Flow Diagrams

#### 3.3.1 Course Generation Flow

```mermaid
sequenceDiagram
    actor Curator
    participant UI
    participant API as POST /api/tracks
    participant Parser as File Parser
    participant Generator as Course Generator
    participant GigaChat
    participant DB as Supabase
    
    Curator->>UI: Upload KB files (PDF/DOC)
    UI->>API: Files + metadata
    API->>Parser: Extract text from files
    Parser->>Parser: Detect file types
    Parser->>Parser: Extract text (PDF/DOCX)
    Parser-->>API: rawKnowledgeBase (string)
    
    alt Large KB (2MB+)
    API->>Generator: KB + chunking strategy
    Generator->>Generator: Create KB outline (topics)
    loop For each topic chunk
        Generator->>GigaChat: Generate module (topic subset)
        GigaChat-->>Generator: Module with steps
    end
    else Small KB
    API->>Generator: KB (full)
    Generator->>GigaChat: Generate full course
    GigaChat-->>Generator: All steps
    end
    
    Generator->>Generator: Validate structure
    Generator->>Generator: Ensure coverage
    API->>DB: Save track + steps
    DB-->>API: trackId, joinCode
    API-->>UI: Success + track details
    UI-->>Curator: Course created
```

#### 3.3.2 Answer Evaluation Flow

```mermaid
sequenceDiagram
    actor Employee
    participant UI
    participant API as POST /api/ai/evaluate-answer
    participant Evaluator as Semantic Evaluator
    participant GigaChat
    participant DB as Supabase
    
    Employee->>UI: Submit answer (open/roleplay)
    UI->>API: step, userAnswer, KB, strictMode
    API->>Evaluator: Prepare evaluation prompt
    Evaluator->>Evaluator: Extract KB context
    Evaluator->>GigaChat: Prompt with KB + rubric
    GigaChat-->>Evaluator: Grading JSON
    
    Evaluator->>Evaluator: Parse expected_points
    Evaluator->>Evaluator: Semantic match (MATCH/PARTIAL/MISS)
    Evaluator->>Evaluator: Calculate score (0-10)
    
    alt KB_GAP detected
        Evaluator->>Evaluator: Set KB_GAP=true
        Evaluator->>Evaluator: No idealAnswer generation
    end
    
    Evaluator-->>API: Evaluation result
    API->>DB: Save to drill_attempts
    DB-->>API: Success
    
    alt Score < 6 and attempt < 2
        API->>DB: Update needsRepeatTags
    end
    
    API-->>UI: Feedback with score
    UI-->>Employee: Display results + guidance
```

#### 3.3.3 Drill Generation Flow

```mermaid
sequenceDiagram
    actor Employee
    participant UI
    participant API as POST /api/ai/generate-drill
    participant DrillGen as Drill Generator
    participant GigaChat
    
    Employee->>UI: Fail step (attempt 1 or 2)
    UI->>API: tag, stepType, KB, strictMode
    API->>DrillGen: Prepare drill prompt
    DrillGen->>DrillGen: Build prompt with KB
    DrillGen->>GigaChat: Generate new question
    GigaChat-->>DrillGen: Drill content (JSON)
    
    DrillGen->>DrillGen: Validate structure
    alt Invalid structure
        DrillGen->>GigaChat: Retry with "JSON only" instruction
        GigaChat-->>DrillGen: Corrected JSON
    end
    
    DrillGen-->>API: drillStep
    API-->>UI: New practice question
    UI-->>Employee: Display drill
```

## 4. Detailed Component Specifications

### 4.1 Replit AI Removal Plan

#### 4.1.1 Audit Checklist

**Code Search Patterns:**

1. `replit` in imports
2. `replit_integrations` directory references
3. `lovable`, `openai`, `gateway` keywords
4. Environment variables: `REPLIT_`, `OPENAI_`

**Removal Actions:**

| Location | Action | Impact |
|----------|--------|--------|
| `/server/replit_integrations/` | Delete entire directory | Remove unused code |
| `/server/ai/routes.ts` line 3 | Change import path | Update to `/server/chat/storage` |
| `/script/build.ts` line 23 | Remove "openai" from list | Clean build config |
| Environment vars | Remove OPENAI_API_KEY | Clean configuration |

**Retained Items:**

- `/vite.config.ts`: Replit dev plugins (IDE-specific, not AI-related)
- `/replit.md`: Documentation file

#### 4.1.2 Chat Storage Migration

**Action:** Move `/server/replit_integrations/chat/storage.ts` → `/server/chat/storage.ts`

**Interface (unchanged):**

```
IChatStorage:
  - getConversation(id: number): Promise<Conversation | undefined>
  - getAllConversations(): Promise<Conversation[]>
  - createConversation(title: string): Promise<Conversation>
  - deleteConversation(id: number): Promise<void>
  - getMessagesByConversation(conversationId: number): Promise<Message[]>
  - createMessage(conversationId: number, role: string, content: string): Promise<Message>
```

**Update References:**

- `/server/ai/routes.ts` line 3: Import from `../chat/storage`
- Any other files importing from replit_integrations

### 4.2 File Processing Enhancement

#### 4.2.1 Supported Formats

| Format | Extraction Method | Library | Size Limit |
|--------|-------------------|---------|------------|
| TXT, MD | Buffer to UTF-8 | Built-in | 20 MB |
| DOCX | Extract raw text | mammoth | 20 MB |
| PDF | Parse text content | pdf-parse | 20 MB |
| JPG, PNG | Store file + manual fallback | N/A | 5 MB |

#### 4.2.2 File Processor Module

**Module:** `/server/ai/parsers.ts`

**Functions:**

1. **extractTextFromFile(file: Multer.File): Promise<string>**
   - Input: Multer file object
   - Output: Extracted text string
   - Logic:
     - Detect extension (.txt, .md, .docx, .pdf, .jpg, .png)
     - Route to appropriate parser
     - Apply null-byte cleaning
     - Throw error for unsupported formats

2. **extractTextFromPDF(buffer: Buffer): Promise<string>**
   - Use pdf-parse library
   - Extract text from all pages
   - Handle encrypted PDFs (error message)
   - Clean extracted text (remove excessive whitespace)

3. **extractTextFromDOCX(buffer: Buffer): Promise<string>**
   - Use mammoth library (already in use)
   - Extract raw text
   - Preserve basic structure

4. **handleImageUpload(file: Multer.File): Promise<{ type: 'image', message: string, fileId: string }>**
   - For MVP: Return placeholder object
   - Store file reference
   - Return message: "OCR не поддерживается. Вставьте текст вручную."
   - Future: Integrate OCR service

**Error Handling:**

| Error Type | User Message | HTTP Status |
|------------|--------------|-------------|
| Unsupported format | "Формат {ext} не поддерживается. Используйте PDF, DOC, DOCX, TXT, MD." | 400 |
| File too large | "Файл слишком большой. Максимум 20 МБ." | 400 |
| Corrupted file | "Не удалось прочитать файл. Проверьте, что файл не повреждён." | 400 |
| PDF encrypted | "PDF защищён паролем. Загрузите незащищённую версию." | 400 |

#### 4.2.3 Chunking Strategy for Large KB

**Problem:** GigaChat has token limits; 2MB text may exceed context window.

**Solution A (Fast MVP):**

1. **Create KB Outline:**
   - Send KB (first 10k chars) to GigaChat
   - Prompt: "Extract main topics from this knowledge base. Return JSON array of topics."
   - Receive: `["Topic 1", "Topic 2", ..., "Topic N"]`

2. **Generate Modules Per Topic:**
   - For each topic:
     - Extract relevant KB section (semantic search or keyword matching)
     - Generate module with 6–10 steps
   - Merge all modules into final course

**Solution B (Advanced):**

1. Split KB into chunks (10–20k characters, respect paragraph boundaries)
2. For each chunk:
   - Generate topics
3. Deduplicate and organize topics into hierarchy
4. Generate steps per topic with relevant KB context

**Recommendation:** Implement Solution A for initial release.

### 4.3 Prompt Engineering

#### 4.3.1 Prompt Template Module

**Module:** `/server/ai/prompts.ts`

**Structure:**

```
export const PROMPTS = {
  COURSE_GENERATION: {
    SYSTEM: string,
    USER_TEMPLATE: (params) => string
  },
  EVALUATION: {
    SYSTEM: string,
    USER_TEMPLATE: (params) => string
  },
  DRILL_GENERATION: {
    SYSTEM: string,
    USER_TEMPLATE: (params) => string
  },
  CHAT_ASSISTANT: {
    SYSTEM: string
  }
}
```

#### 4.3.2 Course Generation Prompts

**System Prompt (Anti-Hallucination Enhanced):**

```
Role: Методист и экзаменатор в корпоративной обучающей платформе ADAPT.

Task: По БАЗЕ ЗНАНИЙ (KB) создать структурированный тренинг (модули → шаги) для реального обучения, а не пересказа.

Language: Русский
Style: Коротко, точно, без воды

PROHIBITIONS (Anti-Hallucination Rules):
- НЕ выдумывай факты, термины, процессы, названия, цифры, которых нет в KB
- НЕ используй несуществующие слова. Если в KB нет термина — не вводи его
- НЕ делай "выжимки" или общий пересказ вместо проверочных вопросов
- НЕ упоминай источники кроме KB

CORE RULE:
Каждый вопрос/правильный ответ/объяснение должны опираться на KB.
Если информация не найдена в KB:
  - Пометь: "KB_GAP": true
  - Сформулируй вопрос как уточняющий к куратору
  - НЕ давай "правильный ответ из головы"

QUALITY CRITERIA:
1. Coverage: ВСЕ основные темы KB (минимум 8–12 тем/разделов для большого KB)
2. Size: 6–12 модулей (зависит от KB size), 5–10 шагов в каждом модуле
3. Step Mix:
   - content (короткая памятка 2–4 строки)
   - quiz (4 варианта, 1 верный)
   - open (развернутый ответ + критерии)
   - roleplay (сценарий + критерии ответа)
4. Context: Вопросы на применение правил/процессов из KB, не на "угадай термин"
5. Step Fields:
   - tag (тема/навык, коротко)
   - objective (что проверяем)
   - feedback/explanation (для quiz) строго по KB
   - source_quote (короткая цитата из KB до 25 слов)

VOLUME:
- Если KB длинная: больше модулей и вопросов (приоритет "полнота охвата", не "краткость")
- Минимум для большого KB: 8 модулей × 6 шагов = 48 шагов

OUTPUT FORMAT:
Верни ТОЛЬКО JSON (без markdown, без комментариев):

{
  "course": {
    "title": "...",
    "description": "...",
    "coverage": {
      "topics": [
        { "topic": "...", "why_important": "..." }
      ]
    },
    "modules": [
      {
        "title": "...",
        "goal": "...",
        "module_tag": "...",
        "steps": [
          {
            "type": "content|quiz|open|roleplay",
            "tag": "...",
            "objective": "...",
            "content": { ... },
            "source_quote": "цитата из KB до 25 слов",
            "KB_GAP": false
          }
        ]
      }
    ]
  }
}

CONTENT STRUCTURE REQUIREMENTS:

content:
{
  "text": "2–4 строки",
  "bullets": ["до 3 пунктов"],
  "do": ["до 2"],
  "dont": ["до 2"]
}

quiz:
{
  "question": "...",
  "options": ["A", "B", "C", "D"],
  "correctIndex": 0-3,
  "explanation": "коротко почему так по KB"
}

open:
{
  "question": "...",
  "ideal_answer": "...",
  "rubric": ["критерий 1", "критерий 2", "критерий 3"]
}

roleplay:
{
  "scenario": "...",
  "user_role": "...",
  "ai_role": "...",
  "task": "...",
  "rubric": ["критерий 1", "критерий 2"],
  "ideal_answer": "пример ответа строго по KB"
}

QUALITY CHECK (before responding):
- Убедись, что нет странных/несуществующих слов
- Убедись, что для каждого шага есть source_quote из KB
- Убедись, что quiz имеет ровно 4 варианта
- Убедись, что модули покрывают разные темы, а не повторяют одно и то же
- Если KB не содержит опоры для ответа/критерия: KB_GAP=true и идеальный ответ не генерируй
```

**User Prompt Template:**

```
Function: buildCourseGenerationUserPrompt(params: { title, description?, strictMode, rawKnowledgeBase, kbSize })

Output:
---
Сгенерируй большой структурированный курс по БАЗЕ ЗНАНИЙ (KB).
Важно: если strictMode=true — строго по KB, ничего не выдумывать.

Параметры:
- Название курса: "{title}"
- Описание (если есть): "{description}"
- strictMode: {strictMode}
- Требуемая глубина: "полное покрытие всех основных тем"

БАЗА ЗНАНИЙ (KB):
{rawKnowledgeBase}

Доп. требования:
- Сделай 8–12 модулей, если KB большая (>10k chars); иначе 6–8
- В каждом модуле 6–10 шагов
- Смешай типы (content/quiz/open/roleplay)
- Каждый шаг должен иметь source_quote из KB

Верни только JSON.
---
```

#### 4.3.3 Evaluation Prompts

**System Prompt (Semantic Grading):**

```
Role: Проверяющий (grader) в ADAPT. Оцениваешь ответ сотрудника на открытый вопрос/ролеплей.

Language: Русский
Format: Только JSON

CRITICAL RULE:
Если strictMode=true — опирайся ТОЛЬКО на БАЗУ ЗНАНИЙ (KB).
НЕ выдумывай "идеальные ответы", критерии, термины.
Каждый ключевой тезис, по которому ты оцениваешь, должен иметь source_quote из KB (до 25 слов).

SEMANTIC EVALUATION:
- Принимаются синонимы и перефразирование
- Допускается частичный зачёт

ALGORITHM:
1. Из KB составь expected_points (2–8) — ключевые смысловые пункты правильного ответа
2. Сопоставь ответ пользователя с expected_points: MATCH / PARTIAL / MISS
3. Считай score 0–10:
   score = round(10 * (MATCH + 0.5*PARTIAL) / total_points)
4. Верни фидбек:
   - whyWrong (1–3 предложения)
   - missingPoints (2–4 пункта)
   - goodParts (1–3 пункта)
   - examplePhrases (1–2 улучшения)
5. Если KB недостаточно, поставь KB_GAP=true и НЕ генерируй idealAnswer

OUTPUT CONTRACT:
{
  "isCorrect": boolean,
  "score_0_10": number,
  "grading": {
    "expected_points": [
      { "point": "…", "source_quote": "…" }
    ],
    "matches": [
      { "point": "…", "status": "MATCH|PARTIAL|MISS", "comment": "коротко почему" }
    ]
  },
  "whyWrong": "...",
  "idealAnswer": "...",
  "missingPoints": ["..."],
  "goodParts": ["..."],
  "examplePhrases": ["..."],
  "KB_GAP": boolean
}
```

**User Prompt Template:**

```
Function: buildEvaluationUserPrompt(params: { step, userAnswer, strictMode, rawKnowledgeBase })

Output:
---
Оцени ответ сотрудника на вопрос/ролеплей.

strictMode: {strictMode}
{if strictMode} Используй ТОЛЬКО информацию из KB. Если KB недостаточно, поставь KB_GAP=true.

ВОПРОС/СЦЕНАРИЙ:
{step.content}

ОТВЕТ СОТРУДНИКА:
{userAnswer}

{if KB exists}
БАЗА ЗНАНИЙ (KB):
{rawKnowledgeBase (first 8000 chars)}
{/if}

Верни только JSON по контракту (expected_points, matches, score, feedback).
---
```

#### 4.3.4 Drill Generation Prompts

**System Prompt:**

```
Role: Создатель практических вопросов для закрепления навыков.

Task: Создай НОВЫЙ вопрос по теме "{tag}" типа "{stepType}".
Вопрос должен проверять тот же навык, но с другим сценарием/формулировкой.

strictMode behavior:
- strictMode=true: Используй СТРОГО ТОЛЬКО информацию из базы знаний
- strictMode=false: Можешь дополнять базу знаний общими знаниями

OUTPUT TYPES:

quiz:
{
  "question": "Вопрос по теме?",
  "options": ["Вариант 1", "Вариант 2", "Вариант 3", "Вариант 4"],
  "correctIndex": 0,
  "explanation": "Объяснение правильного ответа"
}

open:
{
  "question": "Развёрнутый вопрос?",
  "ideal_answer": "Образец хорошего ответа",
  "key_points": ["ключевой момент 1", "ключевой момент 2"]
}

roleplay:
{
  "scenario": "Рабочая ситуация...",
  "context": "Контекст задачи",
  "ideal_answer": "Пример профессионального ответа"
}

Отвечай ТОЛЬКО JSON объектом с полем "content" содержащим структуру выше.
ВСЁ НА РУССКОМ ЯЗЫКЕ.
```

**User Prompt Template:**

```
Function: buildDrillGenerationUserPrompt(params: { tag, stepType, rawKnowledgeBase?, strictMode })

Output:
---
Создай drill-вопрос типа "{stepType}" по теме "{tag}".

{if rawKnowledgeBase}
БАЗА ЗНАНИЙ:
{rawKnowledgeBase (first 5000 chars)}
{/if}

{if strictMode}
Строго используй только KB. Не выдумывай.
{/if}

Верни только JSON.
---
```

### 4.4 Semantic Evaluator Module

#### 4.4.1 Module Specification

**Module:** `/server/ai/evaluator.ts`

**Primary Function:**

```
evaluateAnswer(params: EvaluateAnswerParams): Promise<EvaluationResult>

interface EvaluateAnswerParams {
  step: Step
  userAnswer: string
  strictMode: boolean
  rawKnowledgeBase?: string
}

interface EvaluationResult {
  isCorrect: boolean
  score_0_10: number
  grading: {
    expected_points: Array<{ point: string, source_quote: string }>
    matches: Array<{ point: string, status: 'MATCH' | 'PARTIAL' | 'MISS', comment: string }>
  }
  whyWrong: string
  idealAnswer: string
  missingPoints: string[]
  goodParts: string[]
  examplePhrases: string[]
  KB_GAP: boolean
}
```

**Logic Flow:**

1. **Prepare Prompt:**
   - Use EVALUATION system prompt
   - Build user prompt with step content, user answer, KB
   - Include strictMode flag

2. **Call GigaChat:**
   - Request JSON format
   - Timeout: 60s
   - Temperature: 0.3 (deterministic grading)

3. **Parse Response:**
   - Extract expected_points
   - Extract matches array
   - Calculate score
   - If parse fails: retry once with "Return only valid JSON"

4. **Validate Response:**
   - Check all required fields present
   - Ensure score is 0–10
   - Ensure matches array matches expected_points length

5. **Return Result:**
   - Map to EvaluationResult interface
   - Add computed field: `isCorrect = score >= 6`

#### 4.4.2 Drill Attempt Persistence

**Save Logic (in endpoint handler):**

```
After evaluation:
1. Insert record into drill_attempts table:
   - userId: req.user.id
   - stepId: step.id
   - trackId: step.trackId
   - tag: step.tag
   - attemptType: 'initial' | 'drill_1' | 'drill_2'
   - isCorrect: evaluation.isCorrect
   - userAnswer: userAnswer
   - correctAnswer: evaluation.idealAnswer
   - errorReason: evaluation.whyWrong
   - score: evaluation.score_0_10
   - timestamp: NOW()

2. If NOT isCorrect and attemptType = 'drill_2':
   - Update enrollments.needsRepeatTags:
     - Add step.tag to array (if not exists)
     - Update enrollments.updatedAt

3. Return evaluation to client
```

### 4.5 API Endpoint Specifications

#### 4.5.1 POST /api/ai/chat

**Purpose:** General assistant Q&A with conversation history

**Request Body:**

```json
{
  "conversationId": number | null,
  "messages": Array<{ role: string, content: string }>,
  "context": string | null,
  "strictMode": boolean | null,
  "rawKnowledgeBase": string | null
}
```

**Enhanced Behavior:**

| Condition | Response Strategy |
|-----------|-------------------|
| strictMode=true AND KB provided | Only answer from KB. If KB lacks info, return: "Информация не найдена в базе знаний. Вопрос передан куратору." + KB_GAP indicator |
| strictMode=false OR no KB | Answer using general knowledge |
| conversationId exists | Load and include conversation history |

**Response:**

```json
{
  "reply": string,
  "conversationId": number,
  "KB_GAP": boolean | null
}
```

**Error Responses:**

| Status | Body |
|--------|------|
| 401 | `{ "error": "Не авторизован" }` |
| 500 | `{ "error": true, "reply": "<user-friendly message>", "message": "<debug info>" }` |

#### 4.5.2 POST /api/ai/generate-track

**Purpose:** Generate full multi-module course from KB

**Request Body:**

```json
{
  "title": string,
  "description": string | null,
  "strictMode": boolean,
  "rawKnowledgeBase": string
}
```

**Response:**

```json
{
  "trackOutline": {
    "course": {
      "title": string,
      "description": string,
      "coverage": {
        "topics": Array<{ topic: string, why_important: string }>
      },
      "modules": Array<{
        "title": string,
        "goal": string,
        "module_tag": string,
        "steps": Array<Step>
      }>
    }
  }
}
```

**Step Structure (in response):**

```json
{
  "type": "content" | "quiz" | "open" | "roleplay",
  "tag": string,
  "objective": string,
  "content": object,
  "source_quote": string,
  "KB_GAP": boolean
}
```

**Implementation Notes:**

- This endpoint generates structure only, does NOT save to DB
- Calling endpoint (e.g., POST /api/tracks) handles DB persistence
- For large KB (>50k chars): Use chunking strategy
- Validate minimum step count (8 modules × 6 steps = 48 for large KB)

**Error Responses:**

| Status | Body |
|--------|------|
| 400 | `{ "error": "title и rawKnowledgeBase обязательны" }` |
| 401 | `{ "error": "Не авторизован" }` |
| 500 | `{ "error": "<user-friendly message>", "message": "<debug info>" }` |

#### 4.5.3 POST /api/ai/generate-drill

**Purpose:** Generate practice question for failed step

**Request Body (Enhanced):**

```json
{
  "tag": string,
  "stepType": "quiz" | "open" | "roleplay",
  "rawKnowledgeBase": string | null,
  "strictMode": boolean
}
```

**Response:**

```json
{
  "drillStep": {
    "type": string,
    "tag": string,
    "content": object
  }
}
```

**Validation Logic:**

- Ensure content structure matches stepType
- For quiz: 4 options, correctIndex, explanation
- For open: question, ideal_answer, key_points
- For roleplay: scenario, context, ideal_answer

**Retry Strategy:**

- If JSON parse fails: retry once with appended instruction "Return only JSON"
- If validation fails after retry: return 500 error

#### 4.5.4 POST /api/ai/evaluate-answer (NEW)

**Purpose:** Semantic grading of open/roleplay answers

**Request Body:**

```json
{
  "step": {
    "id": number,
    "trackId": number,
    "type": "open" | "roleplay",
    "tag": string | null,
    "content": object
  },
  "userAnswer": string,
  "strictMode": boolean,
  "rawKnowledgeBase": string | null,
  "attemptType": "initial" | "drill_1" | "drill_2"
}
```

**Response:**

```json
{
  "isCorrect": boolean,
  "score_0_10": number,
  "grading": {
    "expected_points": [
      { "point": "...", "source_quote": "..." }
    ],
    "matches": [
      { "point": "...", "status": "MATCH|PARTIAL|MISS", "comment": "..." }
    ]
  },
  "whyWrong": string,
  "idealAnswer": string,
  "missingPoints": string[],
  "goodParts": string[],
  "examplePhrases": string[],
  "KB_GAP": boolean,
  "attemptId": number
}
```

**Side Effects:**

1. Save to drill_attempts table
2. If NOT isCorrect AND attemptType='drill_2': Update enrollments.needsRepeatTags

**Error Responses:**

| Status | Body |
|--------|------|
| 400 | `{ "error": "step и userAnswer обязательны" }` |
| 401 | `{ "error": "Не авторизован" }` |
| 500 | `{ "error": "<user-friendly message>", "message": "<debug info>" }` |

#### 4.5.5 POST /api/tracks (Enhanced)

**Current Endpoint:** Exists in `/server/routes.ts`

**Enhancements Needed:**

1. **File Upload Support:**
   - Accept multipart/form-data
   - Process multiple files
   - Extract text from PDF/DOCX

2. **Course Generation Integration:**
   - Call POST /api/ai/generate-track internally OR use shared generator function
   - Validate generated structure
   - Ensure minimum module/step count

3. **DB Persistence:**
   - Insert track record
   - Insert all steps with orderIndex
   - Generate unique joinCode

**Request Body (multipart/form-data):**

```
title: string
description: string (optional)
strictMode: boolean
files: File[] (PDF, DOCX, TXT, MD, JPG, PNG)
```

**Logic Flow:**

```
1. Authenticate (curator only)
2. Extract text from all files
3. Combine into rawKnowledgeBase string
4. Validate KB size (warn if >2MB)
5. Call course generator
6. Validate output:
   - Minimum steps count
   - All steps have required fields
   - At least 1 roleplay step
7. Generate joinCode (8-char random)
8. Begin transaction:
   - Insert track
   - Insert steps
   - Commit
9. Return track + steps
```

## 5. Implementation Phases

### Phase 1: Foundation (Priority P0)

**Goal:** Remove Replit dependencies, establish GigaChat as sole provider

| Task | Deliverable | Acceptance |
|------|-------------|------------|
| 1.1 Delete replit_integrations | Directory removed | Build passes, no import errors |
| 1.2 Move chat storage | `/server/chat/storage.ts` exists | Chat endpoints functional |
| 1.3 Update imports | All references use new path | No "replit" in grep results |
| 1.4 Clean environment | Remove REPL IT/OPENAI vars | .env.example updated |
| 1.5 Verify GigaChat config | Client initializes | Console log shows "configured: true" |

**Time Estimate:** 2 hours

### Phase 2: File Processing (Priority P0)

**Goal:** Support PDF uploads with proper text extraction

| Task | Deliverable | Acceptance |
|------|-------------|------------|
| 2.1 Create parsers module | `/server/ai/parsers.ts` | Module exports extractTextFromFile |
| 2.2 Add pdf-parse dependency | package.json updated | npm install succeeds |
| 2.3 Implement PDF extraction | extractTextFromPDF function | Can parse 2MB PDF |
| 2.4 Add file validation | Size/format checks | Clear error messages |
| 2.5 Update upload endpoint | Uses new parser | POST /api/tracks accepts PDF |

**Dependencies:** pdf-parse (npm package)

**Time Estimate:** 4 hours

### Phase 3: Prompt System (Priority P0)

**Goal:** Centralize prompts with anti-hallucination measures

| Task | Deliverable | Acceptance |
|------|-------------|------------|
| 3.1 Create prompts module | `/server/ai/prompts.ts` | Exports PROMPTS object |
| 3.2 Implement course prompts | buildCourseGenerationUserPrompt | Includes KB_GAP instructions |
| 3.3 Implement evaluation prompts | buildEvaluationUserPrompt | Includes semantic matching |
| 3.4 Implement drill prompts | buildDrillGenerationUserPrompt | Includes strictMode handling |
| 3.5 Update routes to use templates | All AI endpoints use prompts module | No inline prompts in routes |

**Time Estimate:** 6 hours

### Phase 4: Course Generation (Priority P0)

**Goal:** Generate big multi-module courses from large KB

| Task | Deliverable | Acceptance |
|------|-------------|------------|
| 4.1 Implement chunking strategy | KB outline generation | Works for 2MB KB |
| 4.2 Create generate-track endpoint | POST /api/ai/generate-track | Returns multi-module JSON |
| 4.3 Add module validation | validateCourseStructure function | Rejects invalid structures |
| 4.4 Ensure minimum coverage | Check step count, topics | 48+ steps for large KB |
| 4.5 Integrate with track creation | POST /api/tracks calls generator | Full flow works end-to-end |

**Time Estimate:** 8 hours

### Phase 5: Semantic Evaluation (Priority P0)

**Goal:** Implement semantic grading with partial credit

| Task | Deliverable | Acceptance |
|------|-------------|------------|
| 5.1 Create evaluator module | `/server/ai/evaluator.ts` | Exports evaluateAnswer |
| 5.2 Implement evaluation endpoint | POST /api/ai/evaluate-answer | Returns structured feedback |
| 5.3 Add drill_attempts persistence | Save after evaluation | Records appear in DB |
| 5.4 Update needsRepeatTags logic | Update enrollments on fail | Tags added on drill_2 fail |
| 5.5 Test semantic matching | Accepts synonyms | "автомобиль" = "машина" |

**Time Estimate:** 8 hours

### Phase 6: Enhanced Drill Mode (Priority P1)

**Goal:** Improve drill generation with KB grounding

| Task | Deliverable | Acceptance |
|------|-------------|------------|
| 6.1 Update drill endpoint | Use new prompt templates | Strict KB adherence |
| 6.2 Add retry logic for JSON | Handle parse failures | Retry once with instruction |
| 6.3 Validate drill structure | Per-type validation | Rejects invalid content |
| 6.4 Test drill flow | Initial fail → drill_1 → drill_2 | All attempts logged |

**Time Estimate:** 4 hours

### Phase 7: Testing & Polish (Priority P1)

**Goal:** Ensure reliability and user experience

| Task | Deliverable | Acceptance |
|------|-------------|------------|
| 7.1 Integration tests | Test all AI endpoints | 90% success rate |
| 7.2 Load testing | 10 concurrent generations | No crashes |
| 7.3 Error message review | User-friendly Russian errors | No English/tech jargon |
| 7.4 Documentation | API docs updated | All endpoints documented |

**Time Estimate:** 6 hours

**Total Estimated Time:** 38 hours

## 6. Quality Assurance

### 6.1 Testing Strategy

#### 6.1.1 Unit Tests

**Modules to Test:**

| Module | Test Cases |
|--------|------------|
| parsers.ts | PDF extraction, DOCX extraction, format validation, size limits |
| prompts.ts | Template rendering, parameter substitution, special char escaping |
| evaluator.ts | Score calculation, semantic matching, KB_GAP detection |
| gigachat.ts | Token refresh, retry logic, timeout handling |

**Success Criteria:** 80% code coverage

#### 6.1.2 Integration Tests

**Scenarios:**

1. **Course Generation Flow:**
   - Upload 2MB PDF
   - Generate course with 50+ steps
   - Verify all topics covered
   - Check step variety (content/quiz/open/roleplay mix)

2. **Evaluation Flow:**
   - Submit correct answer → score 9-10
   - Submit partial answer → score 5-7
   - Submit wrong answer → score 0-4
   - Submit synonym → marked as MATCH

3. **Drill Flow:**
   - Fail initial step
   - Generate drill_1
   - Fail drill_1
   - Generate drill_2
   - Fail drill_2
   - Verify tag in needsRepeatTags

4. **Strict Mode:**
   - Upload KB without specific term
   - Ask about missing term
   - Verify KB_GAP=true
   - Verify no fabricated answer

#### 6.1.3 Manual Testing Checklist

| Test | Expected Result | Status |
|------|-----------------|--------|
| Upload 10MB PDF | Extracts text successfully | ☐ |
| Upload encrypted PDF | Clear error message | ☐ |
| Generate course from 100-word KB | 6–8 steps | ☐ |
| Generate course from 50k-word KB | 48+ steps, 8+ modules | ☐ |
| Submit answer with typos | Semantic match (if meaning clear) | ☐ |
| Submit answer in different word order | Grading recognizes points | ☐ |
| Ask question outside KB (strict=true) | KB_GAP message | ☐ |
| Token expiry during request | Auto-refresh, request succeeds | ☐ |
| GigaChat timeout | Clear error, retry works | ☐ |

### 6.2 Validation Rules

#### 6.2.1 Course Structure Validation

**Function:** `validateCourseStructure(course)`

**Rules:**

| Rule | Error Message |
|------|---------------|
| Minimum 6 modules | "Курс должен содержать минимум 6 модулей" |
| Minimum 48 steps (if KB >10k chars) | "Недостаточно шагов для полного охвата материала" |
| At least 1 roleplay | "Курс должен содержать минимум 1 roleplay шаг" |
| All steps have type | "Шаг {index} не имеет типа" |
| All steps have content | "Шаг {index} не имеет контента" |
| Quiz has 4 options | "Quiz шаг {index} должен иметь 4 варианта ответа" |
| Quiz correctIndex 0-3 | "Некорректный correctIndex в шаге {index}" |

#### 6.2.2 Evaluation Validation

**Function:** `validateEvaluation(evaluation)`

**Rules:**

| Rule | Error Message |
|------|---------------|
| score is 0-10 | "Некорректная оценка: {score}" |
| expected_points length > 0 | "Отсутствуют expected_points" |
| matches length = expected_points length | "Несоответствие количества matches и expected_points" |
| All matches have status | "Match {index} не имеет статуса" |
| If KB_GAP=true, idealAnswer empty | "Не должно быть idealAnswer при KB_GAP" |

### 6.3 Error Handling Matrix

| Error Source | Detection Method | Recovery Strategy | User Message |
|--------------|------------------|-------------------|--------------|
| GigaChat token expired | 401 response | Auto-refresh token, retry | Silent (user doesn't notice) |
| GigaChat timeout | AbortController | Retry up to 3 times | "Превышено время ожидания. Попробуйте ещё раз." |
| GigaChat rate limit | 429 response | Exponential backoff | "Слишком много запросов. Подождите немного." |
| PDF parsing failure | Exception from pdf-parse | Return error | "Не удалось прочитать PDF. Проверьте файл." |
| JSON parse failure | try/catch | Retry with "JSON only" prompt | "Получен некорректный ответ. Повторная попытка..." |
| KB too small | String length check | Proceed with warning | "База знаний маленькая. Курс будет коротким." |
| KB too large | String length check | Use chunking strategy | "Большая база знаний. Генерация займёт больше времени." |
| Missing step fields | Validation function | Use defaults or reject | "Сгенерирован некорректный формат. Попробуйте снова." |

## 7. Environment Configuration

### 7.1 Required Environment Variables

**File:** `.env`

```bash
# Database (existing)
DATABASE_URL=postgresql://...

# GigaChat Configuration (REQUIRED)
GIGACHAT_CLIENT_ID=<your-client-id>
GIGACHAT_CLIENT_SECRET=<your-client-secret>
GIGACHAT_SCOPE=GIGACHAT_API_PERS
GIGACHAT_MODEL=GigaChat
GIGACHAT_TIMEOUT_MS=60000

# SSL Configuration (existing, for GigaChat self-signed cert)
NODE_TLS_REJECT_UNAUTHORIZED=0
```

**File:** `.env.example` (template for developers)

```bash
# Database
DATABASE_URL=postgresql://user:password@host:5432/database

# GigaChat AI Configuration
GIGACHAT_CLIENT_ID=your_client_id_here
GIGACHAT_CLIENT_SECRET=your_client_secret_here
GIGACHAT_SCOPE=GIGACHAT_API_PERS
GIGACHAT_MODEL=GigaChat
GIGACHAT_TIMEOUT_MS=60000

# SSL (for GigaChat)
NODE_TLS_REJECT_UNAUTHORIZED=0
```

### 7.2 Dependency Updates

**Add to package.json:**

```json
{
  "dependencies": {
    "pdf-parse": "^1.1.1",
    "mammoth": "^1.6.0"  // Already present
  }
}
```

**Remove from package.json (if present):**

```json
{
  "dependencies": {
    "openai": "*"  // Remove
  }
}
```

## 8. Risk Assessment & Mitigation

| Risk | Impact | Probability | Mitigation Strategy |
|------|--------|-------------|---------------------|
| GigaChat API rate limits | High | Medium | Implement exponential backoff, queue system |
| Large KB exceeds token limit | High | High | Use chunking strategy (Phase 4) |
| PDF extraction fails | Medium | Low | Fallback to manual text input, clear error messages |
| Semantic grading inaccuracy | Medium | Medium | Iterative prompt tuning, user feedback mechanism |
| Course generation quality poor | High | Medium | Validation rules, minimum step counts, curator review |
| JSON parsing failures | Medium | Medium | Retry logic, explicit "JSON only" instructions |
| Token refresh fails | High | Low | Exponential retry, clear error to user |
| DB transaction failure mid-save | Medium | Low | Use proper transactions, rollback on error |

## 9. Monitoring & Observability

### 9.1 Logging Requirements

**Log Events:**

| Event | Level | Data to Log |
|-------|-------|-------------|
| Course generation start | INFO | trackId, KB size, user |
| Course generation success | INFO | trackId, step count, duration |
| Course generation failure | ERROR | trackId, error message, KB size |
| Evaluation request | INFO | stepId, attemptType, user |
| Evaluation result | INFO | stepId, score, isCorrect |
| Drill generation | INFO | tag, stepType, strictMode |
| GigaChat token refresh | INFO | Duration, success/failure |
| GigaChat API call | DEBUG | Request ID, message count, duration |
| File upload | INFO | File name, size, format |
| PDF extraction failure | WARN | File name, error message |

**Log Format:**

```
[Timestamp] [Level] [Module:RequestID] Message {context_data}
```

**Example:**

```
[2025-01-07 17:30:45] [INFO] [CourseGen:a3f9c2] Course generation started {trackId: 42, kbSize: 2048576, userId: 5}
[2025-01-07 17:31:02] [INFO] [CourseGen:a3f9c2] Course generated successfully {trackId: 42, stepCount: 52, modules: 9, duration: 17234ms}
```

### 9.2 Metrics to Track

**Performance Metrics:**

- Course generation duration (p50, p95, p99)
- Evaluation response time
- Drill generation response time
- PDF extraction time
- GigaChat API response time

**Quality Metrics:**

- Average steps per course
- Module count distribution
- Step type distribution (content/quiz/open/roleplay ratio)
- Average course evaluation score
- KB_GAP occurrence rate
- Semantic match accuracy (MATCH/PARTIAL/MISS ratio)

**Reliability Metrics:**

- GigaChat API success rate
- Token refresh success rate
- JSON parse success rate (first attempt vs after retry)
- File upload success rate by format

**Business Metrics:**

- Courses generated per day
- Average KB size
- Drill attempts per user
- Repeat tag frequency

## 10. Future Enhancements

### 10.1 Deferred Features (Post-MVP)

| Feature | Description | Priority | Effort |
|---------|-------------|----------|--------|
| TTS Integration | SaluteSpeech for voice output | P2 | High |
| OCR Support | Image text extraction | P2 | Medium |
| Streaming Responses | Real-time course generation progress | P3 | Medium |
| Multi-language Support | Courses in English, etc. | P3 | High |
| Adaptive Learning | Adjust difficulty based on performance | P3 | High |
| Curator Review UI | Approve/edit generated courses before publish | P2 | Medium |
| KB Version Control | Track changes to knowledge base | P3 | Low |
| Analytics Dashboard | Curator insights on course effectiveness | P2 | Medium |

### 10.2 Optimization Opportunities

**Phase 2 (Post-Launch):**

1. **Caching Layer:**
   - Cache course generation results for identical KB
   - Cache evaluation results for common answers
   - TTL: 24 hours

2. **Batch Processing:**
   - Generate multiple drills in parallel
   - Batch evaluations for quiz answers

3. **Smart Chunking:**
   - Use semantic search to extract relevant KB sections
   - Reduce token usage by 30–50%

4. **Prompt Optimization:**
   - A/B test different prompt variations
   - Measure quality metrics (human ratings)
   - Iterate based on feedback

## 11. Success Metrics

### 11.1 Technical KPIs

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| API Uptime | 99.5% | Health check monitoring |
| Average Course Generation Time | <30s for 10k KB | Server logs |
| Average Evaluation Time | <5s | Server logs |
| PDF Extraction Success Rate | >95% | Error logs analysis |
| JSON Parse Success Rate (after retry) | >98% | Retry logs |
| GigaChat Token Refresh Success | >99.9% | Auth logs |

### 11.2 Product KPIs

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Average Steps per Course (large KB) | >48 | Database query |
| Topic Coverage Completeness | >90% | Manual curator review |
| Semantic Grading User Satisfaction | >80% | User survey |
| Drill Mode Completion Rate | >70% | Enrollment analytics |
| Courses with KB_GAP | <10% | Flag tracking |

### 11.3 User Experience KPIs

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Curator: Course Creation Success Rate | >90% | Completion funnel |
| Curator: Satisfaction with Generated Content | 4/5 stars | Survey |
| Employee: Understanding of Feedback | >85% | Survey |
| Employee: Perceived Fairness of Grading | >80% | Survey |

## 12. Rollout Plan

### 12.1 Deployment Strategy

**Approach:** Phased rollout with feature flags

**Phases:**

1. **Internal Testing (Week 1):**
   - Deploy to staging environment
   - Team testing with real KB samples
   - Fix critical bugs

2. **Beta Users (Week 2):**
   - Enable for 5 pilot curators
   - Monitor metrics closely
   - Gather feedback

3. **Full Release (Week 3):**
   - Enable for all users
   - Monitor for 48 hours
   - Disable feature flag (make permanent)

### 12.2 Rollback Plan

**Trigger Conditions:**

- API success rate <80% for 1 hour
- User-reported critical bugs >5 in 24 hours
- Data corruption detected

**Rollback Steps:**

1. Disable feature flag (if used)
2. Revert to previous deployment
3. Investigate root cause
4. Apply fix
5. Re-test in staging
6. Re-deploy

### 12.3 Communication Plan

**Stakeholders:**

| Stakeholder | Message | Channel | Timing |
|-------------|---------|---------|--------|
| Curators | "New AI generates bigger courses from PDFs" | In-app notification | Launch day |
| Employees | "Improved answer grading with detailed feedback" | Email + in-app | Launch day |
| Support Team | Technical details + FAQ | Slack + docs | 2 days before launch |
| Developers | Deployment runbook | Confluence | 1 week before |

---

**Document Version:** 1.0  
**Last Updated:** 2025-01-07  
**Status:** Ready for Implementation Review**Stakeholders:**

| Stakeholder | Message | Channel | Timing |
|-------------|---------|---------|--------|
| Curators | "New AI generates bigger courses from PDFs" | In-app notification | Launch day |
| Employees | "Improved answer grading with detailed feedback" | Email + in-app | Launch day |
| Support Team | Technical details + FAQ | Slack + docs | 2 days before launch |
| Developers | Deployment runbook | Confluence | 1 week before |

---

**Document Version:** 1.0  
**Last Updated:** 2025-01-07  
**Status:** Ready for Implementation Review
| Stakeholder | Message | Channel | Timing |
|-------------|---------|---------|--------|
| Curators | "New AI generates bigger courses from PDFs" | In-app notification | Launch day |
| Employees | "Improved answer grading with detailed feedback" | Email + in-app | Launch day |
| Support Team | Technical details + FAQ | Slack + docs | 2 days before launch |
| Developers | Deployment runbook | Confluence | 1 week before |

---

**Document Version:** 1.0  
**Last Updated:** 2025-01-07  
