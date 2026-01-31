/**
 * Roleplay Voice-to-Voice Routes
 * 
 * Provides three endpoints for the roleplay voice training feature:
 * 1. Generate scenario
 * 2. Get next AI turn
 * 3. Evaluate roleplay performance
 */

import { Router, type Request, type Response } from 'express';
import { callYandexResponseWithPromptId } from './yandex-client';
import {
  ROLEPLAY_SCENARIO_SYSTEM_PROMPT,
  ROLEPLAY_NEXT_TURN_SYSTEM_PROMPT,
  ROLEPLAY_EVALUATION_SYSTEM_PROMPT,
  buildRoleplayScenarioPrompt,
  buildRoleplayNextTurnPrompt,
  buildRoleplayEvaluationPrompt,
  parseJSONFromLLM,
  type RoleplayScenarioParams,
  type RoleplayNextTurnParams,
  type RoleplayEvaluationParams
} from './prompts';
import { db, isDatabaseAvailable } from '../db';
import { kbChunks, tracks } from '@shared/schema';
import { eq, inArray } from 'drizzle-orm';

const router = Router();

// ============================================================================
// 1. GENERATE ROLEPLAY SCENARIO
// ============================================================================

/**
 * POST /api/roleplay/generate-scenario
 * 
 * Generates a realistic roleplay scenario based on course context and KB
 */
