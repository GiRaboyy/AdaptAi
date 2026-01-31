import type { Express, Request, Response } from "express";
import { callYandexResponseWithPromptId } from "./yandex-client";
import { chatStorage } from "../chat/storage";
import { evaluateAnswer, type EvaluateAnswerParams } from "./evaluator";
import { 
  COURSE_GENERATION_SYSTEM_PROMPT,
  buildCourseGenerationUserPrompt,
  DRILL_GENERATION_SYSTEM_PROMPT,
  buildDrillGenerationUserPrompt,
  buildChatAssistantSystemPrompt,
  parseJSONFromLLM,
  createJSONRetryPrompt,
  type CourseGenerationParams,
  type DrillGenerationParams
} from "./prompts";
import { StepSchema, ALLOWED_STEP_TYPES, type AllowedStepType } from "@shared/types";
import { getRecommendedModuleCount, getRecommendedStepCount } from "./parsers";
import { db, isDatabaseAvailable } from "../db";
import { drillAttempts, enrollments } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { retrieveRelevantChunks, logAIInteraction } from "./kb-service";
import { randomUUID } from "crypto";

/**
 * Validate course step types - STRICT: only mcq/open/roleplay allowed
 * Returns list of validation errors. Empty list = valid.
 */
function validateCourseStepTypes(course: any): { valid: boolean; errors: string[]; invalidSteps: any[] } {
  const errors: string[] = [];
  const invalidSteps: any[] = [];
  
  if (!course?.modules || !Array.isArray(course.modules)) {
    return { valid: false, errors: ['Invalid course structure: missing modules array'], invalidSteps: [] };
  }
  
  course.modules.forEach((module: any, mIdx: number) => {
    (module.steps || []).forEach((step: any, sIdx: number) => {
      const stepType = step.type;
      
      // CRITICAL: Check for forbidden step types
      if (!ALLOWED_STEP_TYPES.includes(stepType as AllowedStepType)) {
        errors.push(`Module ${mIdx + 1}, Step ${sIdx + 1}: FORBIDDEN step type "${stepType}" - only mcq/open/roleplay allowed`);
        invalidSteps.push({ module: mIdx + 1, step: sIdx + 1, type: stepType });
      }
      
      // Validate MCQ structure
      if (stepType === 'mcq') {
        const content = step.content || step;
        const options = content.options || [];
        const correctIndex = content.correct_index;
        
        if (options.length !== 4) {
          errors.push(`Module ${mIdx + 1}, Step ${sIdx + 1}: MCQ must have exactly 4 options (found ${options.length})`);
        }
        
        if (correctIndex === undefined || correctIndex < 0 || correctIndex > 3) {
          errors.push(`Module ${mIdx + 1}, Step ${sIdx + 1}: MCQ correct_index must be 0-3 (found ${correctIndex})`);
        }
        
        if (!content.question || content.question.trim() === '') {
          errors.push(`Module ${mIdx + 1}, Step ${sIdx + 1}: MCQ question cannot be empty`);
        }
      }
      
      // Validate open question structure  
      if (stepType === 'open') {
        const content = step.content || step;
        if (!content.question || content.question.trim() === '') {
          errors.push(`Module ${mIdx + 1}, Step ${sIdx + 1}: Open question cannot be empty`);
        }
      }
      
      // Validate roleplay structure
      if (stepType === 'roleplay') {
        const content = step.content || step;
        if (!content.scenario || content.scenario.trim() === '') {
          errors.push(`Module ${mIdx + 1}, Step ${sIdx + 1}: Roleplay scenario cannot be empty`);
        }
      }
    });
  });
  
  return {
    valid: errors.length === 0,
    errors,
    invalidSteps
  };
}

/**
 * AI Routes for ADAPT Platform
 * 
 * Handles:
 * - Chat assistant conversations
 * - Course generation (multi-module big courses)
 * - Drill question generation
 * - Semantic answer evaluation
 */

