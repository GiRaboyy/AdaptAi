import { z } from "zod";

/**
 * Canonical Step Type Definitions
 * These interfaces define the exact contract between frontend and backend
 * for all step types in the course generation system.
 */

// ============================================================================
// CourseGenV2 - Batched Generation Types
// ============================================================================

/**
 * Course size presets for deterministic question counts
 * S = 12 questions (1 batch)
 * M = 24 questions (2 batches)
 * L = 36 questions (3 batches)
 * Custom = user-defined total (ceil(total/12) batches)
 */
export type CourseSizePreset = 'S' | 'M' | 'L' | 'Custom';

export const COURSE_SIZE_CONFIG: Record<Exclude<CourseSizePreset, 'Custom'>, { totalQuestions: number; batches: number }> = {
  S: { totalQuestions: 12, batches: 1 },
  M: { totalQuestions: 24, batches: 2 },
  L: { totalQuestions: 36, batches: 3 },
};

/** UI-friendly labels for course sizes */
export const COURSE_SIZE_LABELS: Record<Exclude<CourseSizePreset, 'Custom'>, { title: string; subtitle: string }> = {
  S: { title: 'Короткий', subtitle: '12 вопросов' },
  M: { title: 'Средний', subtitle: '24 вопроса' },
  L: { title: 'Большой', subtitle: '36 вопросов' },
};

export const BATCH_SIZE = 12; // Fixed: each batch = 12 questions

/**
 * Generation settings from UI
 */
export interface CourseGenV2Settings {
  courseSize: CourseSizePreset;
  customTotalQuestions?: number; // Only for Custom mode
  enabledTypes: {
    mcq: boolean;
    open: boolean;
    roleplay: boolean;
  };
  /** Quotas mode: either explicit counts or percentages */
  quotaMode: 'counts' | 'percentages';
  /** Explicit counts (sum must equal totalQuestions) */
  typeCounts?: {
    mcq: number;
    open: number;
    roleplay: number;
  };
  /** Percentages (server converts to counts) */
  typePercentages?: {
    mcq: number;
    open: number;
    roleplay: number;
  };
}

/**
 * Batch plan - how many questions of each type per batch
 */
export interface BatchPlan {
  batchIndex: number; // 0-based
  totalBatches: number;
  questionCount: number; // Questions in this batch (usually 12, may be less for last batch)
  typeQuotas: {
    mcq: number;
    open: number;
    roleplay: number;
  };
}

/**
 * Batch response schema - what LLM returns for one batch
 */
export const BatchStepMcqSchema = z.object({
  type: z.literal('mcq'),
  tag: z.string(),
  question: z.string().min(1),
  options: z.array(z.string()).min(2).max(6), // Allow 2-6 options, we'll normalize to 4
  correct_index: z.number().int().min(0).max(5), // Allow up to 5 for flexibility
  explanation: z.string().optional(),
  kb_refs: z.array(z.number()).default([]),
  kb_gap: z.boolean().default(false),
});

// Rubric can be either string array or object array (LLM may return either format)
export const BatchRubricStringOrObjectSchema = z.union([
  z.string(),
  z.object({
    criterion: z.string().optional(),
    criteria: z.string().optional(),
    score: z.number().optional(),
    max_score: z.number().optional(),
  }),
]);

export const BatchStepOpenSchema = z.object({
  type: z.literal('open'),
  tag: z.string(),
  prompt: z.string().min(1),
  sample_good_answer: z.string().optional(),
  rubric: z.array(BatchRubricStringOrObjectSchema).min(1),
  kb_refs: z.array(z.number()).default([]),
  kb_gap: z.boolean().default(false),
});

export const BatchRubricItemSchema = z.object({
  criterion: z.string(),
  max_score: z.number(),
});

export const BatchStepRoleplaySchema = z.object({
  type: z.literal('roleplay'),
  tag: z.string(),
  scenario: z.string().min(1),
  ai_role: z.string().min(1),
  user_role: z.string().min(1),
  task: z.string().min(1),
  ideal_answer: z.string().optional(),
  rubric: z.array(BatchRubricItemSchema).min(1),
  kb_refs: z.array(z.number()).default([]),
  kb_gap: z.boolean().default(false),
});

export const BatchStepSchema = z.discriminatedUnion('type', [
  BatchStepMcqSchema,
  BatchStepOpenSchema,
  BatchStepRoleplaySchema,
]);

export type BatchStep = z.infer<typeof BatchStepSchema>;

export const BatchCountsSchema = z.object({
  mcq: z.number().int().min(0),
  open: z.number().int().min(0),
  roleplay: z.number().int().min(0),
});

