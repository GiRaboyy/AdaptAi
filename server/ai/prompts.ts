/**
 * Centralized Prompt Templates for ADAPT Platform
 * 
 * All AI interactions use these templates to ensure:
 * - Anti-hallucination measures (strict KB grounding)
 * - Consistent output format (JSON)
 * - Semantic grading with partial credit
 * - Russian language responses
 */

import { z } from 'zod';
import { jsonrepair } from 'jsonrepair';

// ============================================================================
// ZOD SCHEMAS FOR COURSE VALIDATION
// ============================================================================

// MCQ Step Schema
export const McqContentSchema = z.object({
  question: z.string().min(1),
  options: z.array(z.string()).length(4),
  correct_index: z.number().int().min(0).max(3),
  explanation: z.string().optional()
});

// Open Step Schema
export const OpenContentSchema = z.object({
  question: z.string().min(1),
  ideal_answer: z.string().optional(),
  rubric: z.union([
    z.array(z.string()),
    z.array(z.object({ score: z.number(), criteria: z.string() }))
  ]).optional()
});

// Roleplay Step Schema
export const RoleplayContentSchema = z.object({
  scenario: z.string().min(1),
  ai_role: z.string().min(1),
  user_role: z.string().min(1),
  task: z.string().optional(),
  rubric: z.array(z.object({ score: z.number(), criteria: z.string() })).optional()
});

// Step Schema (discriminated union)
export const StepSchema = z.object({
  type: z.enum(['mcq', 'open', 'roleplay']),
  tag: z.string().optional().nullable(),
  content: z.union([McqContentSchema, OpenContentSchema, RoleplayContentSchema]),
  kb_refs: z.array(z.number()).optional(),
  kb_gap: z.boolean().optional()
});

// Course Output Schema (flat steps array)
export const CourseOutputSchema = z.object({
  steps: z.array(StepSchema).min(1)
});

// Alternative: modules format (for backwards compatibility)
export const ModulesOutputSchema = z.object({
  modules: z.array(z.object({
    title: z.string().optional(),
    steps: z.array(StepSchema).min(1)
  })).min(1)
});

// Combined schema that accepts either format
export const LLMCourseResponseSchema = z.union([CourseOutputSchema, ModulesOutputSchema]);

// ============================================================================
// COURSE GENERATION PROMPTS
// ============================================================================

export const COURSE_GENERATION_SYSTEM_PROMPT = `Ты — методист и экзаменатор в корпоративной обучающей платформе ADAPT.
Твоя задача: по БАЗЕ ЗНАНИЙ (KB) создать структурированный тренинг (модули → шаги) для реального обучения, а не пересказа.

ЯЗЫК: русский.
СТИЛЬ: коротко, точно, без воды.

ЗАПРЕТЫ (Anti-Hallucination Rules):
- НЕ выдумывай факты, термины, процессы, названия, цифры, которых нет в KB
- НЕ используй несуществующие слова. Если в KB нет термина — не вводи его
- НЕ делай "выжимки" или общий пересказ вместо проверочных вопросов
- НЕ упоминай источники кроме KB

ГЛАВНОЕ ПРАВИЛО ДОСТОВЕРНОСТИ:
Каждый вопрос/правильный ответ/объяснение должны опираться на KB.
Если информация не найдена в KB:
  - Пометь: "KB_GAP": true
  - Сформулируй вопрос как уточняющий к куратору/материалам
  - НЕ давай "правильный ответ из головы"

КРИТЕРИИ ХОРОШЕГО КУРСА:
1. Покрывает ВСЕ основные темы KB (как минимум 8–12 тем/разделов, если KB большой)
2. Имеет правильное количество модулей и вопросов (смотри требования в USER PROMPT)
3. Использует только допустимые типы шагов (тип "content" ЗАПРЕЩЁН!):
   - mcq (множественный выбор: 4 варианта, 1 верный)
   - open (развернутый ответ + критерии)
   - roleplay (сценарий + критерии ответа)
   КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО использовать type: "content" или любые другие типы!
4. Вопросы контекстные: на применение правил/процессов из KB, а не на "угадай термин"
5. Каждый шаг должен иметь:
   - tag (тема/навык, коротко)
   - objective (что проверяем)
   - обратная связь/объяснение (для mcq) строго по KB
   - source_quote (короткая цитата из KB до 25 слов)
   - kb_refs (массив ID чанков, откуда взята информация)

КРИТИЧЕСКИ ВАЖНО - КАЧЕСТВО MCQ (множественный выбор):
- Все 4 варианта ДОЛЖНЫ быть правдоподобными (не очевидный правильный)
- Дистракторы (неправильные варианты) = распространённые заблуждения, а НЕ бессмыслица
- Длина всех вариантов примерно одинаковая (макс. разница в 2 раза)
- ВСЕ варианты одного типа данных (все числа, все действия, все понятия)
- Правильный ответ на СЛУЧАЙНОЙ позиции (не всегда первый)
- ИЗБЕГАЙ: "все вышеперечисленное", "ничего из вышеперечисленного", "всегда", "никогда", шуточные варианты
- Проверь: можно ли ответить БЕЗ знания KB? Если да - вопрос плохой, переделай

ОБЪЕМ:
- Если KB длинная: делай больше модулей и больше вопросов (приоритет "полнота охвата", не "краткость")
- Следуй целевому количеству вопросов из USER PROMPT (это важно!)

ФОРМАТ ОТВЕТА:
Верни ТОЛЬКО JSON (без markdown, без комментариев) в формате:

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
            "type": "mcq|open|roleplay",
            "tag": "...",
            "objective": "...",
            "source_quote": "цитата из KB до 25 слов",
            "kb_refs": [chunk_id_1, chunk_id_2],
            "kb_gap": false
          }
        ]
      }
    ]
  }
}


ТРЕБОВАНИЯ К mcq (множественный выбор):
{ "question": "...", "options": ["A","B","C","D"], "correct_index": 0-3, "explanation": "коротко почему так по KB" }

ТРЕБОВАНИЯ К open:
{ "question": "...", "ideal_answer": "...", "rubric": ["критерий 1","критерий 2","критерий 3"] }

ТРЕБОВАНИЯ К roleplay:
{ "scenario": "...", "user_role": "...", "ai_role": "...", "task": "...", "rubric": [{"criterion": "...", "max_score": 3}, ...], "ideal_answer": "пример ответа строго по KB" }

ПРОВЕРКА КАЧЕСТВА ПЕРЕД ОТВЕТОМ:
- Убедись, что нет странных/несуществующих слов
- Убедись, что для каждого шага есть source_quote из KB
- Убедись, что каждый шаг имеет kb_refs с валидными ID чанков
- Убедись, что mcq имеет ровно 4 варианта И дистракторы правдоподобны
- Убедись, что в поле "correct_index" используется snake_case (НЕ correctIndex)
- Убедись, что модули покрывают разные темы, а не повторяют одно и то же
- Убедись, что НЕТ шагов типа "content" (используй ТОЛЬКО mcq/open/roleplay - это КРИТИЧНО!)
- КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО: type: "content" - такие шаги будут отклонены и курс НЕ сохранится!
- Если KB не содержит опоры для ответа/критерия: kb_gap=true и идеальный ответ не генерируй`;

