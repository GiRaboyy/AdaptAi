/**
 * CourseGenV2 - Batched Course Generation Service
 * 
 * Features:
 * - Deterministic question counts (S/M/L/Custom)
 * - Batched generation (12 questions per batch = 1 LLM call)
 * - Robust JSON parsing with BEGIN_JSON/END_JSON markers
 * - Automatic retry on failures
 * - Strict validation (no "content" type)
 */

import { randomUUID } from 'crypto';
import { callYandexResponseWithPromptId } from './yandex-client';
import { 
  COURSE_BATCH_SYSTEM_PROMPT, 
  buildCourseBatchUserPrompt, 
  BATCH_RETRY_PROMPTS,
  parseJSONFromLLMWithMarkers,
  type CourseBatchParams 
} from './prompts';
import { 
  createBatchPlans, 
  calculateTotalQuestions, 
  calculateGlobalQuotas,
  getDefaultCourseGenV2Settings 
} from './parsers';
import { retrieveRelevantChunks, logAIInteraction } from './kb-service';
import { 
  BatchResponseSchema, 
  type BatchPlan, 
  type BatchStep, 
  type BatchGenerationResult, 
  type CourseGenV2Result,
  type CourseGenV2Settings,
  BATCH_SIZE
} from '@shared/types';

const MAX_BATCH_ATTEMPTS = 3;
const TOKENS_PER_QUESTION = 300; // Estimated tokens per question
const YANDEX_BATCH_PROMPT_ID = process.env.YANDEX_PROMPT_ID || '';

if (!YANDEX_BATCH_PROMPT_ID) {
  console.warn('[CourseGenV2] YANDEX_PROMPT_ID is not configured. Batch generation will fail until it is set.');
}

/**
 * Validate batch response against expected quotas
 */
function validateBatchResponse(
  response: any,
  plan: BatchPlan
): { valid: boolean; errors: string[]; typeCounts: { mcq: number; open: number; roleplay: number } } {
  const errors: string[] = [];
  const typeCounts = { mcq: 0, open: 0, roleplay: 0 };
  
  if (!response?.batch) {
    return { valid: false, errors: ['Missing batch object'], typeCounts };
  }
  
  const batch = response.batch;
  const steps = batch.steps || [];
  
  // Count types and check for forbidden types
  const forbiddenTypes: string[] = [];
  
  for (const step of steps) {
    const type = step.type;
    if (type === 'mcq') typeCounts.mcq++;
    else if (type === 'open') typeCounts.open++;
    else if (type === 'roleplay') typeCounts.roleplay++;
    else {
      forbiddenTypes.push(type);
    }
  }
  
  // Check forbidden types
  if (forbiddenTypes.length > 0) {
    const uniqueForbidden = Array.from(new Set(forbiddenTypes));
    errors.push(`Forbidden types found: ${uniqueForbidden.join(', ')}`);
  }
  
  // Check total count
  const totalCount = typeCounts.mcq + typeCounts.open + typeCounts.roleplay;
  if (totalCount !== plan.questionCount) {
    errors.push(`Count mismatch: expected ${plan.questionCount}, got ${totalCount}`);
  }
  
  // Check type quotas (allow some flexibility within batch, but track)
  // We don't strictly validate per-batch quotas since they're approximate
  
  return { valid: errors.length === 0, errors, typeCounts };
}

/**
 * Convert batch step to database step format
 * Normalizes MCQ to exactly 4 options and correct_index 0-3
 */
