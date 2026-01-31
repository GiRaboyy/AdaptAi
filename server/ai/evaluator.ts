import { callYandexResponseWithPromptId } from "./yandex-client";
import { 
  EVALUATION_SYSTEM_PROMPT, 
  buildEvaluationUserPrompt, 
  parseJSONFromLLM,
  createJSONRetryPrompt,
  type EvaluationParams 
} from "./prompts";
import type { Step } from "@shared/schema";

/**
 * Semantic Evaluator Module for ADAPT Platform
 * 
 * Provides semantic grading of open-ended and roleplay answers with:
 * - Synonym and paraphrase recognition
 * - Partial credit scoring
 * - Source citations from KB
 * - KB_GAP detection for missing information
 */

// ============================================================================
// Types
// ============================================================================

export interface EvaluateAnswerParams {
  step: Step;
  userAnswer: string;
  rawKnowledgeBase?: string;
}

export interface ExpectedPoint {
  point: string;
  source_quote: string;
}

export interface MatchResult {
  point: string;
  status: 'MATCH' | 'PARTIAL' | 'MISS';
  comment: string;
}

export interface EvaluationResult {
  isCorrect: boolean;
  score_0_10: number;
  grading: {
    expected_points: ExpectedPoint[];
    matches: MatchResult[];
  };
  whyWrong: string;
  idealAnswer: string;
  missingPoints: string[];
  goodParts: string[];
  examplePhrases: string[];
  KB_GAP: boolean;
}

// ============================================================================
// Main Evaluation Function
// ============================================================================

/**
 * Evaluate user's answer with semantic matching and partial credit
 * 
 * @param params - Evaluation parameters
 * @returns Structured evaluation result with score and feedback
 */
export async function evaluateAnswer(
  params: EvaluateAnswerParams
): Promise<EvaluationResult> {
  const { step, userAnswer, rawKnowledgeBase } = params;
  
  // Build prompts (anti-hallucination always enabled)
  const systemPrompt = EVALUATION_SYSTEM_PROMPT;
  const userPrompt = buildEvaluationUserPrompt({
    step: {
      type: step.type,
      content: step.content,
      tag: step.tag || undefined
    },
    userAnswer,
    rawKnowledgeBase
  });
  
  // Call Yandex Cloud AI Assistant with retry on JSON parse failure
  let result: any;
  let parseAttempts = 0;
  const maxAttempts = 2;
  
  while (parseAttempts < maxAttempts) {
    try {
      parseAttempts++;
      
      // Build input for Yandex (system prompt + user prompt, plus retry instruction on second attempt)
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
      
      // Parse JSON response
      result = parseJSONFromLLM(response.outputText);
      
      // Validate response structure
      validateEvaluationResponse(result);
      break;
      
    } catch (error) {
      if (parseAttempts >= maxAttempts) {
        // Fallback: return a neutral evaluation
        return createFallbackEvaluation(userAnswer);
      }
    }
  }
  
  // Map to standard interface
  return mapToEvaluationResult(result);
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate the structure of evaluation response from LLM
 */
function validateEvaluationResponse(data: any): void {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid evaluation response: not an object');
  }
  
  // Check required fields
  if (typeof data.isCorrect !== 'boolean') {
    throw new Error('Invalid evaluation: missing or invalid isCorrect');
  }
  
  if (typeof data.score_0_10 !== 'number' || data.score_0_10 < 0 || data.score_0_10 > 10) {
    throw new Error(`Invalid evaluation: score_0_10 must be 0-10, got ${data.score_0_10}`);
  }
  
  if (!data.grading || !data.grading.expected_points || !Array.isArray(data.grading.expected_points)) {
    throw new Error('Invalid evaluation: missing or invalid grading.expected_points');
  }
  
  if (!data.grading.matches || !Array.isArray(data.grading.matches)) {
    throw new Error('Invalid evaluation: missing or invalid grading.matches');
  }
  
  // Validate expected_points
  for (const point of data.grading.expected_points) {
    if (!point.point || typeof point.point !== 'string') {
      throw new Error('Invalid evaluation: expected_points must have "point" string');
    }
    if (!point.source_quote || typeof point.source_quote !== 'string') {
      throw new Error('Invalid evaluation: expected_points must have "source_quote" string');
    }
  }
  
  // Validate matches
  for (const match of data.grading.matches) {
    if (!match.point || typeof match.point !== 'string') {
      throw new Error('Invalid evaluation: matches must have "point" string');
    }
    if (!match.status || !['MATCH', 'PARTIAL', 'MISS'].includes(match.status)) {
      throw new Error(`Invalid evaluation: match status must be MATCH/PARTIAL/MISS, got ${match.status}`);
    }
    if (!match.comment || typeof match.comment !== 'string') {
      throw new Error('Invalid evaluation: matches must have "comment" string');
    }
  }
  
  // Check that matches count matches expected_points count (silent check)
  if (data.grading.matches.length !== data.grading.expected_points.length) {
    // Mismatch - continue anyway
  }
}

/**
 * Map LLM response to EvaluationResult interface
 */
function mapToEvaluationResult(data: any): EvaluationResult {
  // Ensure score determines isCorrect (score >= 6 = correct)
  const isCorrect = data.score_0_10 >= 6;
  
  return {
    isCorrect,
    score_0_10: Math.round(data.score_0_10),
    grading: {
      expected_points: data.grading.expected_points,
      matches: data.grading.matches
    },
    whyWrong: data.whyWrong || '',
    idealAnswer: data.idealAnswer || '',
    missingPoints: Array.isArray(data.missingPoints) ? data.missingPoints : [],
    goodParts: Array.isArray(data.goodParts) ? data.goodParts : [],
    examplePhrases: Array.isArray(data.examplePhrases) ? data.examplePhrases : [],
    KB_GAP: data.KB_GAP === true
  };
}

/**
 * Create a fallback evaluation when LLM fails
 */
function createFallbackEvaluation(userAnswer: string): EvaluationResult {
  const answerLength = userAnswer.trim().length;
  const score = answerLength > 50 ? 5 : 3; // Basic heuristic
  
  return {
    isCorrect: false,
    score_0_10: score,
    grading: {
      expected_points: [
        {
          point: 'Системная ошибка оценки',
          source_quote: 'Не удалось выполнить семантическую оценку'
        }
      ],
      matches: [
        {
          point: 'Системная ошибка оценки',
          status: 'MISS',
          comment: 'Оценка выполнена резервной системой'
        }
      ]
    },
    whyWrong: 'Не удалось выполнить полную семантическую оценку. Обратитесь к куратору для ручной проверки.',
    idealAnswer: 'Обратитесь к куратору для получения образца ответа.',
    missingPoints: ['Требуется ручная проверка куратором'],
    goodParts: answerLength > 50 ? ['Развернутый ответ предоставлен'] : [],
    examplePhrases: [],
    KB_GAP: true
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate score from match statuses
 * score = 10 * (MATCH + 0.5*PARTIAL) / total
 */
export function calculateScore(matches: MatchResult[]): number {
  if (matches.length === 0) return 0;
  
  let matchCount = 0;
  let partialCount = 0;
  
  for (const match of matches) {
    if (match.status === 'MATCH') matchCount++;
    else if (match.status === 'PARTIAL') partialCount++;
  }
  
  const score = (matchCount + 0.5 * partialCount) / matches.length * 10;
  return Math.round(score);
}

/**
 * Check if answer is correct (score >= 6)
 */
export function isAnswerCorrect(score: number): boolean {
  return score >= 6;
}