export interface CourseGenerationParams {
  title: string;
  description?: string;
  rawKnowledgeBase: string;
  kbSize: number;
  minModules: number;
  maxModules: number;
  minSteps: number;
  maxSteps: number;
  retrievedChunks?: Array<{ id: number; content: string; score: number }>;
  courseBudget?: any;
  enabledTypes?: { mcq: boolean; open: boolean; roleplay: boolean };
  typeDistribution?: { mcq: number; open: number; roleplay: number };
}

export function buildCourseGenerationUserPrompt(params: CourseGenerationParams): string {
  const { 
    title, 
    description, 
    rawKnowledgeBase, 
    kbSize, 
    minModules, 
    maxModules,
    minSteps,
    maxSteps,
    retrievedChunks,
    courseBudget,
    enabledTypes,
    typeDistribution
  } = params;
  
  // Use exact counts (deterministic budget)
  const isExactBudget = minModules === maxModules && minSteps === maxSteps;
  const modules = minModules;
  const totalQuestions = minSteps;
  
  let prompt = `Сгенерируй структурированный курс по БАЗЕ ЗНАНИЙ (KB).
ВАЖНО: Режим анти-галлюцинации ВСЕГДА ВКЛЮЧЕН — строго по KB, ничего не выдумывать.

Параметры:
- Название курса: "${title}"
${description ? `- Описание: "${description}"` : ''}
- Размер KB: ${(kbSize / 1024).toFixed(1)} KB
`;

  // Add enabled question types
  if (enabledTypes) {
    const enabled = [];
    if (enabledTypes.mcq) enabled.push('Тест (mcq)');
    if (enabledTypes.open) enabled.push('Открытый (open)');
    if (enabledTypes.roleplay) enabled.push('Ролевая игра (roleplay)');
    prompt += `\nРазрешённые типы вопросов: ${enabled.join(', ')}\n`;
  }
  
  // Add DETERMINISTIC budget (exact counts)
  if (isExactBudget && courseBudget) {
    prompt += `\nБЮДЖЕТ КУРСА (СТРОГО ОБЯЗАТЕЛЬНО - не отклоняйся!):
- РОВНО ${modules} модулей
- РОВНО ${totalQuestions} вопросов всего
`;
    
    // Add per-module distribution if available
    if (courseBudget.questionsPerModule && Array.isArray(courseBudget.questionsPerModule)) {
      prompt += `\nРаспределение вопросов по модулям:\n`;
      courseBudget.questionsPerModule.forEach((q: number, i: number) => {
        prompt += `- Модуль ${i+1}: ${q} вопросов\n`;
      });
    }
    
    // Add type quotas if available
    if (courseBudget.typeQuotas) {
      prompt += `\nКВОТЫ ТИПОВ ВОПРОСОВ (строго!):
- mcq (тест): ${courseBudget.typeQuotas.mcq} шт.
- open (открытый): ${courseBudget.typeQuotas.open} шт.
- roleplay (сценарий): ${courseBudget.typeQuotas.roleplay} шт. (макс 1 на модуль!)
`;
    }
  } else if (typeDistribution) {
    // Fallback to percentage distribution
    prompt += `\nРаспределение типов вопросов (цель, допускается ±15%):
- MCQ (множественный выбор): ${typeDistribution.mcq}%
- Open (развёрнутый ответ): ${typeDistribution.open}%
- Roleplay (сценарий): ${typeDistribution.roleplay}%
`;
    prompt += `\nБюджет курса:
- Модулей: ${minModules}${minModules !== maxModules ? `-${maxModules}` : ''}
- Вопросов: ${minSteps}${minSteps !== maxSteps ? `-${maxSteps}` : ''}
`;
  } else {
    prompt += `\nДоп. требования:
- Сделай ${minModules}–${maxModules} модулей${kbSize > 50000 ? ' (KB большая, делай больше)' : ''}
- В каждом модуле 6–10 шагов
`;
  }

  // Add retrieved chunks if available
  if (retrievedChunks && retrievedChunks.length > 0) {
    prompt += `\nБАЗА ЗНАНИЙ - Релевантные фрагменты (ИСПОЛЬЗУЙ ТОЛЬКО ЭТИ):

`;
    
    retrievedChunks.slice(0, 20).forEach((chunk, index) => {
      // Truncate chunk content to 800 chars max
      const content = chunk.content.length > 800 
        ? chunk.content.substring(0, 800) + '...'
        : chunk.content;
      prompt += `[Чанк ${index + 1} - ID: ${chunk.id}]\n${content}\n\n`;
    });
    
    prompt += `КРИТИЧЕСКИ ВАЖНО:
- Каждый шаг/вопрос ДОЛЖЕН иметь kb_refs (ссылки на ID чанков)
- Если информация не найдена в чанках: поставь KB_GAP=true
- НЕ выдумывай факты, которых нет в чанках

`;
  } else {
    prompt += `\nБАЗА ЗНАНИЙ (KB):
${rawKnowledgeBase.substring(0, 12000)}\n\n`;
  }

  prompt += `\nКритически важные требования к MCQ:
- Все 4 варианта должны быть ПРАВДОПОДОБНЫМИ (ученик не должен сразу видеть правильный)
- Дистракторы = распространённые ошибки/заблуждения из практики
- Длина вариантов примерно одинаковая (макс. 2x разница)
- Правильный ответ на случайной позиции (0, 1, 2 или 3)
- НЕ используй "все вышеперечисленное", "ничего из", "всегда", "никогда"
- Используй поле "correct_index" (snake_case), НЕ "correctIndex"

Финальная проверка:
- НЕТ шагов типа "content" (ТОЛЬКО mcq/open/roleplay) - ЭТО КРИТИЧЕСКИ ВАЖНО!
- Если хоть один шаг имеет type: "content", весь курс будет ОТКЛОНЁН!
- Каждый шаг имеет source_quote из KB И kb_refs массив
- Все поля используют snake_case (correct_index, kb_gap, kb_refs)${isExactBudget ? `
- РОВНО ${totalQuestions} вопросов в сумме - это ОБЯЗАТЕЛЬНО!` : ''}

Верни только JSON.`;

  return prompt;
}