export const BatchResponseSchema = z.object({
  batch: z.object({
    batch_index: z.number().int().min(1),
    total_batches: z.number().int().min(1),
    module_title: z.string().min(1),
    steps: z.array(BatchStepSchema).min(1),
    counts: BatchCountsSchema,
  }),
});

export type BatchResponse = z.infer<typeof BatchResponseSchema>;

/**
 * Validation result for a batch
 */
export interface BatchValidationResult {
  valid: boolean;
  errors: string[];
  stepCount: number;
  typeCounts: { mcq: number; open: number; roleplay: number };
}

/**
 * Batch generation result
 */
export interface BatchGenerationResult {
  batchIndex: number;
  success: boolean;
  attempts: number;
  moduleTitle?: string;
  steps?: BatchStep[];
  error?: string;
  errorType?: 'json_parse' | 'schema_validation' | 'count_mismatch' | 'forbidden_type' | 'api_error';
}

/**
 * Full course generation result
 */
export interface CourseGenV2Result {
  success: boolean;
  totalQuestions: number;
  generatedQuestions: number;
  batches: BatchGenerationResult[];
  modules: Array<{
    title: string;
    steps: any[]; // Normalized to DB format
  }>;
  quotas: {
    requested: { mcq: number; open: number; roleplay: number };
    actual: { mcq: number; open: number; roleplay: number };
  };
  error?: string;
  canRetry?: boolean;
}

// ============================================================================
// Multiple Choice Question (MCQ)
// ============================================================================

export const MCQContentSchema = z.object({
  question: z.string().max(240, "Question must be ≤240 chars"),
  options: z.tuple([z.string(), z.string(), z.string(), z.string()]),
  correct_index: z.number().int().min(0).max(3),
  explanation: z.string().max(400, "Explanation must be ≤400 chars").optional(),
});

export type MCQContent = z.infer<typeof MCQContentSchema>;

export const MCQStepSchema = z.object({
  type: z.literal("mcq"),
  tag: z.string().optional(),
  objective: z.string().optional(),
  kb_refs: z.array(z.number()).default([]),
  source_quote: z.string().max(150).optional(),
  kb_gap: z.boolean().default(false),
  content: MCQContentSchema,
});

export type MCQStep = z.infer<typeof MCQStepSchema>;

// ============================================================================
// Open Question
// ============================================================================

export const RubricItemSchema = z.object({
  score: z.number(),
  criteria: z.string(),
});

export const OpenContentSchema = z.object({
  question: z.string(),
  rubric: z.array(RubricItemSchema).min(3).max(5),
  ideal_answer: z.string().optional(),
});

export type OpenContent = z.infer<typeof OpenContentSchema>;

export const OpenStepSchema = z.object({
  type: z.literal("open"),
  tag: z.string().optional(),
  objective: z.string().optional(),
  kb_refs: z.array(z.number()).default([]),
  source_quote: z.string().max(150).optional(),
  kb_gap: z.boolean().default(false),
  content: OpenContentSchema,
});

export type OpenStep = z.infer<typeof OpenStepSchema>;

// ============================================================================
// Roleplay
// ============================================================================

export const RoleplayContentSchema = z.object({
  scenario: z.string().max(600, "Scenario must be ≤600 chars"),
  ai_role: z.string(),
  user_role: z.string(),
  task: z.string().max(200, "Task must be ≤200 chars"),
  rubric: z.array(RubricItemSchema).min(2).max(6),
  ideal_answer: z.string().optional(),
});

export type RoleplayContent = z.infer<typeof RoleplayContentSchema>;

export const RoleplayStepSchema = z.object({
  type: z.literal("roleplay"),
  tag: z.string().optional(),
  objective: z.string().optional(),
  kb_refs: z.array(z.number()).default([]),
  source_quote: z.string().max(150).optional(),
  kb_gap: z.boolean().default(false),
  content: RoleplayContentSchema,
});

export type RoleplayStep = z.infer<typeof RoleplayStepSchema>;

// ============================================================================
// Union Type for All Steps
// ============================================================================

export const StepSchema = z.discriminatedUnion("type", [
  MCQStepSchema,
  OpenStepSchema,
  RoleplayStepSchema,
]);

export type Step = z.infer<typeof StepSchema>;

// ============================================================================
// Course Structure
// ============================================================================

export interface Module {
  title: string;
  goal?: string;
  module_tag?: string;
  steps: Step[];
}

export interface Course {
  title: string;
  description?: string;
  modules: Module[];
}