function batchStepToDbStep(step: BatchStep, orderIndex: number): any {
  const baseStep = {
    type: step.type,
    tag: step.tag || null,
    orderIndex,
  };
  
  switch (step.type) {
    case 'mcq':
      // Normalize options to exactly 4
      let options = [...step.options];
      while (options.length < 4) {
        options.push(`Вариант ${options.length + 1}`);
      }
      if (options.length > 4) {
        options = options.slice(0, 4);
      }
      
      // Normalize correct_index to 0-3
      let correctIndex = step.correct_index;
      if (correctIndex < 0) correctIndex = 0;
      if (correctIndex > 3) correctIndex = 3;
      
      return {
        ...baseStep,
        content: {
          question: step.question,
          options,
          correct_index: correctIndex,
          correctIdx: correctIndex, // Legacy support
          explanation: step.explanation,
        },
      };
    case 'open':
      // Normalize rubric - convert objects to score/criteria format
      const normalizedRubric = step.rubric.map((r, i) => {
        if (typeof r === 'string') {
          return {
            score: i === 0 ? 0 : i === step.rubric.length - 1 ? 10 : 5,
            criteria: r,
          };
        } else {
          return {
            score: r.score ?? r.max_score ?? (i === 0 ? 0 : i === step.rubric.length - 1 ? 10 : 5),
            criteria: r.criterion ?? r.criteria ?? 'Критерий',
          };
        }
      });
      
      return {
        ...baseStep,
        content: {
          question: step.prompt,
          ideal_answer: step.sample_good_answer,
          idealAnswer: step.sample_good_answer, // Legacy support
          rubric: normalizedRubric,
        },
      };
    case 'roleplay':
      return {
        ...baseStep,
        content: {
          scenario: step.scenario,
          ai_role: step.ai_role,
          aiRole: step.ai_role, // Legacy support
          user_role: step.user_role,
          userRole: step.user_role, // Legacy support
          task: step.task,
          goal: step.task,
          rubric: step.rubric.map(r => ({
            score: r.max_score,
            criteria: r.criterion,
          })),
        },
      };
  }
}

/**
 * Generate a single batch with retry logic
 */