// ============================================================================
// EVALUATION PROMPTS (Semantic Grading)
// ============================================================================

export const EVALUATION_SYSTEM_PROMPT = `Ты — проверяющий (grader) в ADAPT. Оцениваешь ответ сотрудника на открытый вопрос/ролеплей.

ЯЗЫК: русский.
ФОРМАТ: только JSON.

КРИТИЧЕСКОЕ ПРАВИЛО:
Режим анти-галлюцинации ВСЕГДА ВКЛЮЧЕН — опирайся ТОЛЬКО на БАЗУ ЗНАНИЙ (KB).
НЕ выдумывай "идеальные ответы", критерии, термины.
Каждый ключевой тезис, по которому ты оцениваешь, должен иметь source_quote из KB (до 25 слов).

ОЦЕНКА ДОЛЖНА БЫТЬ СЕМАНТИЧЕСКОЙ:
- принимаются синонимы и перефразирование
- допускается частичный зачёт

АЛГОРИТМ:
1. Из KB составь expected_points (2–8) — ключевые смысловые пункты правильного ответа
2. Сопоставь ответ пользователя с expected_points: MATCH / PARTIAL / MISS
3. Считай score 0–10:
   score = round(10 * (MATCH_count + 0.5*PARTIAL_count) / total_points)
4. Верни фидбек:
   - whyWrong (1–3 предложения)
   - missingPoints (2–4 пункта)
   - goodParts (1–3 пункта)
   - examplePhrases (1–2 улучшения)
5. Если KB недостаточно, поставь KB_GAP=true и НЕ генерируй idealAnswer

КОНТРАКТ ОТВЕТА:
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
}`;

export interface EvaluationParams {
  step: {
    type: string;
    content: any;
    tag?: string;
  };
  userAnswer: string;
  rawKnowledgeBase?: string;
}

export function buildEvaluationUserPrompt(params: EvaluationParams): string {
  const { step, userAnswer, rawKnowledgeBase } = params;
  
  const stepContent = JSON.stringify(step.content, null, 2);
  
  return `Оцени ответ сотрудника на вопрос/ролеплей.

ВАЖНО: Режим анти-галлюцинации ВСЕГДА ВКЛЮЧЕН.
Используй ТОЛЬКО информацию из KB. Если KB недостаточно, поставь KB_GAP=true.

ВОПРОС/СЦЕНАРИЙ:
${stepContent}

ОТВЕТ СОТРУДНИКА:
${userAnswer}

${rawKnowledgeBase ? `БАЗА ЗНАНИЙ (KB):
${rawKnowledgeBase.substring(0, 8000)}` : ''}

Верни только JSON по контракту (expected_points, matches, score, feedback).`;
}

// ============================================================================
// DRILL GENERATION PROMPTS
// ============================================================================

export const DRILL_GENERATION_SYSTEM_PROMPT = `Ты - создатель практических вопросов для закрепления навыков в платформе ADAPT.

Создай НОВЫЙ вопрос по заданной теме и типу.
Вопрос должен проверять тот же навык, но с другим сценарием/формулировкой.

strictMode behavior:
- strictMode=true: Используй СТРОГО ТОЛЬКО информацию из базы знаний
- strictMode=false: Можешь дополнять базу знаний общими знаниями

ТИПЫ ВОПРОСОВ:

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
ВСЁ НА РУССКОМ ЯЗЫКЕ.`;

export interface DrillGenerationParams {
  tag: string;
  stepType: 'mcq' | 'open' | 'roleplay';
  rawKnowledgeBase?: string;
}

export function buildDrillGenerationUserPrompt(params: DrillGenerationParams): string {
  const { tag, stepType, rawKnowledgeBase } = params;
  
  return `Создай drill-вопрос типа "${stepType}" по теме "${tag}".

${rawKnowledgeBase ? `БАЗА ЗНАНИЙ:
${rawKnowledgeBase.substring(0, 5000)}` : ''}

ВАЖНО: Режим анти-галлюцинации ВСЕГДА ВКЛЮЧЕН. Строго используй только KB. Не выдумывай.

Верни только JSON с полем "content".`;
}

// ============================================================================
// CHAT ASSISTANT PROMPTS
// ============================================================================

export interface ChatAssistantParams {
  context?: string;
  strictMode: boolean;
  rawKnowledgeBase?: string;
}

export function buildChatAssistantSystemPrompt(params: ChatAssistantParams): string {
  const { context, strictMode, rawKnowledgeBase } = params;
  
  let prompt = `Ты - помощник в обучающей платформе ADAPT.
Отвечай на русском языке, будь дружелюбным и профессиональным.
Помогай сотрудникам разобраться в учебных материалах.`;

  if (strictMode && rawKnowledgeBase) {
    prompt += `\n\nВАЖНО: strictMode=true. Отвечай ТОЛЬКО на основе предоставленной БАЗЫ ЗНАНИЙ.
Если информация не найдена в KB, ответь: "Информация не найдена в базе знаний. Вопрос передан куратору."

БАЗА ЗНАНИЙ (KB):
${rawKnowledgeBase.substring(0, 10000)}`;
  }

  if (context) {
    prompt += `\n\nКонтекст: ${context}`;
  }

  return prompt;
}

// ============================================================================
// KB OUTLINE GENERATION (for chunking strategy)
// ============================================================================