export const CourseSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  modules: z.array(z.object({
    title: z.string(),
    goal: z.string().optional(),
    module_tag: z.string().optional(),
    steps: z.array(StepSchema),
  })),
});

// ============================================================================
// Course Generation Configuration
// ============================================================================

export interface CourseGenerationConfig {
  title: string;
  description?: string;
  questionTypes: {
    mcq: boolean;
    open: boolean;
    roleplay: boolean;
  };
  courseSize: "small" | "medium" | "large" | "custom";
  customCounts?: {
    modules: number;
    questions: number;
  };
  distribution?: {
    mcq: number;  // percentage
    open: number;
    roleplay: number;
  };
}

export interface CourseBudget {
  modulesMin: number;
  modulesMax: number;
  questionsMin: number;
  questionsMax: number;
  typeDistribution: {
    mcq: number;
    open: number;
    roleplay: number;
  };
}

// ============================================================================
// Error Types
// ============================================================================

export type CourseGenerationErrorType =
  | "pdf_encrypted"
  | "pdf_scanned"
  | "insufficient_text"
  | "generation_failed"
  | "invalid_json"
  | "insufficient_questions"
  | "db_transaction_failed"
  | "invalid_step_type"
  | "schema_validation_failed"
  | "content_type_forbidden";

export interface CourseGenerationError {
  type: CourseGenerationErrorType;
  message: string;
  retryable: boolean;
  details?: Record<string, any>;
}

// ============================================================================
// Validation Rules
// ============================================================================

/**
 * Validation rule: kb_gap=true requires empty/omitted ideal_answer and explanation
 */
export function validateKBGapRules(step: Step): string[] {
  const errors: string[] = [];
  
  if (step.kb_gap) {
    if (step.type === "mcq" && step.content.explanation) {
      errors.push("MCQ with kb_gap=true must have empty explanation");
    }
    if ((step.type === "open" || step.type === "roleplay") && step.content.ideal_answer) {
      errors.push(`${step.type} with kb_gap=true must have empty ideal_answer`);
    }
  }
  
  if (!step.kb_gap && (!step.kb_refs || step.kb_refs.length === 0)) {
    errors.push("Step without kb_gap must have non-empty kb_refs");
  }
  
  if (!step.kb_gap && !step.source_quote) {
    errors.push("Step without kb_gap must have source_quote");
  }
  
  return errors;
}

/**
 * Validate MCQ quality (distractor plausibility, length consistency)
 */
export function validateMCQQuality(mcq: MCQStep): string[] {
  const errors: string[] = [];
  const options = mcq.content.options;
  
  // Check exactly 4 options
  if (options.length !== 4) {
    errors.push(`MCQ must have exactly 4 options, found ${options.length}`);
    return errors;
  }
  
  // Check length consistency (max 2.5x difference)
  const lengths = options.map(o => o.length);
  const maxLen = Math.max(...lengths);
  const minLen = Math.min(...lengths);
  
  if (minLen > 0 && maxLen / minLen > 2.5) {
    errors.push(`MCQ options have inconsistent length (ratio: ${(maxLen / minLen).toFixed(1)}x, max: 2.5x)`);
  }
  
  // Check correct_index is valid
  if (mcq.content.correct_index < 0 || mcq.content.correct_index > 3) {
    errors.push(`MCQ correct_index must be 0-3, found ${mcq.content.correct_index}`);
  }
  
  return errors;
}

/**
 * ALLOWED STEP TYPES - "content" is FORBIDDEN
 */
export const ALLOWED_STEP_TYPES = ["mcq", "open", "roleplay"] as const;
export type AllowedStepType = typeof ALLOWED_STEP_TYPES[number];

// ============================================================================
// Step Editor Models - For curator editing UI
// ============================================================================

/**
 * MCQ Editor Model
 * - Question (required)
 * - 4 options (required, no duplicates)
 * - correctIndex (required, 0-3)
 * - explanation (optional, in Advanced section)
 * - kb_refs (read-only, in Advanced section)
 */
export const MCQEditorSchema = z.object({
  type: z.literal("mcq"),
  question: z.string().min(1, "Вопрос обязателен").max(500),
  options: z.tuple([z.string(), z.string(), z.string(), z.string()])
    .refine(
      (opts) => opts.every(o => o.trim().length > 0),
      "Все 4 варианта ответа обязательны"
    )
    .refine(
      (opts) => new Set(opts.map(o => o.toLowerCase().trim())).size === 4,
      "Варианты ответов не должны дублироваться"
    ),
  correctIndex: z.number().int().min(0).max(3, "Выберите правильный ответ (0-3)"),
  explanation: z.string().max(500).optional(),
  kb_refs: z.array(z.number()).default([]),
  tag: z.string().optional(),
});