export function registerAIRoutes(app: Express): void {
  
  // Yandex AI Health Check Endpoint
  // ============================================================================
  
  /**
   * POST /api/ai/test
   * 
   * Test Yandex AI connectivity and response
   * For debugging and health checks
   */
  app.post("/api/ai/test", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Не авторизован" });
    }

    const startTime = Date.now();
    const correlationId = randomUUID().substring(0, 8);
    const userId = (req.user as any).id;

    try {

      const systemPrompt = "Ты - помощник AI.";
      const userPrompt = "Ответь 'Работает!' на русском";
      const input = `${systemPrompt}\n\n${userPrompt}`;

      const response = await callYandexResponseWithPromptId({
        promptId: process.env.YANDEX_PROMPT_ID || "",
        variables: {},
        input,
        timeoutMs: 30000,
      });

      const latencyMs = Date.now() - startTime;
      
      // Log the test
      await logAIInteraction({
        correlationId,
        userId,
        actionType: 'test',
        kbEnabled: false,
        promptText: 'Тест подключения',
        responseText: response.outputText,
        latencyMs,
        status: 'success',
      });

      // Test successful - logged to database

      res.json({
        success: true,
        response: response.outputText,
        latencyMs,
        correlationId
      });

    } catch (error) {
      const latencyMs = Date.now() - startTime;
      console.error(`[Yandex Test:${correlationId}] Error:`, error);
      const err = error as any;
      
      // Log the error
      await logAIInteraction({
        correlationId,
        userId,
        actionType: 'test',
        kbEnabled: false,
        promptText: 'Тест подключения',
        responseText: '',
        latencyMs,
        status: 'error',
        errorMessage: err?.message || 'Connection failed',
      });

      res.status(500).json({
        success: false,
        error: err?.userMessage || "Не удалось подключиться к Yandex AI",
        message: err?.message || "Connection error",
        latencyMs,
        correlationId
      });
    }
  });
  
  // ============================================================================
  // Course Generation Endpoint (NEW)
  // ============================================================================
  
  /**
   * POST /api/ai/generate-track
   * 
   * Generate full multi-module course from knowledge base
   * Returns course structure (does NOT save to DB)
   * 
   * DETERMINISTIC BUDGET:
   * - S: 12 questions, 2 modules
   * - M: 24 questions, 4 modules  
   * - L: 48 questions, 6 modules
   * KB only influences default size recommendation, NOT final counts.
   */
  app.post("/api/ai/generate-track", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Не авторизован" });
    }

    const startTime = Date.now();
    const correlationId = randomUUID().substring(0, 8);
    const userId = (req.user as any).id;

    try {
      const { title, description, rawKnowledgeBase, trackId, enabledTypes, typeDistribution, courseSize } = req.body;

      if (!title || !rawKnowledgeBase) {
        return res.status(400).json({ 
          error: "title и rawKnowledgeBase обязательны" 
        });
      }

      const kbSize = rawKnowledgeBase.length;
      
      // Import new deterministic budget helpers
      const { calculateDeterministicBudget, recommendCourseSize, extractTopicsFromKB } = await import('./parsers');
      
      // Determine course size: use provided size or recommend based on KB
      // Map old format (small/medium/large) to new format (S/M/L)
      let finalCourseSize: 'S' | 'M' | 'L';
      if (courseSize === 'small' || courseSize === 'S') {
        finalCourseSize = 'S';
      } else if (courseSize === 'large' || courseSize === 'L') {
        finalCourseSize = 'L';
      } else if (courseSize === 'medium' || courseSize === 'M') {
        finalCourseSize = 'M';
      } else {
        // Auto-recommend based on KB size
        finalCourseSize = recommendCourseSize(kbSize);
        console.log(`[Course Gen:${correlationId}] Auto-recommended size: ${finalCourseSize} (KB: ${(kbSize/1024).toFixed(1)}KB)`);
      }
      
      // Calculate DETERMINISTIC budget - fixed counts based on size
      const budget = calculateDeterministicBudget({
        courseSize: finalCourseSize,
        enabledTypes: enabledTypes || { mcq: true, open: true, roleplay: true },
        typeDistribution: typeDistribution || undefined
      });
      
      console.log(`[Course Gen:${correlationId}] DETERMINISTIC Budget: size=${finalCourseSize}, questions=${budget.totalQuestions}, modules=${budget.modules}`);
      console.log(`[Course Gen:${correlationId}] Type quotas: mcq=${budget.typeQuotas.mcq}, open=${budget.typeQuotas.open}, roleplay=${budget.typeQuotas.roleplay}`);
      console.log(`[Course Gen:${correlationId}] Questions per module: [${budget.questionsPerModule.join(', ')}]`);
      
      // Retrieve relevant KB chunks if trackId provided
      let retrievedChunks: any[] = [];
      if (trackId) {
        try {
          const topicKeywords = extractTopicsFromKB(rawKnowledgeBase, 10);
          const query = `${title} ${topicKeywords}`;
          const topK = kbSize > 50000 ? 24 : 20;
          
          const chunks = await retrieveRelevantChunks(trackId, query, topK);
          retrievedChunks = chunks.map(c => ({
            id: c.chunk.id,
            content: c.chunk.content,
            score: c.score
          }));
        } catch (err) {
          console.warn(`[Course Gen:${correlationId}] Failed to retrieve chunks:`, err);
        }
      }
      
      // Build course budget object for prompt (backwards compatible)
      const courseBudget = {
        modulesMin: budget.modules,
        modulesMax: budget.modules,
        totalQuestionsMin: budget.totalQuestions,
        totalQuestionsMax: budget.totalQuestions,
        questionsPerModule: budget.questionsPerModule,
        typeQuotas: budget.typeQuotas
      };

      const params: CourseGenerationParams = {
        title,
        description,
        rawKnowledgeBase,
        kbSize,
        minModules: budget.modules,
        maxModules: budget.modules,
        minSteps: budget.totalQuestions,
        maxSteps: budget.totalQuestions,
        retrievedChunks: retrievedChunks.length > 0 ? retrievedChunks : undefined,
        courseBudget,
        enabledTypes: enabledTypes || { mcq: true, open: true, roleplay: true },
        typeDistribution: budget.typeDistributionPct
      };

      const systemPrompt = COURSE_GENERATION_SYSTEM_PROMPT;
      const userPrompt = buildCourseGenerationUserPrompt(params);

      const input = `${systemPrompt}\n\n${userPrompt}`;

      const response = await callYandexResponseWithPromptId({
        promptId: process.env.YANDEX_PROMPT_ID || "",
        variables: {},
        input,
        timeoutMs: 90000,
      });

      // Parse JSON response with retry for schema validation
      let courseData;
      let validationResult: { valid: boolean; errors: string[]; invalidSteps: any[] } = { valid: false, errors: [], invalidSteps: [] };
      let attempts = 0;
      const maxAttempts = 2;
      let lastError = '';
      
      while (attempts < maxAttempts) {
        attempts++;
        
        try {
          // First attempt or retry
          if (attempts === 1) {
            courseData = parseJSONFromLLM(response.outputText);
          } else {
            // Retry with specific error message
            console.log(`[Course Gen:${correlationId}] Retrying due to: ${lastError}`);
            
            const retryInput = `${systemPrompt}

${userPrompt}

${createJSONRetryPrompt(lastError)}`;
            
            const retryResponse = await callYandexResponseWithPromptId({
              promptId: process.env.YANDEX_PROMPT_ID || "",
              variables: {},
              input: retryInput,
              timeoutMs: 90000,
            });
            
            courseData = parseJSONFromLLM(retryResponse.outputText);
          }
          
          // Validate course structure
          if (!courseData.course || !courseData.course.modules) {
            lastError = 'Invalid course structure: missing course.modules';
            if (attempts >= maxAttempts) {
              throw new Error(lastError);
            }
            continue;
          }
          
          // CRITICAL: Validate step types - NO CONTENT ALLOWED
          validationResult = validateCourseStepTypes(courseData.course);
          
          if (!validationResult.valid) {
            const contentSteps = validationResult.invalidSteps.filter(s => s.type === 'content');
            
            if (contentSteps.length > 0) {
              lastError = `FORBIDDEN: Found ${contentSteps.length} steps with type "content". Only mcq/open/roleplay allowed!`;
              console.error(`[Course Gen:${correlationId}] ${lastError}`);
            } else {
              lastError = validationResult.errors.slice(0, 3).join('; ');
            }
            
            if (attempts >= maxAttempts) {
              // CRITICAL: Don't save course with invalid types
              console.error(`[Course Gen:${correlationId}] FATAL: Course validation failed after ${maxAttempts} attempts`);
              console.error(`[Course Gen:${correlationId}] Validation errors:`, validationResult.errors);
              
              return res.status(400).json({
                error: 'Курс не может быть сохранён: найдены запрещённые типы шагов',
                message: lastError,
                validationErrors: validationResult.errors,
                invalidSteps: validationResult.invalidSteps,
                canRetry: true
              });
            }
            continue;
          }
          
          // Validation passed!
          break;
          
        } catch (parseError: any) {
          lastError = `JSON parse error: ${parseError.message}`;
          console.error(`[Course Gen:${correlationId}] Attempt ${attempts} failed:`, lastError);
          
          if (attempts >= maxAttempts) {
            throw parseError;
          }
        }
      }

      const course = courseData.course;
      const totalSteps = course.modules.reduce((sum: number, m: any) => sum + (m.steps?.length || 0), 0);
      
      // Validate and count question types
      let mcqCount = 0;
      let openCount = 0;
      let roleplayCount = 0;
      let invalidTypeCount = 0;
      let stepsWithKBRefs = 0;
      let stepsWithKBGap = 0;
      const qualityIssues: string[] = [];
      
      course.modules.forEach((module: any) => {
        (module.steps || []).forEach((step: any) => {
          // Count types - only mcq/open/roleplay allowed
          if (step.type === 'mcq') mcqCount++;
          else if (step.type === 'open') openCount++;
          else if (step.type === 'roleplay') roleplayCount++;
          else {
            invalidTypeCount++;
            qualityIssues.push(`Invalid step type: ${step.type} (only mcq/open/roleplay allowed)`);
          }
          
          // Check KB grounding
          if (step.kb_refs && Array.isArray(step.kb_refs) && step.kb_refs.length > 0) {
            stepsWithKBRefs++;
          }
          
          // Check KB gaps (lowercase kb_gap)
          if (step.kb_gap === true) {
            stepsWithKBGap++;
          }
          
          // Validate MCQ quality
          if (step.type === 'mcq' && step.content) {
            const options = step.content.options || [];
            const correctIndex = step.content.correct_index;
            
            if (options.length !== 4) {
              qualityIssues.push(`MCQ question missing 4 options (has ${options.length})`);
            }
            
            // Check for correct_index field (not correctIndex)
            if (correctIndex === undefined) {
              qualityIssues.push('MCQ missing correct_index field (using correctIndex?)');
            }
            
            if (options.length === 4) {
              // Check distractor length consistency
              const lengths = options.map((o: string) => o.length);
              const maxLen = Math.max(...lengths);
              const minLen = Math.min(...lengths);
              if (maxLen > minLen * 2.5) {
                qualityIssues.push(`MCQ distractor length inconsistent (max/min ratio: ${(maxLen/minLen).toFixed(1)}x)`);
              }
            }
          }
        });
      });
      
      // Warn if invalid types were found
      if (invalidTypeCount > 0) {
        console.warn(`[Course Gen:${correlationId}] Found ${invalidTypeCount} invalid step types`);
      }
      
      // Calculate KB grounding percentage
      const kbGroundingPct = totalSteps > 0 ? (stepsWithKBRefs / totalSteps) * 100 : 0;
      if (kbGroundingPct < 90) {
        console.warn(`[Course Gen:${correlationId}] Low KB grounding: ${kbGroundingPct.toFixed(1)}%`);
      }
      
      const latencyMs = Date.now() - startTime;
      
      console.log(`[Course Gen:${correlationId}] Generated: ${totalSteps} steps (${mcqCount} mcq, ${openCount} open, ${roleplayCount} roleplay, ${invalidTypeCount} invalid)`);
      console.log(`[Course Gen:${correlationId}] KB grounding: ${kbGroundingPct.toFixed(1)}%, KB gaps: ${stepsWithKBGap}, Quality issues: ${qualityIssues.length}`);
      
      // If quality issues detected, log them
      if (qualityIssues.length > 0) {
        console.warn(`[Course Gen:${correlationId}] Quality issues detected:`, qualityIssues.slice(0, 5));
      }
      
      // Course generation success logged to database

      // Log the interaction with quality metrics
      await logAIInteraction({
        correlationId,
        userId,
        trackId: trackId || undefined,
        actionType: 'generate_course',
        kbEnabled: true,
        retrievedChunkIds: retrievedChunks.map(c => c.id),
        retrievedChunks: retrievedChunks.slice(0, 5).map(c => ({ id: c.id, content: c.content.substring(0, 100) })),
        promptText: (systemPrompt + '\n\n' + userPrompt).substring(0, 5000),
        responseText: JSON.stringify({
          summary: {
            modules: course.modules.length,
            totalSteps,
            mcqCount,
            openCount,
            roleplayCount,
            invalidTypeCount
          },
          requested_counts: {
            modules: `${courseBudget.modulesMin}-${courseBudget.modulesMax}`,
            questions: `${courseBudget.totalQuestionsMin}-${courseBudget.totalQuestionsMax}`
          },
          quality_metrics: {
            kb_grounding_pct: kbGroundingPct.toFixed(1),
            steps_with_kb_refs: stepsWithKBRefs,
            steps_with_kb_gap: stepsWithKBGap,
            quality_issues_count: qualityIssues.length,
            quality_issues_sample: qualityIssues.slice(0, 3)
          },
          scaling_analysis: {
            kb_chars: kbSize,
            kb_chunks: retrievedChunks.length,
            target_questions: `${courseBudget.totalQuestionsMin}-${courseBudget.totalQuestionsMax}`,
            generated_questions: totalSteps,
            delta: totalSteps - courseBudget.totalQuestionsMin
          }
        }),
        latencyMs,
        status: 'success'
      });

      res.json({
        trackOutline: course
      });

    } catch (error) {
      const latencyMs = Date.now() - startTime;
      console.error(`[Course Gen:${correlationId}] Error:`, error);
      const gigaError = error as any;
      
      // Log the error
      await logAIInteraction({
        correlationId,
        userId,
        actionType: 'generate_course',
        kbEnabled: true,
        promptText: req.body.title || 'Unknown',
        responseText: '',
        latencyMs,
        status: 'error',
        errorMessage: gigaError.message || 'Internal error',
      });

      res.status(500).json({
        error: gigaError.userMessage || "Не удалось сгенерировать курс",
        message: gigaError.message || "Internal error"
      });
    }
  });

  // ============================================================================
  // Answer Evaluation Endpoint (NEW)
  // ============================================================================
  
  /**
   * POST /api/ai/evaluate-answer
   * 
   * Semantic grading of open/roleplay answers with partial credit
   * Saves drill_attempts record to database
   */
  app.post("/api/ai/evaluate-answer", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Не авторизован" });
    }

    const startTime = Date.now();
    const correlationId = randomUUID().substring(0, 8);
    const userId = (req.user as any).id;

    try {
      const { step, userAnswer, rawKnowledgeBase, attemptType } = req.body;

      if (!step || !userAnswer) {
        return res.status(400).json({ 
          error: "step и userAnswer обязательны" 
        });
      }

      // Retrieve relevant KB chunks if available
      let retrievedChunks: any[] = [];
      let kbContext = '';
      if (step.trackId && rawKnowledgeBase) {
        try {
          const chunks = await retrieveRelevantChunks(step.trackId, userAnswer + ' ' + (step.content?.question || ''), 3);
          retrievedChunks = chunks.map(c => ({ id: c.chunk.id, content: c.chunk.content }));
          kbContext = chunks.map(c => c.chunk.content).join('\n\n');
          // KB chunks retrieved
        } catch (err) {
          console.warn(`[Evaluator:${correlationId}] Failed to retrieve KB chunks:`, err);
        }
      }

      // Call semantic evaluator (anti-hallucination always enabled)
      const evaluation = await evaluateAnswer({
        step,
        userAnswer,
        rawKnowledgeBase: kbContext || rawKnowledgeBase
      });

      // Save to drill_attempts table
      const [attempt] = await db.insert(drillAttempts).values({
        userId,
        stepId: step.id,
        trackId: step.trackId,
        tag: step.tag || null,
        attemptType: attemptType || 'initial',
        isCorrect: evaluation.isCorrect,
        userAnswer,
        correctAnswer: evaluation.idealAnswer,
        errorReason: evaluation.whyWrong,
        score: evaluation.score_0_10
      }).returning();

      // If drill_2 failed, update needsRepeatTags
      if (!evaluation.isCorrect && attemptType === 'drill_2' && step.tag) {
        try {
          const [enrollment] = await db.select()
            .from(enrollments)
            .where(and(
              eq(enrollments.userId, userId),
              eq(enrollments.trackId, step.trackId)
            ));
          
          if (enrollment) {
            const currentTags = enrollment.needsRepeatTags || [];
            if (!currentTags.includes(step.tag)) {
              await db.update(enrollments)
                .set({ 
                  needsRepeatTags: [...currentTags, step.tag],
                  updatedAt: new Date()
                })
                .where(eq(enrollments.id, enrollment.id));
              
              // Tag added to needsRepeatTags
            }
          }
        } catch (error) {
          console.error(`[Evaluator:${correlationId}] Failed to update needsRepeatTags:`, error);
        }
      }

      const latencyMs = Date.now() - startTime;

      // Log the interaction
      await logAIInteraction({
        correlationId,
        userId,
        trackId: step.trackId,
        actionType: 'evaluate',
        kbEnabled: !!kbContext,
        retrievedChunkIds: retrievedChunks.map(c => c.id),
        retrievedChunks,
        promptText: `Question: ${step.content?.question || 'Unknown'}\nUser Answer: ${userAnswer}`,
        responseText: JSON.stringify(evaluation),
        latencyMs,
        status: 'success',
      });

      res.json({
        ...evaluation,
        attemptId: attempt.id
      });

    } catch (error) {
      const latencyMs = Date.now() - startTime;
      console.error(`[Evaluator:${correlationId}] Error:`, error);
      const gigaError = error as any;
      
      // Log the error
      await logAIInteraction({
        correlationId,
        userId,
        actionType: 'evaluate',
        kbEnabled: false,
        promptText: 'Evaluation request',
        responseText: '',
        latencyMs,
        status: 'error',
        errorMessage: gigaError.message || 'Internal error',
      });

      res.status(500).json({
        error: gigaError.userMessage || "Не удалось оценить ответ",
        message: gigaError.message || "Internal error"
      });
    }
  });

  // ============================================================================
  // Chat Assistant Endpoint
  // ============================================================================
  
  /**
   * POST /api/ai/chat
   * 
   * General-purpose conversational AI for employee questions
   * Maintains conversation history in database
   */
  app.post("/api/ai/chat", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Не авторизован" });
    }

    try {
      const { conversationId, messages: userMessages, context, rawKnowledgeBase } = req.body;

      // Build system prompt (anti-hallucination always enabled when KB provided)
      const systemPrompt = buildChatAssistantSystemPrompt({
        context,
        strictMode: !!rawKnowledgeBase,
        rawKnowledgeBase
      });

      let messages: any[] = [
        { role: "system", content: systemPrompt }
      ];

      // If conversationId provided, load history
      if (conversationId) {
        try {
          const history = await chatStorage.getMessagesByConversation(conversationId);
          messages.push(...history.map(m => ({
            role: m.role as 'system' | 'user' | 'assistant',
            content: m.content
          })));
        } catch (error) {
          console.warn('[AI Chat] Failed to load conversation history:', error);
        }
      }

      // Add user messages from request
      if (userMessages && Array.isArray(userMessages)) {
        messages.push(...userMessages);
      }

      // Get AI response
      const input = messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n");

      const response = await callYandexResponseWithPromptId({
        promptId: process.env.YANDEX_PROMPT_ID || "",
        variables: {},
        input,
        timeoutMs: 60000,
      });

      const replyText = response.outputText;

      // Check for KB_GAP in response (when KB is provided)
      const kbGap = rawKnowledgeBase && 
                    (replyText.includes('не найдена в базе знаний') || 
                     replyText.includes('передан куратору'));

      // Save to database if conversationId exists
      let savedConversationId = conversationId;
      if (conversationId) {
        try {
          // Save the latest user message
          const lastUserMessage = messages.filter(m => m.role === 'user').pop();
          if (lastUserMessage) {
            await chatStorage.createMessage(conversationId, 'user', lastUserMessage.content);
          }
          
          // Save assistant response
          await chatStorage.createMessage(conversationId, 'assistant', replyText);
        } catch (error) {
          console.error('[AI Chat] Failed to save messages:', error);
        }
      }

      res.json({
        reply: replyText,
        conversationId: savedConversationId,
        KB_GAP: kbGap || undefined
      });

    } catch (error) {
      console.error('[AI Chat] Error:', error);
      const gigaError = error as any;
      
      res.status(500).json({
        error: true,
        reply: gigaError.userMessage || "Извините, не удалось получить ответ. Попробуйте ещё раз.",
        message: gigaError.message || "Internal error"
      });
    }
  });

  // ============================================================================
  // Drill Generation Endpoint
  // ============================================================================
  
  /**
   * POST /api/ai/generate-drill
   * 
   * Creates a new practice question similar to failed step, by tag/theme
   * Used for Drill Mode when students answer incorrectly
   */
  app.post("/api/ai/generate-drill", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Не авторизован" });
    }

    try {
      const { tag, stepType, rawKnowledgeBase } = req.body;

      if (!tag || !stepType) {
        return res.status(400).json({ 
          error: "tag и stepType обязательны" 
        });
      }

      // Use centralized prompts
      const systemPrompt = DRILL_GENERATION_SYSTEM_PROMPT;
      const userPrompt = buildDrillGenerationUserPrompt({
        tag,
        stepType,
        rawKnowledgeBase
      });

      let drillContent;
      let parseAttempts = 0;
      const maxAttempts = 2;

      while (parseAttempts < maxAttempts) {
        try {
          parseAttempts++;

          let input = `${systemPrompt}\n\n${userPrompt}`;
          if (parseAttempts > 1) {
            input += `\n\n${createJSONRetryPrompt()}`;
          }

          const response = await callYandexResponseWithPromptId({
            promptId: process.env.YANDEX_PROMPT_ID || "",
            variables: {},
            input,
            timeoutMs: 60000,
          });

          // Parse response
          const parsed = parseJSONFromLLM(response.outputText);
          drillContent = parsed.content || parsed;

          // Validate content structure
          const isValid = validateDrillContent(stepType, drillContent);
          if (isValid) {
            break;
          } else {
            console.warn(`[Drill Gen] Invalid structure on attempt ${parseAttempts}`);
            if (parseAttempts >= maxAttempts) {
              return res.status(500).json({
                error: "Сгенерирован некорректный формат вопроса"
              });
            }
          }
        } catch (error) {
          console.error(`[Drill Gen] Attempt ${parseAttempts} failed:`, error);
          if (parseAttempts >= maxAttempts) {
            return res.status(500).json({
              error: "Не удалось сгенерировать дрилл-вопрос"
            });
          }
        }
      }

      res.json({
        drillStep: {
          type: stepType,
          tag,
          content: drillContent
        }
      });

    } catch (error) {
      console.error('[Drill Generation] Error:', error);
      const gigaError = error as any;
      
      res.status(500).json({
        error: gigaError.userMessage || "Не удалось сгенерировать дрилл-вопрос",
        message: gigaError.message || "Internal error"
      });
    }
  });

  // ============================================================================
  // Conversation Management (from replit_integrations/chat)
  // ============================================================================
  
  // Get all conversations
  app.get("/api/conversations", async (req: Request, res: Response) => {
    try {
      const conversations = await chatStorage.getAllConversations();
      res.json(conversations);
    } catch (error) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });

  // Get single conversation with messages
  app.get("/api/conversations/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const conversation = await chatStorage.getConversation(id);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      const messages = await chatStorage.getMessagesByConversation(id);
      res.json({ ...conversation, messages });
    } catch (error) {
      console.error("Error fetching conversation:", error);
      res.status(500).json({ error: "Failed to fetch conversation" });
    }
  });

  // Create new conversation
  app.post("/api/conversations", async (req: Request, res: Response) => {
    try {
      const { title } = req.body;
      const conversation = await chatStorage.createConversation(title || "New Chat");
      res.status(201).json(conversation);
    } catch (error) {
      console.error("Error creating conversation:", error);
      res.status(500).json({ error: "Failed to create conversation" });
    }
  });

  // Delete conversation
  app.delete("/api/conversations/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      await chatStorage.deleteConversation(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting conversation:", error);
      res.status(500).json({ error: "Failed to delete conversation" });
    }
  });

  // Send message (non-streaming version, replaced old SSE streaming)
  app.post("/api/conversations/:id/messages", async (req: Request, res: Response) => {
    try {
      const conversationId = parseInt(req.params.id);
      const { content } = req.body;

      if (!content) {
        return res.status(400).json({ error: "Message content required" });
      }

      // Save user message
      await chatStorage.createMessage(conversationId, "user", content);

      // Get conversation history for context
      const messages = await chatStorage.getMessagesByConversation(conversationId);
      const chatMessages = messages.map((m) => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
      }));

      const input = chatMessages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n");

      const response = await callYandexResponseWithPromptId({
        promptId: process.env.YANDEX_PROMPT_ID || "",
        variables: {},
        input,
        timeoutMs: 60000,
      });

      const aiReply = response.outputText;

      // Save assistant message
      const savedMessage = await chatStorage.createMessage(
        conversationId, 
        "assistant", 
        aiReply
      );

      res.json({
        message: savedMessage,
        content: aiReply
      });

    } catch (error) {
      console.error("Error sending message:", error);
      const gigaError = error as any;
      res.status(500).json({ 
        error: gigaError.userMessage || "Failed to send message" 
      });
    }
  });

  // ============================================================================
  // AI Logs Endpoints (NEW)
  // ============================================================================

  /**
   * GET /api/ai/logs
   * 
   * Get AI interaction logs with optional filters
   * For debugging and observability
   */
  app.get("/api/ai/logs", async (req: Request, res: Response) => {
    if (!req.isAuthenticated() || (req.user as any).role !== 'curator') {
      return res.status(401).json({ error: "Доступ запрещён" });
    }

    try {
      const { trackId, actionType, status, limit } = req.query;
      
      const filters: any = {};
      if (trackId) filters.trackId = Number(trackId);
      if (actionType) filters.actionType = String(actionType);
      if (status) filters.status = String(status) as 'success' | 'error';
      if (limit) filters.limit = Number(limit);

      const { getAILogs } = await import('./kb-service');
      const logs = await getAILogs(filters);
      
      res.json(logs);
    } catch (error) {
      console.error('[AI Logs] Error fetching logs:', error);
      res.status(500).json({ error: "Не удалось загрузить логи" });
    }
  });

  /**
   * GET /api/ai/logs/:correlationId
   * 
   * Get single log by correlation ID
   */
  app.get("/api/ai/logs/:correlationId", async (req: Request, res: Response) => {
    if (!req.isAuthenticated() || (req.user as any).role !== 'curator') {
      return res.status(401).json({ error: "Доступ запрещён" });
    }

    try {
      const { correlationId } = req.params;
      const { getAILogByCorrelationId } = await import('./kb-service');
      const log = await getAILogByCorrelationId(correlationId);
      
      if (!log) {
        return res.status(404).json({ error: "Лог не найден" });
      }
      
      res.json(log);
    } catch (error) {
      console.error('[AI Logs] Error fetching log:', error);
      res.status(500).json({ error: "Не удалось загрузить лог" });
    }
  });

  /**
   * GET /api/ai/stats/:trackId
   * 
   * Get AI statistics for a track
   */
  app.get("/api/ai/stats/:trackId", async (req: Request, res: Response) => {
    if (!req.isAuthenticated() || (req.user as any).role !== 'curator') {
      return res.status(401).json({ error: "Доступ запрещён" });
    }

    try {
      const trackId = Number(req.params.trackId);
      const { getTrackAIStats } = await import('./kb-service');
      const stats = await getTrackAIStats(trackId);
      
      res.json(stats);
    } catch (error) {
      console.error('[AI Stats] Error fetching stats:', error);
      res.status(500).json({ error: "Не удалось загрузить статистику" });
    }
  });
}

/**
 * Validate drill content structure based on step type
 */
function validateDrillContent(stepType: string, content: any): boolean {
  if (!content || typeof content !== 'object') {
    return false;
  }

  switch (stepType) {
    case 'quiz':
      return (
        typeof content.question === 'string' &&
        Array.isArray(content.options) &&
        content.options.length === 4 &&
        typeof content.correctIndex === 'number' &&
        typeof content.explanation === 'string'
      );
    
    case 'open':
      return (
        typeof content.question === 'string' &&
        typeof content.ideal_answer === 'string' &&
        Array.isArray(content.key_points) &&
        content.key_points.length >= 2
      );
    
    case 'roleplay':
      return (
        typeof content.scenario === 'string' &&
        typeof content.context === 'string' &&
        typeof content.ideal_answer === 'string'
      );
    
    default:
      return false;
  }
}