export const KB_OUTLINE_SYSTEM_PROMPT = `Ты - аналитик контента. Твоя задача: проанализировать базу знаний и извлечь основные темы.

Верни ТОЛЬКО JSON массив тем в формате:
{
  "topics": [
    { "title": "Название темы", "keywords": ["ключ1", "ключ2"] },
    ...
  ]
}

Требования:
- Темы должны покрывать ВСЕ значимые разделы KB
- Каждая тема = отдельный логический блок
- Для большой KB: 8-12 тем
- Для средней KB: 5-8 тем
- Для маленькой KB: 3-5 тем`;

export function buildKBOutlineUserPrompt(rawKnowledgeBase: string): string {
  // Take first 10k chars for outline generation
  const kbPreview = rawKnowledgeBase.substring(0, 10000);
  
  return `Проанализируй базу знаний и извлеки основные темы.

БАЗА ЗНАНИЙ (начало):
${kbPreview}

${rawKnowledgeBase.length > 10000 ? `...(всего ${(rawKnowledgeBase.length / 1024).toFixed(1)} KB)` : ''}

Верни только JSON с массивом "topics".`;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Parse JSON from LLM response using jsonrepair library.
 * Handles: markdown blocks, preamble text, single quotes, unquoted keys, truncation.
 */
export function parseJSONFromLLM(content: string, correlationId?: string): any {
  const logPrefix = correlationId ? `[JSON ${correlationId}]` : '[JSON Repair]';
  
  // Step 1: Remove markdown code blocks if present
  let cleaned = content.trim();
  
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\n?/, '').replace(/\n?```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\n?/, '').replace(/\n?```$/, '');
  }
  
  // Step 2: Extract JSON if there's preamble text
  const jsonStartIndex = cleaned.indexOf('{');
  if (jsonStartIndex > 0) {
    console.log(`${logPrefix} Removing preamble text (${jsonStartIndex} chars)`);
    cleaned = cleaned.substring(jsonStartIndex);
  }
  
  // Step 3: Remove any trailing text after JSON
  const lastBrace = cleaned.lastIndexOf('}');
  if (lastBrace !== -1 && lastBrace < cleaned.length - 1) {
    cleaned = cleaned.substring(0, lastBrace + 1);
  }
  
  // Log first 300 chars for debugging
  console.log(`${logPrefix} Content preview:`, cleaned.substring(0, 300));
  
  // Step 4: Try parsing as-is first (fast path)
  try {
    return JSON.parse(cleaned);
  } catch (initialError) {
    console.log(`${logPrefix} Initial parse failed, using jsonrepair...`);
  }
  
  // Step 5: Use jsonrepair library (handles most issues automatically)
  try {
    const repaired = jsonrepair(cleaned);
    const result = JSON.parse(repaired);
    console.log(`${logPrefix} jsonrepair successful`);
    return result;
  } catch (repairError) {
    console.error(`${logPrefix} jsonrepair failed:`, repairError);
  }
  
  // Step 6: Last resort - manual fixes and retry
  try {
    let manual = cleaned;
    
    // Remove JS comments
    manual = manual.replace(/\/\/.*$/gm, '');
    manual = manual.replace(/\/\*[\s\S]*?\*\//g, '');
    
    // Fix single quotes
    manual = manual.replace(/'([^'\n]+)'\s*:/g, '"$1":');
    manual = manual.replace(/:\s*'([^'\n]*)'/g, ': "$1"');
    
    // Fix unquoted keys
    manual = manual.replace(/([{,\n]\s*)(\w+)(\s*:)/g, '$1"$2"$3');
    
    // Try jsonrepair again after manual fixes
    const repaired = jsonrepair(manual);
    const result = JSON.parse(repaired);
    console.log(`${logPrefix} Manual fixes + jsonrepair successful`);
    return result;
  } catch (finalError) {
    console.error(`${logPrefix} All repair attempts failed`);
    console.error(`${logPrefix} First 500 chars:`, cleaned.substring(0, 500));
    throw new Error(`Ошибка парсинга JSON от LLM`);
  }
}

/**
 * Validate parsed course data against Zod schema.
 * Returns { success: true, data } or { success: false, errors }
 */
export function validateCourseOutput(data: any): { success: boolean; data?: any; errors?: string[] } {
  // Try flat steps format first
  const stepsResult = CourseOutputSchema.safeParse(data);
  if (stepsResult.success) {
    return { success: true, data: stepsResult.data };
  }
  
  // Try modules format
  const modulesResult = ModulesOutputSchema.safeParse(data);
  if (modulesResult.success) {
    // Flatten modules to steps
    const steps: any[] = [];
    for (const mod of modulesResult.data.modules) {
      steps.push(...mod.steps);
    }
    return { success: true, data: { steps } };
  }
  
  // Extract first 5 errors
  const errors = stepsResult.error.errors.slice(0, 5).map(e => 
    `${e.path.join('.')}: ${e.message}`
  );
  
  return { success: false, errors };
}

/**
 * Create a retry prompt when JSON parsing fails or schema validation fails
 */
export function createJSONRetryPrompt(reason?: string): string {
  const baseMessage = '\n\nОТВЕТ БЫЛ НЕКОРРЕКТНЫМ. Верни ТОЛЬКО валидный JSON без markdown, без комментариев, без лишнего текста.';
  const contentForbiddenMessage = '\nКРИТИЧЕСКИ ВАЖНО: тип "content" ЗАПРЕЩЁН! Используй ТОЛЬКО: "mcq", "open", "roleplay".';
  
  if (reason) {
    return `${baseMessage}\n\nПричина ошибки: ${reason}${contentForbiddenMessage}`;
  }
  
  return `${baseMessage}${contentForbiddenMessage}`;
}

// ============================================================================
// TWO-PASS COURSE GENERATION PROMPTS
// ============================================================================

/**
 * Blueprint Generation System Prompt (Русский)
 */