export type MCQEditorModel = z.infer<typeof MCQEditorSchema>;

/**
 * Open Question Editor Model
 * - Question (required)
 * - Rubric (required, scoring criteria)
 * - hasSampleAnswer toggle (controls visibility of sample_good_answer)
 * - sample_good_answer (optional, shown only when toggle is ON)
 * - kb_refs (read-only, in Advanced section)
 */
export const OpenEditorSchema = z.object({
  type: z.literal("open"),
  question: z.string().min(1, "Вопрос обязателен").max(500),
  rubric: z.array(z.object({
    score: z.number(),
    criteria: z.string().min(1),
  })).min(1, "Критерии оценки обязательны (минимум 1 пункт)"),
  hasSampleAnswer: z.boolean().default(false),
  sample_good_answer: z.string().max(1000).optional(),
  kb_refs: z.array(z.number()).default([]),
  tag: z.string().optional(),
});

export type OpenEditorModel = z.infer<typeof OpenEditorSchema>;

/**
 * Roleplay Editor Model
 * - Scenario (required)
 * - user_role (required)
 * - ai_role (required, default "Клиент")
 * - goal (required, 1 phrase describing the objective)
 * - rules (optional, 0-3 rules/constraints)
 * - turns_total (optional, default 6)
 * - kb_refs (read-only, in Advanced section)
 */
export const RoleplayEditorSchema = z.object({
  type: z.literal("roleplay"),
  scenario: z.string().min(1, "Сценарий обязателен").max(800),
  user_role: z.string().min(1, "Роль сотрудника обязательна").max(100),
  ai_role: z.string().min(1, "Роль AI обязательна").max(100),
  goal: z.string().min(1, "Цель диалога обязательна").max(300),
  rules: z.array(z.string()).max(3).optional(),
  turns_total: z.number().int().min(2).max(20).default(6),
  kb_refs: z.array(z.number()).default([]),
  tag: z.string().optional(),
});

export type RoleplayEditorModel = z.infer<typeof RoleplayEditorSchema>;

/**
 * Union type for all step editor models
 */
export const StepEditorSchema = z.discriminatedUnion("type", [
  MCQEditorSchema,
  OpenEditorSchema,
  RoleplayEditorSchema,
]);

export type StepEditorModel = z.infer<typeof StepEditorSchema>;

/**
 * Validation function for step editor - returns human-readable errors in Russian
 */
export function validateStepEditor(step: unknown): { valid: boolean; errors: string[] } {
  const result = StepEditorSchema.safeParse(step);
  
  if (result.success) {
    return { valid: true, errors: [] };
  }
  
  const errors = result.error.issues.map(issue => {
    // Map Zod error paths to human-readable Russian messages
    const path = issue.path.join('.');
    
    switch (issue.code) {
      case 'invalid_type':
        return `Поле "${path}": неверный тип данных`;
      case 'too_small':
        if (issue.minimum === 1) return `Поле "${path}" обязательно`;
        return `Поле "${path}": минимум ${issue.minimum} символов`;
      case 'too_big':
        return `Поле "${path}": максимум ${issue.maximum} символов`;
      default:
        return issue.message || `Ошибка в поле "${path}"`;
    }
  });
  
  return { valid: false, errors };
}

/**
 * Convert step editor model to backend step content format
 */
export function editorModelToStepContent(model: StepEditorModel): any {
  switch (model.type) {
    case 'mcq':
      return {
        question: model.question,
        options: model.options,
        correct_index: model.correctIndex,
        correctIdx: model.correctIndex, // Legacy support
        explanation: model.explanation,
        kb_refs: model.kb_refs,
      };
    case 'open':
      return {
        question: model.question,
        rubric: model.rubric,
        ideal_answer: model.hasSampleAnswer ? model.sample_good_answer : undefined,
        idealAnswer: model.hasSampleAnswer ? model.sample_good_answer : undefined, // Legacy
        kb_refs: model.kb_refs,
      };
    case 'roleplay':
      return {
        scenario: model.scenario,
        user_role: model.user_role,
        userRole: model.user_role, // Legacy support
        ai_role: model.ai_role,
        aiRole: model.ai_role, // Legacy support  
        task: model.goal,
        goal: model.goal,
        rules: model.rules,
        turns_total: model.turns_total,
        kb_refs: model.kb_refs,
      };
  }
}

/**
 * Convert backend step content to editor model
 */