async function generateBatch(
  plan: BatchPlan,
  params: {
    title: string;
    description?: string;
    rawKnowledgeBase: string;
    trackId?: number;
    correlationId: string;
    userId: number;
  }
): Promise<BatchGenerationResult> {
  const { title, description, rawKnowledgeBase, trackId, correlationId, userId } = params;
  const batchCorrelationId = `${correlationId}-B${plan.batchIndex + 1}`;
  
  console.log(`[CourseGenV2:${batchCorrelationId}] Starting batch ${plan.batchIndex + 1}/${plan.totalBatches}`);
  console.log(`[CourseGenV2:${batchCorrelationId}] Quotas: mcq=${plan.typeQuotas.mcq}, open=${plan.typeQuotas.open}, roleplay=${plan.typeQuotas.roleplay}`);
  
  // Retrieve relevant KB chunks for this batch
  let retrievedChunks: Array<{ id: number; content: string }> = [];
  if (trackId) {
    try {
      const chunks = await retrieveRelevantChunks(trackId, title, 15);
      retrievedChunks = chunks.map(c => ({
        id: c.chunk.id,
        content: c.chunk.content,
      }));
    } catch (err) {
      console.warn(`[CourseGenV2:${batchCorrelationId}] Failed to retrieve KB chunks:`, err);
    }
  }
  
  // Build prompts
  const batchParams: CourseBatchParams = {
    title,
    description,
    batchIndex: plan.batchIndex + 1, // 1-based for LLM
    totalBatches: plan.totalBatches,
    batchQuestionCount: plan.questionCount,
    batchTypeQuotas: plan.typeQuotas,
    rawKnowledgeBase,
    retrievedChunks: retrievedChunks.length > 0 ? retrievedChunks : undefined,
  };
  
  const systemPrompt = COURSE_BATCH_SYSTEM_PROMPT;
  const userPrompt = buildCourseBatchUserPrompt(batchParams);
  
  // Calculate dynamic maxTokens
  const maxTokens = Math.min(plan.questionCount * TOKENS_PER_QUESTION + 500, 8000);
  
  let lastError = '';
  let lastErrorType: BatchGenerationResult['errorType'] = 'api_error';
  
  for (let attempt = 1; attempt <= MAX_BATCH_ATTEMPTS; attempt++) {
    const startTime = Date.now();
    
    try {
      console.log(`[CourseGenV2:${batchCorrelationId}] Attempt ${attempt}/${MAX_BATCH_ATTEMPTS}`);
      
      // Build Yandex prompt variables
      const variables: Record<string, string> = {
        batch_index: String(batchParams.batchIndex),
        total_batches: String(batchParams.totalBatches),
        expected_steps: String(batchParams.batchQuestionCount),
        quota_mcq: String(plan.typeQuotas.mcq),
        quota_open: String(plan.typeQuotas.open),
        quota_roleplay: String(plan.typeQuotas.roleplay),
        course_title: title,
        course_description: description ?? '',
        kb_chunks: JSON.stringify(
          (retrievedChunks.length > 0
            ? retrievedChunks
            : [{ id: 1, content: rawKnowledgeBase.substring(0, 4000) }]
          ).map((chunk) => ({ id: chunk.id, content: chunk.content }))
        ),
      };

      // Combine existing system + user prompts into a single input string (Russian)
      const input = `${systemPrompt}\n\n${userPrompt}`;
      
      // Make API call to Yandex Cloud AI Assistant
      const response = await callYandexResponseWithPromptId({
        promptId: YANDEX_BATCH_PROMPT_ID,
        variables,
        input,
        timeoutMs: 90000,
      });
      
      const latencyMs = Date.now() - startTime;
      console.log(`[CourseGenV2:${batchCorrelationId}] Response received (${latencyMs}ms, ${response.outputText.length} chars)`);
      
      // Parse JSON with marker support
      let parsed: any;
      try {
        parsed = parseJSONFromLLMWithMarkers(response.outputText, batchCorrelationId);
      } catch (parseErr: any) {
        lastError = parseErr.message || 'JSON parse failed';
        lastErrorType = 'json_parse';
        console.error(`[CourseGenV2:${batchCorrelationId}] JSON parse error:`, lastError);
        
        if (attempt >= MAX_BATCH_ATTEMPTS) {
          return {
            batchIndex: plan.batchIndex,
            success: false,
            attempts: attempt,
            error: `JSON parse failed after ${attempt} attempts: ${lastError}`,
            errorType: 'json_parse',
          };
        }
        continue;
      }
      
      // Validate schema with Zod
      const schemaResult = BatchResponseSchema.safeParse(parsed);
      if (!schemaResult.success) {
        const zodErrors = schemaResult.error.errors.slice(0, 3).map(e => `${e.path.join('.')}: ${e.message}`);
        lastError = zodErrors.join('; ');
        lastErrorType = 'schema_validation';
        console.error(`[CourseGenV2:${batchCorrelationId}] Schema validation failed:`, lastError);
        
        if (attempt >= MAX_BATCH_ATTEMPTS) {
          return {
            batchIndex: plan.batchIndex,
            success: false,
            attempts: attempt,
            error: `Schema validation failed: ${lastError}`,
            errorType: 'schema_validation',
          };
        }
        continue;
      }
      
      // Validate counts and types
      const validation = validateBatchResponse(parsed, plan);
      if (!validation.valid) {
        const hasContentType = validation.errors.some(e => e.includes('content'));
        lastError = validation.errors.join('; ');
        lastErrorType = hasContentType ? 'forbidden_type' : 'count_mismatch';
        console.error(`[CourseGenV2:${batchCorrelationId}] Validation failed:`, lastError);
        
        if (attempt >= MAX_BATCH_ATTEMPTS) {
          return {
            batchIndex: plan.batchIndex,
            success: false,
            attempts: attempt,
            error: `Validation failed: ${lastError}`,
            errorType: lastErrorType,
          };
        }
        continue;
      }
      
      // Success!
      const batch = schemaResult.data.batch;
      console.log(`[CourseGenV2:${batchCorrelationId}] SUCCESS: ${batch.steps.length} steps generated`);
      
      // Log to AI logs
      await logAIInteraction({
        correlationId: batchCorrelationId,
        userId,
        trackId,
        actionType: 'generate_course',
        kbEnabled: retrievedChunks.length > 0,
        retrievedChunkIds: retrievedChunks.map(c => c.id),
        promptText: userPrompt.substring(0, 2000),
        responseText: JSON.stringify({
          batchIndex: plan.batchIndex + 1,
          stepsCount: batch.steps.length,
          typeCounts: validation.typeCounts,
        }),
        latencyMs,
        status: 'success',
      });
      
      return {
        batchIndex: plan.batchIndex,
        success: true,
        attempts: attempt,
        moduleTitle: batch.module_title,
        steps: batch.steps,
      };
      
    } catch (err: any) {
      lastError = err.message || 'Unknown error';
      lastErrorType = 'api_error';
      console.error(`[CourseGenV2:${batchCorrelationId}] API error:`, lastError);
      
      if (attempt >= MAX_BATCH_ATTEMPTS) {
        return {
          batchIndex: plan.batchIndex,
          success: false,
          attempts: attempt,
          error: `API error after ${attempt} attempts: ${lastError}`,
          errorType: 'api_error',
        };
      }
    }
  }
  
  // Should not reach here
  return {
    batchIndex: plan.batchIndex,
    success: false,
    attempts: MAX_BATCH_ATTEMPTS,
    error: 'Unexpected error',
    errorType: 'api_error',
  };
}