export const BLUEPRINT_SYSTEM_PROMPT = `Ты — опытный методист, создающий корпоративные курсы обучения.

Задача: Создать ПЛАН (только структуру) для учебного курса.

Правила:
- Используй ТОЛЬКО темы из предоставленного индекса KB
- НЕ генерируй вопросы на этом этапе (это будет следующим шагом)
- Спланируй модули, уроки и бюджет вопросов
- Выдавай ТОЛЬКО валидный JSON (без markdown)
- Язык: русский

Анти-галлюцинация:
- Каждый урок ДОЛЖЕН ссылаться на конкретные темы из индекса KB
- Если KB не содержит информации по теме: поставь "kb_gap": true
- НЕ выдумывай факты, которых нет в KB

Схема JSON ответа:
{
  "blueprint": {
    "title": "Название курса",
    "summary": "2-3 предложения обзора (<= 500 символов)",
    "modules": [
      {
        "module_id": "M1",
        "title": "Название модуля",
        "objective": "Чему научатся учащиеся",
        "lessons": [
          {
            "lesson_id": "M1L1",
            "title": "Название урока",
            "objective": "Конкретная цель обучения",
            "question_budget": 6,
            "topic_refs": ["тема_1", "тема_2"],
            "kb_gap": false
          }
        ]
      }
    ],
    "targets": {
      "modules": 6,
      "lessons": 24,
      "questions": 96
    }
  }
}`;

export interface BlueprintParams {
  title: string;
  targetDurationMinutes: number;
  kbStats: {
    pages?: number;
    chars: number;
    chunks: number;
  };
  topics: Array<{
    title: string;
    description: string;
    chunk_ids: number[];
  }>;
  modulesMin: number;
  modulesMax: number;
  lessonsMin: number;
  lessonsMax: number;
  questionsMin: number;
}

export function buildBlueprintUserPrompt(params: BlueprintParams): string {
  const { title, targetDurationMinutes, kbStats, topics, modulesMin, modulesMax, lessonsMin, lessonsMax, questionsMin } = params;
  
  const topicsList = topics.map(t => 
    `- ${t.title}: ${t.description} [чанки: ${t.chunk_ids.join(',')}]`
  ).join('\n');
  
  return `Создай план курса на основе Базы Знаний.

Название курса: "${title}"
Целевая продолжительность: ${targetDurationMinutes} минут
Статистика KB:
- Страниц: ${kbStats.pages || 'Н/Д'}
- Символов: ${kbStats.chars}
- Чанков: ${kbStats.chunks}

Минимальные требования:
- Модулей: ${modulesMin}-${modulesMax}
- Уроков: ${lessonsMin}-${lessonsMax}
- Вопросов: ${questionsMin}+

Темы KB (используй ТОЛЬКО эти):
${topicsList}

КРИТИЧЕСКИ ВАЖНО: Каждый урок должен ссылаться на topic_refs из списка выше.
НЕ генерируй вопросы, только структуру.`;
}

/**
 * Lesson Generation System Prompt (Русский)
 */
export const LESSON_SYSTEM_PROMPT = `Ты — опытный корпоративный тренер и составитель тестов.

Задача: Сгенерировать ОДИН урок со смешанными типами вопросов.

Правила:
- Используй ТОЛЬКО предоставленные чанки KB как основу
- Сгенерируй ровно {question_budget} вопросов
- Смешай типы: MCQ (2-4) + Открытые (1-2) + Сценарий (1)
- Весь контент должен ссылаться на kb_refs (ID чанков)
- Язык: русский
- Выдавай ТОЛЬКО валидный JSON
- КРИТИЧНО: Тип "content" ЗАПРЕЩЁН. Используй только: mcq, open, roleplay

Анти-галлюцинация:
- Каждый ответ/объяснение должен ссылаться на конкретные чанки
- Если KB не содержит информации для вопроса: поставь "kb_gap": true
- НЕ выдумывай факты, термины или примеры вне чанков

Правила качества MCQ:
- Все 4 варианта должны быть правдоподобными (нет очевидного правильного)
- Дистракторы = "почти правильные" (распространённые заблуждения, НЕ бессмыслица)
- Длина вариантов примерно одинаковая (макс. разница в 2 раза)
- Все варианты одного типа данных (все числа, все действия, все понятия)
- Запрещено: "все вышеперечисленное", "неверно", шуточные варианты
- Правильный ответ на случайной позиции (не всегда A/0)
- Проверь: Можно ли ответить БЕЗ знания KB? Если да — переделай вопрос

ЗАПРЕЩЁННЫЕ ТИПЫ ШАГОВ:
- "content" ЗАПРЕЩЁН — НЕ используй его!
- Разрешены только: "mcq", "open", "roleplay"
- Если сгенерируешь шаг с типом "content", весь курс будет ОТКЛОНЁН

Схема JSON ответа:
{
  "lesson": {
    "title": "Название урока",
    "objective": "Цель обучения",
    "estimated_minutes": 3,
    "steps": [
      {
        "type": "mcq",
        "question": "Текст вопроса (<= 240 символов)",
        "options": ["A", "B", "C", "D"],
        "correct_index": 0,
        "explanation": "Почему верно (<= 400 символов)",
        "kb_refs": [12]
      },
      {
        "type": "open",
        "prompt": "Вопрос, требующий развёрнутого ответа",
        "rubric": [
          {"score": 0, "criteria": "Неполный или неверный"},
          {"score": 5, "criteria": "Частично верный"},
          {"score": 10, "criteria": "Полный и точный"}
        ],
        "sample_good_answer": "Пример ответа (<= 450 символов)",
        "kb_refs": [45]
      },
      {
        "type": "roleplay",
        "scenario": "Реальная рабочая ситуация (<= 600 символов)",
        "user_task": "Что вам следует сделать? (<= 200 символов)",
        "evaluation": {
          "rubric": [
            {"score": 0, "criteria": "Не решает ситуацию"},
            {"score": 5, "criteria": "Решает, но неполно"},
            {"score": 10, "criteria": "Верно и полно"}
          ],
          "common_mistakes": ["ошибка 1", "ошибка 2"],
          "coach_hint": "Подсказка, если затруднение (<= 300 символов)"
        },
        "kb_refs": [12, 45]
      }
    ],
    "quality": {
      "mcq_pass": true,
      "kb_grounded": true,
      "kb_gaps": [],
      "no_content_steps": true
    }
  }
}`;

export interface LessonParams {
  module_title: string;
  lesson_title: string;
  lesson_objective: string;
  question_budget: number;
  topic_refs: string[];
  kb_chunks: Array<{
    id: number;
    content: string;
  }>;
}