export function stepContentToEditorModel(type: string, content: any): StepEditorModel | null {
  if (!content) return null;
  
  switch (type) {
    case 'mcq':
    case 'quiz': // Legacy support
      const options = content.options || ['', '', '', ''];
      // Ensure exactly 4 options
      while (options.length < 4) options.push('');
      return {
        type: 'mcq',
        question: content.question || '',
        options: [options[0], options[1], options[2], options[3]] as [string, string, string, string],
        correctIndex: content.correct_index ?? content.correctIdx ?? 0,
        explanation: content.explanation,
        kb_refs: content.kb_refs || [],
        tag: content.tag,
      };
    case 'open':
      return {
        type: 'open',
        question: content.question || '',
        rubric: content.rubric || [{ score: 0, criteria: 'Неверно' }, { score: 5, criteria: 'Частично' }, { score: 10, criteria: 'Верно' }],
        hasSampleAnswer: !!(content.ideal_answer || content.idealAnswer || content.sample_good_answer),
        sample_good_answer: content.ideal_answer || content.idealAnswer || content.sample_good_answer || '',
        kb_refs: content.kb_refs || [],
        tag: content.tag,
      };
    case 'roleplay':
      return {
        type: 'roleplay',
        scenario: content.scenario || '',
        user_role: content.user_role || content.userRole || '',
        ai_role: content.ai_role || content.aiRole || 'Клиент',
        goal: content.goal || content.task || '',
        rules: content.rules || [],
        turns_total: content.turns_total || 6,
        kb_refs: content.kb_refs || [],
        tag: content.tag,
      };
    default:
      return null; // Content steps are hidden
  }
}

/**
 * Validate course structure (question count, type distribution, no content steps)
 */
export function validateCourse(course: Course, budget?: CourseBudget): string[] {
  const errors: string[] = [];
  
  // Count steps by type
  const counts = {
    mcq: 0,
    open: 0,
    roleplay: 0,
    total: 0,
    invalid: 0,
  };
  
  course.modules.forEach(module => {
    module.steps.forEach(step => {
      counts.total++;
      const stepType = (step as any).type as string;
      if (stepType === "mcq") counts.mcq++;
      else if (stepType === "open") counts.open++;
      else if (stepType === "roleplay") counts.roleplay++;
      else {
        counts.invalid++;
        errors.push(`CRITICAL: Invalid step type "${stepType}" - only mcq/open/roleplay allowed. "content" is FORBIDDEN.`);
      }
    });
  });
  
  // CRITICAL: If any invalid types found, this is a fatal error
  if (counts.invalid > 0) {
    errors.unshift(`FATAL: Found ${counts.invalid} steps with invalid/forbidden types. Course cannot be saved.`);  
  }
  
  // Check minimum question count
  if (budget && counts.total < budget.questionsMin) {
    errors.push(`Insufficient questions: ${counts.total} generated, minimum ${budget.questionsMin} required`);
  }
  
  // Check type distribution (±15% tolerance)
  if (budget && counts.total > 0) {
    const actual = {
      mcq: (counts.mcq / counts.total) * 100,
      open: (counts.open / counts.total) * 100,
      roleplay: (counts.roleplay / counts.total) * 100,
    };
    
    const tolerance = 15;
    
    if (Math.abs(actual.mcq - budget.typeDistribution.mcq) > tolerance) {
      errors.push(`MCQ distribution ${actual.mcq.toFixed(1)}% exceeds tolerance from target ${budget.typeDistribution.mcq}%`);
    }
    if (Math.abs(actual.open - budget.typeDistribution.open) > tolerance) {
      errors.push(`Open distribution ${actual.open.toFixed(1)}% exceeds tolerance from target ${budget.typeDistribution.open}%`);
    }
    if (Math.abs(actual.roleplay - budget.typeDistribution.roleplay) > tolerance) {
      errors.push(`Roleplay distribution ${actual.roleplay.toFixed(1)}% exceeds tolerance from target ${budget.typeDistribution.roleplay}%`);
    }
  }
  
  // Validate each step
  course.modules.forEach((module, mIdx) => {
    module.steps.forEach((step, sIdx) => {
      const kbErrors = validateKBGapRules(step);
      kbErrors.forEach(err => errors.push(`Module ${mIdx+1}, Step ${sIdx+1}: ${err}`));
      
      if (step.type === "mcq") {
        const mcqErrors = validateMCQQuality(step as MCQStep);
        mcqErrors.forEach(err => errors.push(`Module ${mIdx+1}, Step ${sIdx+1}: ${err}`));
      }
    });
  });
  
  return errors;
}