router.post('/generate-scenario', async (req: Request, res: Response) => {
  try {
    const { trackId, courseTitle, employeeRole, kbChunkIds } = req.body;

    // Validate request
    if (!trackId || !courseTitle) {
      return res.status(400).json({ 
        error: 'Missing required fields: trackId, courseTitle' 
      });
    }

    // Fetch KB snippets if provided
    let kbSnippets = '';
    if (kbChunkIds && Array.isArray(kbChunkIds) && kbChunkIds.length > 0) {
      const chunks = await db
        .select()
        .from(kbChunks)
        .where(inArray(kbChunks.id, kbChunkIds))
        .limit(10);
      
      kbSnippets = chunks
        .map(chunk => chunk.content)
        .join('\n\n');
    }

    // Build prompts
    const systemPrompt = ROLEPLAY_SCENARIO_SYSTEM_PROMPT;
    const userPrompt = buildRoleplayScenarioPrompt({
      courseTitle,
      employeeRole: employeeRole || 'Сотрудник',
      kbSnippets: kbSnippets || undefined
    });

    // Call LLM
    const input = `${systemPrompt}\n\n${userPrompt}`;

    const response = await callYandexResponseWithPromptId({
      promptId: process.env.YANDEX_PROMPT_ID || "",
      variables: {},
      input,
      timeoutMs: 60000,
    });

    // Parse response
    const result = parseJSONFromLLM(response.outputText);

    // Validate scenario structure
    if (!result.scenario || !result.scenario.situation || !result.scenario.ai_opening_line) {
      return res.status(500).json({ 
        error: 'Invalid scenario generated', 
        details: result 
      });
    }

    return res.json(result);

  } catch (error) {
    console.error('Error generating roleplay scenario:', error);
    return res.status(500).json({ 
      error: 'Failed to generate scenario', 
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// ============================================================================
// 2. GET NEXT AI TURN
// ============================================================================

/**
 * POST /api/roleplay/next-turn
 * 
 * Generates the next customer (AI) reply based on conversation history
 */
router.post('/next-turn', async (req: Request, res: Response) => {
  try {
    const { trackId, stepId, scenario, conversationHistory, turnNumber, kbChunkIds } = req.body;

    // Validate request
    if (!scenario || !conversationHistory || typeof turnNumber !== 'number') {
      return res.status(400).json({ 
        error: 'Missing required fields: scenario, conversationHistory, turnNumber' 
      });
    }

    // Validate conversation history structure
    if (!Array.isArray(conversationHistory)) {
      return res.status(400).json({ 
        error: 'conversationHistory must be an array' 
      });
    }

    // Fetch KB snippets if provided
    let kbSnippets = '';
    if (kbChunkIds && Array.isArray(kbChunkIds) && kbChunkIds.length > 0) {
      const chunks = await db
        .select()
        .from(kbChunks)
        .where(inArray(kbChunks.id, kbChunkIds))
        .limit(10);
      
      kbSnippets = chunks
        .map(chunk => chunk.content)
        .join('\n\n');
    }

    // Build prompts
    const systemPrompt = ROLEPLAY_NEXT_TURN_SYSTEM_PROMPT;
    const userPrompt = buildRoleplayNextTurnPrompt({
      scenario,
      conversationHistory,
      turnNumber,
      kbSnippets: kbSnippets || undefined
    });

    // Call LLM
    const input = `${systemPrompt}\n\n${userPrompt}`;

    const response = await callYandexResponseWithPromptId({
      promptId: process.env.YANDEX_PROMPT_ID || "",
      variables: {},
      input,
      timeoutMs: 60000,
    });

    // Parse response
    const result = parseJSONFromLLM(response.outputText);

    // Validate response structure
    if (!result.reply_text) {
      return res.status(500).json({ 
        error: 'Invalid AI turn generated', 
        details: result 
      });
    }

    return res.json(result);

  } catch (error) {
    console.error('Error generating next AI turn:', error);
    return res.status(500).json({ 
      error: 'Failed to generate AI turn', 
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// ============================================================================
// 3. EVALUATE ROLEPLAY
// ============================================================================

/**
 * POST /api/roleplay/evaluate
 * 
 * Evaluates employee's performance in roleplay conversation
 */
router.post('/evaluate', async (req: Request, res: Response) => {
  try {
    const { trackId, stepId, scenario, fullConversation, kbChunkIds } = req.body;

    // Validate request
    if (!scenario || !fullConversation) {
      return res.status(400).json({ 
        error: 'Missing required fields: scenario, fullConversation' 
      });
    }

    // Validate conversation length (should be 6 turns)
    if (!Array.isArray(fullConversation) || fullConversation.length !== 6) {
      return res.status(400).json({ 
        error: 'fullConversation must contain exactly 6 turns (3 AI + 3 employee)',
        received: fullConversation?.length
      });
    }

    // Fetch KB snippets if provided
    let kbSnippets = '';
    if (kbChunkIds && Array.isArray(kbChunkIds) && kbChunkIds.length > 0) {
      const chunks = await db
        .select()
        .from(kbChunks)
        .where(inArray(kbChunks.id, kbChunkIds))
        .limit(10);
      
      kbSnippets = chunks
        .map(chunk => chunk.content)
        .join('\n\n');
    }

    // Build prompts
    const systemPrompt = ROLEPLAY_EVALUATION_SYSTEM_PROMPT;
    const userPrompt = buildRoleplayEvaluationPrompt({
      scenario,
      fullConversation,
      kbSnippets: kbSnippets || undefined
    });

    // Call LLM
    const input = `${systemPrompt}\n\n${userPrompt}`;

    const response = await callYandexResponseWithPromptId({
      promptId: process.env.YANDEX_PROMPT_ID || "",
      variables: {},
      input,
      timeoutMs: 60000,
    });

    // Parse response
    const result = parseJSONFromLLM(response.outputText);

    // Validate evaluation structure
    if (
      typeof result.score_0_10 !== 'number' || 
      !result.verdict || 
      !Array.isArray(result.strengths) || 
      !Array.isArray(result.improvements) ||
      !result.better_example
    ) {
      return res.status(500).json({ 
        error: 'Invalid evaluation generated', 
        details: result 
      });
    }

    // Ensure score is in valid range
    result.score_0_10 = Math.max(0, Math.min(10, Math.round(result.score_0_10)));

    return res.json(result);

  } catch (error) {
    console.error('Error evaluating roleplay:', error);
    return res.status(500).json({ 
      error: 'Failed to evaluate roleplay', 
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;