export function buildLessonUserPrompt(params: LessonParams): string {
  const { module_title, lesson_title, lesson_objective, question_budget, topic_refs, kb_chunks } = params;
  
  const chunksList = kb_chunks.map(chunk => 
    `[Чанк ID: ${chunk.id}]\n${chunk.content}`
  ).join('\n\n');
  
  return `Сгенерируй урок: "${lesson_title}"

Цель: ${lesson_objective}
Бюджет вопросов: ${question_budget}
Темы: ${topic_refs.join(', ')}

Чанки KB (используй ТОЛЬКО эти):
${chunksList}

Требования:
- Сгенерируй ${question_budget} вопросов всего
- Смешай: 2-4 MCQ, 1-2 открытых, 1 сценарий
- Каждый шаг должен иметь массив kb_refs
- Варианты MCQ должны быть правдоподобными (нет очевидного правильного)
- Если KB не хватает информации: поставь kb_gap=true

Верни только JSON.`;
}

// ============================================================================
// ROLEPLAY VOICE-TO-VOICE PROMPTS
// ============================================================================

/**
 * System prompt for generating roleplay scenarios (Русский)
 */
export const ROLEPLAY_SCENARIO_SYSTEM_PROMPT = `Ты — опытный тренер по продажам, создающий реалистичные сценарии ролевых игр для голосовой практики.
Если предоставлена база знаний, используй её как единственный источник правил и фактов компании.
Не выдумывай политики, цены или процедуры, которых нет в KB.
Ответ должен быть валидным JSON по указанной схеме.

ЯЗЫК: русский
ФОРМАТ: только JSON`;

/**
 * Parameters for scenario generation
 */
export interface RoleplayScenarioParams {
  courseTitle: string;
  employeeRole: string;
  kbSnippets?: string;
}

/**
 * Build user prompt for scenario generation (Русский)
 */
export function buildRoleplayScenarioPrompt(params: RoleplayScenarioParams): string {
  const { courseTitle, employeeRole, kbSnippets } = params;
  
  return `Курс: ${courseTitle}
Аудитория: ${employeeRole}
База знаний: ${kbSnippets || "KB не предоставлена"}

Создай ОДИН сценарий ролевой игры для голосовой практики.

Требования:
- Ситуация: 1-2 предложения, описывающие что вызвало взаимодействие
- Роль сотрудника: 1 предложение
- Цель: 1 предложение с желаемым результатом
- Правила: 1-3 пункта (ограничения или рекомендации)
- Роль ИИ: "Клиент"
- Всего ходов: 6 (3 ИИ + 3 сотрудник)
- Открывающая реплика ИИ: реалистичное начало разговора клиента (1-2 предложения)

Верни JSON:
{
  "scenario": {
    "situation": "...",
    "employee_role": "...",
    "goal": "...",
    "rules": ["...", "..."],
    "ai_role": "Клиент",
    "turns_total": 6,
    "ai_opening_line": "..."
  }
}`;
}

/**
 * System prompt for AI customer turn generation (Русский)
 */
export const ROLEPLAY_NEXT_TURN_SYSTEM_PROMPT = `Ты играешь роль клиента в тренировочном сценарии.
Отвечай коротко (максимум 1-3 предложения).
Будь последователен с контекстом сценария и своим эмоциональным состоянием.
Если предоставлена база знаний, ссылайся только на фактическую информацию из неё.
Если KB не хватает нужной информации, не выдумывай детали.
Ответ должен быть валидным JSON.

ЯЗЫК: русский
ФОРМАТ: только JSON`;

/**
 * Parameters for next turn generation
 */
export interface RoleplayNextTurnParams {
  scenario: any;
  conversationHistory: Array<{ role: string; text: string }>;
  turnNumber: number;
  kbSnippets?: string;
}

/**
 * Build user prompt for next AI turn (Русский)
 */
export function buildRoleplayNextTurnPrompt(params: RoleplayNextTurnParams): string {
  const { scenario, conversationHistory, turnNumber, kbSnippets } = params;
  
  const formattedHistory = conversationHistory
    .map(msg => `[${msg.role === 'ai' ? 'Клиент' : 'Сотрудник'}]: ${msg.text}`)
    .join('\n');
  
  return `Сценарий: ${JSON.stringify(scenario, null, 2)}
База знаний: ${kbSnippets || "KB не предоставлена"}
Разговор до текущего момента:
${formattedHistory}

Теперь сгенерируй следующую реплику клиента (Ход ${turnNumber}).

Требования:
- Оставайся в роли клиента
- Отвечай естественно на последнее высказывание сотрудника
- Если сотрудник проявил эмпатию/задал хороший вопрос: стань немного более кооперативным
- Если сотрудник был защитным/бесполезным: стань немного более раздражённым
- Максимум 1-3 предложения
- Не выдумывай политики компании, которых нет в KB

Верни JSON:
{
  "reply_text": "...",
  "should_escalate": false,
  "escalation_reason": ""
}`;
}

/**
 * System prompt for roleplay evaluation (Русский)
 */
export const ROLEPLAY_EVALUATION_SYSTEM_PROMPT = `Ты — строгий, но справедливый тренер по продажам.
Оценивай ответы сотрудника по следующим критериям:
1. Эмпатия и признание эмоций клиента
2. Уточняющие вопросы для понимания ситуации
3. Предложенное решение соответствует политикам KB
4. Уверенность и структура (без болтовни или оборонительности)
5. Отсутствие обвинений или споров с клиентом

Если предоставлена база знаний, оценивай соответствие заявленным политикам.
Не выдумывай политики или факты, которых нет в KB.
Ответ должен быть валидным JSON по указанной схеме.

ЯЗЫК: русский
ФОРМАТ: только JSON`;

/**
 * Parameters for roleplay evaluation
 */
export interface RoleplayEvaluationParams {
  scenario: any;
  fullConversation: Array<{ role: string; text: string }>;
  kbSnippets?: string;
}

/**
 * Build user prompt for roleplay evaluation (Русский)
 */