/**
 * Main CourseGenV2 function - generates course with batched LLM calls
 */
export async function generateCourseV2(params: {
  title: string;
  description?: string;
  rawKnowledgeBase: string;
  trackId?: number;
  userId: number;
  settings?: CourseGenV2Settings;
}): Promise<CourseGenV2Result> {
  const { title, description, rawKnowledgeBase, trackId, userId, settings: inputSettings } = params;
  
  const correlationId = randomUUID().substring(0, 8);
  console.log(`[CourseGenV2:${correlationId}] Starting course generation: "${title}"`);
  
  // Use default settings if not provided
  const settings = inputSettings || getDefaultCourseGenV2Settings('M');
  
  // Calculate plan
  const totalQuestions = calculateTotalQuestions(settings);
  const globalQuotas = calculateGlobalQuotas(settings, totalQuestions);
  const batchPlans = createBatchPlans(settings);
  
  console.log(`[CourseGenV2:${correlationId}] Plan: ${totalQuestions} questions, ${batchPlans.length} batches`);
  console.log(`[CourseGenV2:${correlationId}] Quotas: mcq=${globalQuotas.mcq}, open=${globalQuotas.open}, roleplay=${globalQuotas.roleplay}`);
  
  // Generate batches sequentially
  const batchResults: BatchGenerationResult[] = [];
  const modules: Array<{ title: string; steps: any[] }> = [];
  let orderIndex = 0;
  
  const actualQuotas = { mcq: 0, open: 0, roleplay: 0 };
  
  for (const plan of batchPlans) {
    const result = await generateBatch(plan, {
      title,
      description,
      rawKnowledgeBase,
      trackId,
      correlationId,
      userId,
    });
    
    batchResults.push(result);
    
    if (result.success && result.steps && result.moduleTitle) {
      // Convert steps to DB format and add to module
      const dbSteps = result.steps.map(step => {
        const dbStep = batchStepToDbStep(step, orderIndex++);
        
        // Track actual type counts
        if (step.type === 'mcq') actualQuotas.mcq++;
        else if (step.type === 'open') actualQuotas.open++;
        else if (step.type === 'roleplay') actualQuotas.roleplay++;
        
        return dbStep;
      });
      
      modules.push({
        title: result.moduleTitle,
        steps: dbSteps,
      });
    } else {
      // Batch failed - return error result
      console.error(`[CourseGenV2:${correlationId}] Batch ${plan.batchIndex + 1} failed: ${result.error}`);
      
      return {
        success: false,
        totalQuestions,
        generatedQuestions: modules.reduce((sum, m) => sum + m.steps.length, 0),
        batches: batchResults,
        modules,
        quotas: {
          requested: globalQuotas,
          actual: actualQuotas,
        },
        error: `Batch ${plan.batchIndex + 1} failed: ${result.error}`,
        canRetry: true,
      };
    }
  }
  
  // All batches successful
  const generatedQuestions = modules.reduce((sum, m) => sum + m.steps.length, 0);
  
  console.log(`[CourseGenV2:${correlationId}] SUCCESS: ${generatedQuestions}/${totalQuestions} questions, ${modules.length} modules`);
  console.log(`[CourseGenV2:${correlationId}] Actual quotas: mcq=${actualQuotas.mcq}, open=${actualQuotas.open}, roleplay=${actualQuotas.roleplay}`);
  
  return {
    success: true,
    totalQuestions,
    generatedQuestions,
    batches: batchResults,
    modules,
    quotas: {
      requested: globalQuotas,
      actual: actualQuotas,
    },
  };
}

/**
 * Helper to create settings from simple size input
 */
export function createCourseGenV2Settings(
  size: 'S' | 'M' | 'L' | 'Custom',
  customQuestions?: number,
  enabledTypes?: { mcq: boolean; open: boolean; roleplay: boolean },
  typePercentages?: { mcq: number; open: number; roleplay: number }
): CourseGenV2Settings {
  return {
    courseSize: size,
    customTotalQuestions: size === 'Custom' ? customQuestions : undefined,
    enabledTypes: enabledTypes || { mcq: true, open: true, roleplay: true },
    quotaMode: 'percentages',
    typePercentages: typePercentages || { mcq: 60, open: 30, roleplay: 10 },
  };
}