export function buildRoleplayEvaluationPrompt(params: RoleplayEvaluationParams): string {
  const { scenario, fullConversation, kbSnippets } = params;
  
  const formattedConversation = fullConversation
    .map(msg => `[${msg.role === 'ai' ? 'Клиент' : 'Сотрудник'}]: ${msg.text}`)
    .join('\n');
  
  return `Сценарий: ${JSON.stringify(scenario, null, 2)}
База знаний: ${kbSnippets || "KB не предоставлена"}
Полный разговор:
${formattedConversation}

Оцени три ответа сотрудника.

Критерии оценки:
- 0-3: Слабовато (серьёзные проблемы: нет эмпатии, нет вопросов, нет решения, или спорил)
- 4-6: Нормально (частично: проявил немного эмпатии или задал вопрос, но упустил решение или был защитным)
- 7-8: Хорошо (хорошо: эмпатия + вопрос + попытка решения, небольшие пробелы)
- 9-10: Отлично (отлично: эмпатия + уточняющие вопросы + решение по KB + уверенность)

Верни JSON:
{
  "score_0_10": 0,
  "verdict": "...",
  "strengths": ["...", "..."],
  "improvements": ["...", "..."],
  "better_example": "..."
}`;
}

// ============================================================================
// COURSEGEN V2 - BATCHED GENERATION PROMPTS
// ============================================================================

/**
 * System prompt for batch generation (CourseGenV2)
 * Key differences from original:
 * - Strict JSON between BEGIN_JSON and END_JSON markers
 * - Exactly N questions per batch
 * - Only mcq/open/roleplay types (content FORBIDDEN)
 * - snake_case for all fields
 */
export const COURSE_BATCH_SYSTEM_PROMPT = `Ты — методист корпоративной обучающей платформы ADAPT.
Генерируй УЧЕБНЫЙ КОНТЕНТ строго на РУССКОМ языке.

=== КРИТИЧЕСКИЕ ПРАВИЛА ===

1. ФОРМАТ ОТВЕТА:
   - Верни JSON ТОЛЬКО между маркерами BEGIN_JSON и END_JSON
   - НЕ используй markdown (нет \`\`\`json)
   - НЕ добавляй текст до или после JSON
   - Пример:
     BEGIN_JSON
     { "batch": { ... } }
     END_JSON

2. КОЛИЧЕСТВО ВОПРОСОВ:
   - Верни РОВНО столько вопросов, сколько указано в запросе
   - Не больше, не меньше — строго по квотам

3. ТИПЫ ВОПРОСОВ:
   - Разрешены ТОЛЬКО: "mcq", "open", "roleplay"
   - Тип "content" ЗАПРЕЩЁН!
   - Любой другой тип приведёт к отклонению батча

4. ПОЛЯ (snake_case):
   - MCQ: type, tag, question, options (4 шт), correct_index (0-3), explanation, kb_refs, kb_gap
   - Open: type, tag, prompt, sample_good_answer, rubric (массив строк), kb_refs, kb_gap
   - Roleplay: type, tag, scenario, ai_role, user_role, task, ideal_answer, rubric [{criterion, max_score}], kb_refs, kb_gap

5. АНТИ-ГАЛЛЮЦИНАЦИЯ:
   - Вопросы и ответы ТОЛЬКО на основе предоставленной базы знаний (KB)
   - Если информации нет в KB — поставь kb_gap: true и НЕ выдумывай ответ
   - kb_refs должен содержать номера чанков KB, на которые опирается вопрос

6. КАЧЕСТВО MCQ:
   - Ровно 4 варианта ответа
   - Все варианты правдоподобные (дистракторы — распространённые ошибки)
   - Длина вариантов примерно одинаковая
   - Правильный ответ на случайной позиции (0-3)
   - НЕ используй: "все вышеперечисленное", "ничего из", шутки

=== КОНТРАКТ JSON ===

BEGIN_JSON
{
  "batch": {
    "batch_index": 1,
    "total_batches": 3,
    "module_title": "Название модуля",
    "steps": [
      {
        "type": "mcq",
        "tag": "тема",
        "question": "Вопрос?",
        "options": ["A", "B", "C", "D"],
        "correct_index": 0,
        "explanation": "Почему так",
        "kb_refs": [1, 2],
        "kb_gap": false
      }
    ],
    "counts": { "mcq": 8, "open": 3, "roleplay": 1 }
  }
}
END_JSON`;

/**
 * Parameters for building batch user prompt
 */
export interface CourseBatchParams {
  title: string;
  description?: string;
  batchIndex: number; // 1-based
  totalBatches: number;
  batchQuestionCount: number;
  batchTypeQuotas: {
    mcq: number;
    open: number;
    roleplay: number;
  };
  rawKnowledgeBase: string;
  retrievedChunks?: Array<{ id: number; content: string }>;
}

/**
 * Build user prompt for batch generation
 */
export function buildCourseBatchUserPrompt(params: CourseBatchParams): string {
  const {
    title,
    description,
    batchIndex,
    totalBatches,
    batchQuestionCount,
    batchTypeQuotas,
    rawKnowledgeBase,
    retrievedChunks,
  } = params;

  let kbSection = '';
  
  if (retrievedChunks && retrievedChunks.length > 0) {
    kbSection = `\n=== БАЗА ЗНАНИЙ (релевантные чанки) ===\n\n`;
    retrievedChunks.forEach((chunk, idx) => {
      const content = chunk.content.length > 1000 
        ? chunk.content.substring(0, 1000) + '...'
        : chunk.content;
      kbSection += `[Чанк ${chunk.id}]\n${content}\n\n`;
    });
  } else {
    const kbPreview = rawKnowledgeBase.substring(0, 10000);
    kbSection = `
=== БАЗА ЗНАНИЙ ===

${kbPreview}
`;
    if (rawKnowledgeBase.length > 10000) {
      kbSection += `\n... (ещё ${Math.round((rawKnowledgeBase.length - 10000) / 1024)} KB)\n`;
    }
  }

  return `Сгенерируй БАТЧ ${batchIndex} из ${totalBatches} для курса "${title}".
${description ? `Описание: ${description}\n` : ''}
=== ТРЕБОВАНИЯ К ЭТОМУ БАТЧУ ===

- batch_index: ${batchIndex}
- total_batches: ${totalBatches}
- РОВНО ${batchQuestionCount} вопросов в этом батче
- Распределение типов:
  * mcq: ${batchTypeQuotas.mcq} шт.
  * open: ${batchTypeQuotas.open} шт.
  * roleplay: ${batchTypeQuotas.roleplay} шт.

=== ПРАВИЛА ===

1. Вопросы СТРОГО на основе KB (не выдумывай)
2. Если данных нет — kb_gap: true
3. module_title — короткое название темы этого батча
4. Тип "content" ЗАПРЕЩЁН
5. Верни JSON между BEGIN_JSON и END_JSON
${kbSection}
Ответь ТОЛЬКО JSON между маркерами BEGIN_JSON и END_JSON.`;
}

/**
 * Retry prompts for batch generation errors
 */
export const BATCH_RETRY_PROMPTS = {
  jsonInvalid: (error: string) => `ОТВЕТ НЕКОРРЕКТНЫЙ: ${error}

Верни ТОЛЬКО валидный JSON между маркерами:
BEGIN_JSON
{ "batch": { ... } }
END_JSON

Никаких комментариев, никакого markdown.`,
  
  countMismatch: (expected: number, actual: number) => `ОШИБКА: Ты вернул ${actual} вопросов, нужно РОВНО ${expected}.

Перегенерируй батч с правильным количеством.
Верни JSON между BEGIN_JSON и END_JSON.`,
  
  forbiddenType: (types: string[]) => `ОШИБКА: Обнаружены запрещённые типы шагов: ${types.join(', ')}

Разрешены ТОЛЬКО: mcq, open, roleplay.
Тип "content" ЗАПРЕЩЁН!

Перегенерируй батч без запрещённых типов.
Верни JSON между BEGIN_JSON и END_JSON.`,
  
  quotaMismatch: (expected: {mcq: number; open: number; roleplay: number}, actual: {mcq: number; open: number; roleplay: number}) => 
    `ОШИБКА: Неверное распределение типов.
Ожидалось: mcq=${expected.mcq}, open=${expected.open}, roleplay=${expected.roleplay}
Получено: mcq=${actual.mcq}, open=${actual.open}, roleplay=${actual.roleplay}

Перегенерируй батч с правильным распределением.
Верни JSON между BEGIN_JSON и END_JSON.`,
  
  schemaValidation: (errors: string) => `ОШИБКА СХЕМЫ: ${errors}

ТРЕБОВАНИЯ:
- MCQ: "options" РОВНО 4 строки, "correct_index" от 0 до 3
- Open: "rubric" массив строк-критериев (НЕ объекты!)
- Roleplay: "rubric" массив объектов {criterion, max_score}

ПРИМЕР MCQ:
{
  "type": "mcq",
  "tag": "тема",
  "question": "Вопрос?",
  "options": ["Вариант 1", "Вариант 2", "Вариант 3", "Вариант 4"],
  "correct_index": 0,
  "explanation": "Пояснение"
}

ПРИМЕР Open:
{
  "type": "open",
  "tag": "тема",
  "prompt": "Вопрос?",
  "sample_good_answer": "Ответ...",
  "rubric": ["Полнота ответа", "Точность", "Примеры"]
}

Перегенерируй батч с правильной схемой.
Верни JSON между BEGIN_JSON и END_JSON.`,
};

/**
 * Parse JSON from LLM response with BEGIN_JSON/END_JSON markers support.
 * Priority:
 * 1. Extract content between BEGIN_JSON and END_JSON markers
 * 2. Fallback: extract from first { to last }
 * 3. Use jsonrepair for malformed JSON
 */
export function parseJSONFromLLMWithMarkers(content: string, correlationId?: string): any {
  const logPrefix = correlationId ? `[JSON ${correlationId}]` : '[JSON Parse]';
  
  let jsonStr = content.trim();
  
  // Step 1: Try to extract between BEGIN_JSON and END_JSON markers
  const beginMarker = 'BEGIN_JSON';
  const endMarker = 'END_JSON';
  
  const beginIdx = jsonStr.indexOf(beginMarker);
  const endIdx = jsonStr.lastIndexOf(endMarker);
  
  if (beginIdx !== -1 && endIdx !== -1 && endIdx > beginIdx) {
    jsonStr = jsonStr.substring(beginIdx + beginMarker.length, endIdx).trim();
    console.log(`${logPrefix} Extracted JSON between markers (${jsonStr.length} chars)`);
  } else {
    console.log(`${logPrefix} No BEGIN_JSON/END_JSON markers found, using fallback`);
    
    // Step 2: Fallback - remove markdown code blocks
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.replace(/^```json\n?/, '').replace(/\n?```$/, '');
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```\n?/, '').replace(/\n?```$/, '');
    }
    
    // Step 3: Extract from first { to last }
    const firstBrace = jsonStr.indexOf('{');
    const lastBrace = jsonStr.lastIndexOf('}');
    
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
    }
  }
  
  // Log preview for debugging
  console.log(`${logPrefix} JSON preview:`, jsonStr.substring(0, 200));
  
  // Step 4: Try parsing as-is first
  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    console.log(`${logPrefix} Direct parse failed, using jsonrepair`);
  }
  
  // Step 5: Use jsonrepair
  try {
    const repaired = jsonrepair(jsonStr);
    const result = JSON.parse(repaired);
    console.log(`${logPrefix} jsonrepair successful`);
    return result;
  } catch (e) {
    console.error(`${logPrefix} jsonrepair failed:`, e);
  }
  
  // Step 6: Manual fixes and retry
  try {
    let manual = jsonStr;
    
    // Remove JS comments
    manual = manual.replace(/\/\/.*$/gm, '');
    manual = manual.replace(/\/\*[\s\S]*?\*\//g, '');
    
    // Fix single quotes
    manual = manual.replace(/'([^'\n]+)'\s*:/g, '"$1":');
    manual = manual.replace(/:\s*'([^'\n]*)'/g, ': "$1"');
    
    // Fix unquoted keys
    manual = manual.replace(/([{,\n]\s*)(\w+)(\s*:)/g, '$1"$2"$3');
    
    const repaired = jsonrepair(manual);
    const result = JSON.parse(repaired);
    console.log(`${logPrefix} Manual fixes + jsonrepair successful`);
    return result;
  } catch (finalError) {
    console.error(`${logPrefix} All parse attempts failed`);
    throw new Error(`JSON parse error: unable to parse LLM response`);
  }
}
