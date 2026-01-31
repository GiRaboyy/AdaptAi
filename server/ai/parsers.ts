import type { Express } from "express";
import mammoth from "mammoth";
import { PDFParse } from 'pdf-parse';

/**
 * File Parser Module for ADAPT Platform
 * 
 * Handles extraction of text content from various file formats:
 * - TXT, MD: Plain text files
 * - DOCX: Word documents (via mammoth)
 * - PDF: PDF documents (via pdf-parse PDFParse class)
 * - JPG, PNG: Images (placeholder for future OCR)
 * 
 * All parsers handle errors gracefully with Russian user-friendly messages.
 */

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB for documents
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;  // 5 MB for images

/**
 * Main entry point for file text extraction
 * Routes to appropriate parser based on file extension
 */
export async function extractTextFromFile(file: Express.Multer.File): Promise<string> {
  const ext = file.originalname.toLowerCase().split('.').pop();
  const logPrefix = `[Parser] file="${file.originalname}"`;
  
  console.log(`${logPrefix} Processing file: type=${ext}, size=${(file.size / 1024).toFixed(1)}KB`);
  
  // Check file size limits
  if (ext === 'jpg' || ext === 'jpeg' || ext === 'png') {
    if (file.size > MAX_IMAGE_SIZE) {
      throw new Error(`Файл слишком большой. Максимум 5 МБ для изображений.`);
    }
  } else {
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`Файл слишком большой. Максимум 20 МБ для документов.`);
    }
  }
  
  try {
    switch (ext) {
      case 'txt':
      case 'md':
        return extractTextFromPlainText(file.buffer);
      
      case 'docx':
        return await extractTextFromDOCX(file.buffer);
      
      case 'pdf':
        const pdfResult = await extractTextFromPDF(file.buffer, file.originalname);
        return pdfResult.fullText;
      
      case 'jpg':
      case 'jpeg':
      case 'png':
        return handleImageUpload(file);
      
      default:
        throw new Error(`Формат ${ext} не поддерживается. Используйте PDF, DOC, DOCX, TXT, MD.`);
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('не поддерживается')) {
      throw error;
    }
    if (error instanceof Error && error.message.includes('слишком большой')) {
      throw error;
    }
    // Re-throw specific PDF errors
    if (error instanceof Error && (
      error.message.includes('Извлечено слишком мало текста') ||
      error.message.includes('не содержит текстового слоя') ||
      error.message.includes('защищён паролем')
    )) {
      throw error;
    }
    console.error(`${logPrefix} Error extracting text from ${ext} file:`, error);
    throw new Error(`Не удалось прочитать файл. Проверьте, что файл не повреждён.`);
  }
}

/**
 * Extract text from plain text files (TXT, MD)
 */
function extractTextFromPlainText(buffer: Buffer): string {
  try {
    const text = buffer.toString('utf-8');
    // Remove null bytes and excessive whitespace
    return text
      .replace(/\x00/g, '')
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  } catch (error) {
    console.error('[Parser] Error reading plain text:', error);
    throw new Error('Не удалось прочитать текстовый файл.');
  }
}

/**
 * Extract text from DOCX files using mammoth
 */
export async function extractTextFromDOCX(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    
    if (!result.value) {
      throw new Error('Документ пустой');
    }
    
    // Clean up extracted text
    return result.value
      .replace(/\x00/g, '')
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  } catch (error) {
    console.error('[Parser] Error extracting DOCX:', error);
    if (error instanceof Error && error.message.includes('пустой')) {
      throw error;
    }
    throw new Error('Не удалось прочитать DOCX файл. Проверьте, что файл не повреждён.');
  }
}

export interface PDFExtractionResult {
  fullText: string;
  pageCount: number;
  extractedCharCount: number;
  metadata: {
    encrypted: boolean;
  };
}

/**
 * Extract text from PDF files using pdf-parse PDFParse class
 * Returns metadata object with extracted text and statistics
 */
export async function extractTextFromPDF(buffer: Buffer, filename?: string): Promise<PDFExtractionResult> {
  const startTime = Date.now();
  const logPrefix = `[Parser]${filename ? ` file="${filename}"` : ''}`;
  
  console.log(`${logPrefix} PDF extraction started, size=${(buffer.length / 1024).toFixed(1)}KB`);
  
  let pdfParser: PDFParse | null = null;
  
  try {
    // Create PDFParse instance with the buffer data
    pdfParser = new PDFParse({ data: buffer });
    
    // Get info to check encryption and page count
    const info = await pdfParser.getInfo();
    const isEncrypted = info.info?.IsEncrypted === true || info.info?.Encrypted === true || false;
    const pageCount = info.total || 0;
    
    // Extract text
    const textResult = await pdfParser.getText();
    const rawText = textResult.text || '';
    
    if (!rawText || rawText.trim().length === 0) {
      throw new Error('PDF не содержит текстового слоя. Это может быть отсканированный документ. Экспортируйте PDF с текстом или используйте TXT/DOCX.');
    }
    
    // Clean up extracted text
    // PDFs often have weird spacing, clean it up
    const cleanedText = rawText
      .replace(/\x00/g, '')
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\s+/g, ' ')
      .trim();
    
    const charCount = cleanedText.length;
    const durationMs = Date.now() - startTime;
    
    // Validate minimum text length (per memory: if < 500, show specific error)
    if (charCount < 500) {
      console.warn(`${logPrefix} Low char count: ${charCount} chars from ${pageCount} pages`);
      throw new Error(`Не удалось извлечь читаемый текст из PDF (${charCount} символов). Попробуйте экспортировать PDF с текстом или загрузите .txt/.md файл.`);
    }
    
    console.log(`${logPrefix} PDF extraction success: pages=${pageCount}, chars=${charCount}, duration=${durationMs}ms`);
    
    return {
      fullText: cleanedText,
      pageCount: pageCount,
      extractedCharCount: charCount,
      metadata: {
        encrypted: isEncrypted
      }
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    console.error(`${logPrefix} PDF extraction failed after ${durationMs}ms:`, error instanceof Error ? error.message : error);
    if (error instanceof Error && error.stack) {
      console.error(`${logPrefix} Stack trace:`, error.stack);
    }
    
    if (error instanceof Error) {
      if (error.message.includes('password') || error.message.includes('encrypted') || error.message.includes('Password')) {
        throw new Error('PDF защищён паролем. Загрузите незащищённую версию.');
      }
      if (error.message.includes('Не удалось извлечь') || error.message.includes('не содержит текстового слоя')) {
        throw error;
      }
    }
    
    throw new Error('Не удалось прочитать PDF файл. Проверьте, что файл не повреждён.');
  } finally {
    // Clean up the parser
    if (pdfParser) {
      try {
        await pdfParser.destroy();
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }
}

/**
 * Handle image uploads (placeholder for future OCR integration)
 * For MVP, just return a message asking user to paste text manually
 */
function handleImageUpload(file: Express.Multer.File): string {
  // Image upload handling
  
  // For MVP, return empty string with a note
  // In future, integrate OCR service here (GigaChat Vision, Tesseract, etc.)
  return `[ИЗОБРАЖЕНИЕ: ${file.originalname}]\nОCR не поддерживается. Пожалуйста, вставьте текст вручную.\n\n`;
}

/**
 * Validate and normalize knowledge base text
 * Removes excessive whitespace, empty lines, and ensures UTF-8 NFC normalization
 */
export function normalizeKnowledgeBase(text: string): string {
  // Apply NFC normalization for consistent UTF-8 encoding (critical for Cyrillic)
  const normalized = text.normalize('NFC');
  
  return normalized
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\t/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Get file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Check if KB is large enough to generate a comprehensive course
 */
export function isLargeKB(text: string): boolean {
  return text.length > 50000; // ~50k chars = ~10k words
}

/**
 * Get recommended module count based on KB size
 */
export function getRecommendedModuleCount(kbLength: number): { min: number, max: number } {
  if (kbLength > 100000) return { min: 10, max: 12 };
  if (kbLength > 50000) return { min: 8, max: 10 };
  if (kbLength > 20000) return { min: 6, max: 8 };
  if (kbLength > 10000) return { min: 5, max: 7 };
  return { min: 4, max: 6 };
}

/**
 * Get recommended step count based on KB size
 */
export function getRecommendedStepCount(kbLength: number): { min: number, max: number } {
  if (kbLength > 100000) return { min: 60, max: 80 };
  if (kbLength > 50000) return { min: 48, max: 60 };
  if (kbLength > 20000) return { min: 30, max: 40 };
  if (kbLength > 10000) return { min: 20, max: 30 };
  if (kbLength > 5000) return { min: 15, max: 25 };
  return { min: 10, max: 15 };
}

export interface CourseBudget {
  modulesMin: number;
  modulesMax: number;
  lessonsPerModuleMin: number;
  lessonsPerModuleMax: number;
  questionsPerLessonMin: number;
  questionsPerLessonMax: number;
  totalQuestionsMin: number;
  totalQuestionsMax: number;
}

// Scaling configuration constants (adjustable)
const SCALING_TIERS = [
  { maxChars: 8000, questionsMin: 7, questionsMax: 12, modulesMin: 1, modulesMax: 2 },
  { maxChars: 25000, questionsMin: 12, questionsMax: 25, modulesMin: 2, modulesMax: 3 },
  { maxChars: 60000, questionsMin: 25, questionsMax: 45, modulesMin: 3, modulesMax: 5 },
  { maxChars: 120000, questionsMin: 45, questionsMax: 80, modulesMin: 5, modulesMax: 7 },
  { maxChars: Infinity, questionsMin: 80, questionsMax: 140, modulesMin: 7, modulesMax: 10 }
];

const COMPLEXITY_WEIGHT = 0.3; // Weight for complexity adjustment
const MIN_QUESTIONS_PER_MODULE = 5;
const MAX_QUESTIONS_PER_MODULE = 15;

/**
 * Calculate complexity factor based on KB structure
 * Higher factor for more structured content (more headings/sections)
 */
export function calculateComplexityFactor(chunks: Array<{ sectionTitle?: string | null }>): number {
  const headingCount = chunks.filter(c => c.sectionTitle && c.sectionTitle.length > 0).length;
  const totalChunks = chunks.length;
  
  if (totalChunks === 0) return 1.0;
  
  // density_score = min(1.0, heading_count / (total_chunks * 0.15))
  const densityScore = Math.min(1.0, headingCount / (totalChunks * 0.15));
  
  // complexity_factor = 1.0 + (0.3 * density_score)
  return 1.0 + (COMPLEXITY_WEIGHT * densityScore);
}

/**
 * Calculate dynamic course budget based on KB size and target duration
 * Scales module/lesson/question counts to match KB content depth
 * Implements new scaling tiers from design spec
 */
export function calculateCourseBudget(params: {
  kbCharCount: number;
  targetDurationMinutes?: number;
  difficultyLevel?: string;
  complexityFactor?: number;
}): CourseBudget {
  const { kbCharCount, targetDurationMinutes = 45, difficultyLevel = 'mixed', complexityFactor = 1.0 } = params;
  
  // Find appropriate scaling tier
  const tier = SCALING_TIERS.find(t => kbCharCount < t.maxChars) || SCALING_TIERS[SCALING_TIERS.length - 1];
  
  // Apply complexity adjustment to question counts
  const questionsMin = Math.round(tier.questionsMin * complexityFactor);
  const questionsMax = Math.round(tier.questionsMax * complexityFactor);
  
  // Calculate module and lesson distribution
  const modulesMin = tier.modulesMin;
  const modulesMax = tier.modulesMax;
  
  // Calculate lessons per module to achieve target questions
  const avgQuestionsTarget = (questionsMin + questionsMax) / 2;
  const avgModules = (modulesMin + modulesMax) / 2;
  const avgLessonsPerModule = Math.ceil(avgQuestionsTarget / avgModules / 4); // ~4 questions per lesson
  
  const lessonsPerModuleMin = Math.max(2, Math.floor(avgLessonsPerModule * 0.8));
  const lessonsPerModuleMax = Math.ceil(avgLessonsPerModule * 1.2);
  
  // Questions per lesson
  const questionsPerLessonMin = 3;
  const questionsPerLessonMax = 25;
  
  return {
    modulesMin,
    modulesMax,
    lessonsPerModuleMin,
    lessonsPerModuleMax,
    questionsPerLessonMin,
    questionsPerLessonMax,
    totalQuestionsMin: questionsMin,
    totalQuestionsMax: questionsMax
  };
}

/**
 * Extract top keywords from knowledge base for RAG query
 * Returns 5-10 most frequent meaningful words
 */
export function extractTopicsFromKB(text: string, count: number = 10): string {
  // Remove common stop words
  const stopWords = new Set([
    'и', 'в', 'на', 'с', 'по', 'для', 'как', 'что', 'это', 'к', 'от', 'о', 'из', 'у', 'за', 'при',
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should'
  ]);
  
  // Extract words and count frequency
  const words = text
    .toLowerCase()
    .replace(/[^\wа-яё\s]/gi, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopWords.has(word));
  
  const wordCounts = new Map<string, number>();
  words.forEach(word => {
    wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
  });
  
  // Sort by frequency and take top N
  const topWords = Array.from(wordCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([word]) => word);
  
  return topWords.join(' ');
}

// ============================================================================
// DETERMINISTIC COURSE SIZE PRESETS (MVP)
// ============================================================================

export type CourseSize = 'S' | 'M' | 'L';

/**
 * Fixed course size configurations
 * These are DETERMINISTIC - KB can recommend default size but NOT change final counts
 */
export const COURSE_SIZE_PRESETS: Record<CourseSize, { totalQuestions: number; modules: number }> = {
  S: { totalQuestions: 12, modules: 1 },
  M: { totalQuestions: 24, modules: 2 },
  L: { totalQuestions: 36, modules: 3 },
};

/**
 * Recommend a default course size based on KB length
 * This is just a RECOMMENDATION - curator can override
 */
export function recommendCourseSize(kbCharCount: number): CourseSize {
  if (kbCharCount < 5000) return 'S';
  if (kbCharCount < 20000) return 'M';
  return 'L';
}

export interface DeterministicCourseBudget {
  totalQuestions: number;
  modules: number;
  questionsPerModule: number[];  // Distribution per module
  typeQuotas: {
    mcq: number;
    open: number;
    roleplay: number;
  };
  typeDistributionPct: {
    mcq: number;
    open: number;
    roleplay: number;
  };
}

/**
 * Calculate deterministic course budget with fixed S/M/L sizes
 * 
 * Key rules:
 * - S always gives 12 questions, 2 modules
 * - M always gives 24 questions, 4 modules
 * - L always gives 48 questions, 6 modules
 * - KB influences default recommendation ONLY, not final counts
 * - Type quotas sum exactly to totalQuestions
 * - Roleplay capped at max 1 per module
 * - Minimum 1 question per enabled type (if totalQuestions allows)
 */
export function calculateDeterministicBudget(params: {
  courseSize: CourseSize;
  enabledTypes?: { mcq: boolean; open: boolean; roleplay: boolean };
  typeDistribution?: { mcq: number; open: number; roleplay: number };  // percentages
}): DeterministicCourseBudget {
  const { courseSize, enabledTypes, typeDistribution } = params;
  
  // Get fixed size preset
  const preset = COURSE_SIZE_PRESETS[courseSize];
  const { totalQuestions, modules } = preset;
  
  // Default enabled types: all enabled
  const enabled = enabledTypes || { mcq: true, open: true, roleplay: true };
  
  // Default distribution: mcq 60%, open 30%, roleplay 10%
  const defaultDistribution = { mcq: 60, open: 30, roleplay: 10 };
  const distribution = typeDistribution || defaultDistribution;
  
  // Calculate type quotas
  const typeQuotas = calculateTypeQuotas({
    totalQuestions,
    modules,
    enabledTypes: enabled,
    distribution
  });
  
  // Distribute questions evenly across modules
  const questionsPerModule = distributeQuestionsToModules(totalQuestions, modules);
  
  return {
    totalQuestions,
    modules,
    questionsPerModule,
    typeQuotas,
    typeDistributionPct: distribution
  };
}

/**
 * Calculate exact type quotas that sum to totalQuestions
 * 
 * Rules:
 * - Sum must equal totalQuestions exactly
 * - Roleplay max = modules (not more than 1 per module)
 * - Minimum 1 question per enabled type (if totalQuestions allows)
 * - Rounding with compensation to ensure exact sum
 */
function calculateTypeQuotas(params: {
  totalQuestions: number;
  modules: number;
  enabledTypes: { mcq: boolean; open: boolean; roleplay: boolean };
  distribution: { mcq: number; open: number; roleplay: number };
}): { mcq: number; open: number; roleplay: number } {
  const { totalQuestions, modules, enabledTypes, distribution } = params;
  
  // Count enabled types
  const enabledCount = [enabledTypes.mcq, enabledTypes.open, enabledTypes.roleplay].filter(Boolean).length;
  
  if (enabledCount === 0) {
    // Fallback: enable mcq if nothing enabled
    return { mcq: totalQuestions, open: 0, roleplay: 0 };
  }
  
  // Normalize distribution for enabled types only
  let effectiveDist = {
    mcq: enabledTypes.mcq ? distribution.mcq : 0,
    open: enabledTypes.open ? distribution.open : 0,
    roleplay: enabledTypes.roleplay ? distribution.roleplay : 0
  };
  
  const totalPct = effectiveDist.mcq + effectiveDist.open + effectiveDist.roleplay;
  
  // Normalize to 100%
  if (totalPct > 0) {
    effectiveDist.mcq = (effectiveDist.mcq / totalPct) * 100;
    effectiveDist.open = (effectiveDist.open / totalPct) * 100;
    effectiveDist.roleplay = (effectiveDist.roleplay / totalPct) * 100;
  }
  
  // Calculate raw quotas
  let quotas = {
    mcq: Math.round((effectiveDist.mcq / 100) * totalQuestions),
    open: Math.round((effectiveDist.open / 100) * totalQuestions),
    roleplay: Math.round((effectiveDist.roleplay / 100) * totalQuestions)
  };
  
  // Apply roleplay cap: max = modules (1 per module)
  if (quotas.roleplay > modules) {
    const excess = quotas.roleplay - modules;
    quotas.roleplay = modules;
    // Redistribute excess to mcq (most common type)
    quotas.mcq += excess;
  }
  
  // Ensure minimum 1 question per enabled type (if totalQuestions >= enabledCount)
  if (totalQuestions >= enabledCount) {
    if (enabledTypes.mcq && quotas.mcq < 1) quotas.mcq = 1;
    if (enabledTypes.open && quotas.open < 1) quotas.open = 1;
    if (enabledTypes.roleplay && quotas.roleplay < 1) quotas.roleplay = 1;
  }
  
  // Set disabled types to 0
  if (!enabledTypes.mcq) quotas.mcq = 0;
  if (!enabledTypes.open) quotas.open = 0;
  if (!enabledTypes.roleplay) quotas.roleplay = 0;
  
  // Compensate to ensure exact sum
  const currentSum = quotas.mcq + quotas.open + quotas.roleplay;
  const diff = totalQuestions - currentSum;
  
  if (diff !== 0) {
    // Add/subtract from mcq (largest pool usually)
    if (enabledTypes.mcq) {
      quotas.mcq += diff;
    } else if (enabledTypes.open) {
      quotas.open += diff;
    } else if (enabledTypes.roleplay) {
      // Don't exceed roleplay cap
      quotas.roleplay = Math.min(quotas.roleplay + diff, modules);
      // If still have remaining, this is an edge case
    }
  }
  
  // Final validation: ensure non-negative
  quotas.mcq = Math.max(0, quotas.mcq);
  quotas.open = Math.max(0, quotas.open);
  quotas.roleplay = Math.max(0, quotas.roleplay);
  
  return quotas;
}

/**
 * Distribute questions evenly across modules
 * Example: 12 questions, 2 modules → [6, 6]
 * Example: 25 questions, 4 modules → [7, 6, 6, 6]
 */
function distributeQuestionsToModules(totalQuestions: number, modules: number): number[] {
  const base = Math.floor(totalQuestions / modules);
  const remainder = totalQuestions % modules;
  
  const distribution: number[] = [];
  for (let i = 0; i < modules; i++) {
    // First 'remainder' modules get base+1, rest get base
    distribution.push(i < remainder ? base + 1 : base);
  }
  
  return distribution;
}

/**
 * [DEPRECATED] Old function kept for backwards compatibility
 * Use calculateDeterministicBudget instead
 */
export function calculateCourseBudgetWithConfig(params: {
  kbCharCount: number;
  courseSize: 'small' | 'medium' | 'large' | 'custom';
  customCounts?: { modules?: number; questions?: number };
  complexityFactor?: number;
  typeDistribution?: { mcq: number; open: number; roleplay: number };
}): CourseBudget & { typeDistribution: { mcq: number; open: number; roleplay: number } } {
  // Map old courseSize to new CourseSize
  const sizeMap: Record<string, CourseSize> = {
    'small': 'S',
    'medium': 'M',
    'large': 'L',
    'custom': 'M' // Default to M for custom
  };
  
  const newSize = sizeMap[params.courseSize] || 'M';
  const preset = COURSE_SIZE_PRESETS[newSize];
  
  // Handle custom - use provided counts but cap to valid range
  let totalQuestions = preset.totalQuestions;
  let modules = preset.modules;
  
  if (params.courseSize === 'custom' && params.customCounts) {
    totalQuestions = params.customCounts.questions || 24;
    modules = params.customCounts.modules || 4;
  }
  
  const finalTypeDistribution = params.typeDistribution || {
    mcq: 60,
    open: 30,
    roleplay: 10,
  };
  
  return {
    modulesMin: modules,
    modulesMax: modules,
    lessonsPerModuleMin: 1,
    lessonsPerModuleMax: 1,
    questionsPerLessonMin: Math.floor(totalQuestions / modules),
    questionsPerLessonMax: Math.ceil(totalQuestions / modules),
    totalQuestionsMin: totalQuestions,
    totalQuestionsMax: totalQuestions,
    typeDistribution: finalTypeDistribution,
  };
}

// ============================================================================
// COURSEGEN V2 - BATCHED GENERATION ALLOCATION
// ============================================================================

import type { BatchPlan, CourseGenV2Settings, CourseSizePreset } from '@shared/types';
import { BATCH_SIZE, COURSE_SIZE_CONFIG } from '@shared/types';

/**
 * Calculate total questions based on course size settings
 */
export function calculateTotalQuestions(settings: CourseGenV2Settings): number {
  if (settings.courseSize === 'Custom') {
    return settings.customTotalQuestions || 24; // Default to M if not specified
  }
  return COURSE_SIZE_CONFIG[settings.courseSize].totalQuestions;
}

/**
 * Calculate number of batches needed
 */
export function calculateBatchCount(totalQuestions: number): number {
  return Math.ceil(totalQuestions / BATCH_SIZE);
}

/**
 * Convert percentages to absolute counts
 * Ensures sum equals totalQuestions exactly
 */
export function percentagesToCounts(
  totalQuestions: number,
  percentages: { mcq: number; open: number; roleplay: number },
  enabledTypes: { mcq: boolean; open: boolean; roleplay: boolean }
): { mcq: number; open: number; roleplay: number } {
  // Zero out disabled types
  const effectivePct = {
    mcq: enabledTypes.mcq ? percentages.mcq : 0,
    open: enabledTypes.open ? percentages.open : 0,
    roleplay: enabledTypes.roleplay ? percentages.roleplay : 0,
  };
  
  // Normalize to 100%
  const total = effectivePct.mcq + effectivePct.open + effectivePct.roleplay;
  if (total === 0) {
    // Fallback: all mcq if nothing enabled
    return { mcq: totalQuestions, open: 0, roleplay: 0 };
  }
  
  const normalized = {
    mcq: (effectivePct.mcq / total) * 100,
    open: (effectivePct.open / total) * 100,
    roleplay: (effectivePct.roleplay / total) * 100,
  };
  
  // Calculate raw counts (may not sum exactly)
  let counts = {
    mcq: Math.round((normalized.mcq / 100) * totalQuestions),
    open: Math.round((normalized.open / 100) * totalQuestions),
    roleplay: Math.round((normalized.roleplay / 100) * totalQuestions),
  };
  
  // Ensure minimum 1 for each enabled type (if totalQuestions allows)
  const enabledCount = [enabledTypes.mcq, enabledTypes.open, enabledTypes.roleplay].filter(Boolean).length;
  if (totalQuestions >= enabledCount) {
    if (enabledTypes.mcq && counts.mcq < 1) counts.mcq = 1;
    if (enabledTypes.open && counts.open < 1) counts.open = 1;
    if (enabledTypes.roleplay && counts.roleplay < 1) counts.roleplay = 1;
  }
  
  // Compensate to ensure exact sum
  const currentSum = counts.mcq + counts.open + counts.roleplay;
  const diff = totalQuestions - currentSum;
  
  if (diff !== 0) {
    // Add/subtract from mcq (usually largest pool)
    if (enabledTypes.mcq) {
      counts.mcq = Math.max(0, counts.mcq + diff);
    } else if (enabledTypes.open) {
      counts.open = Math.max(0, counts.open + diff);
    } else if (enabledTypes.roleplay) {
      counts.roleplay = Math.max(0, counts.roleplay + diff);
    }
  }
  
  return counts;
}

/**
 * Validate that type counts match enabled types and sum to total
 */
export function validateTypeCounts(
  totalQuestions: number,
  counts: { mcq: number; open: number; roleplay: number },
  enabledTypes: { mcq: boolean; open: boolean; roleplay: boolean }
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check non-negative
  if (counts.mcq < 0) errors.push('mcq count cannot be negative');
  if (counts.open < 0) errors.push('open count cannot be negative');
  if (counts.roleplay < 0) errors.push('roleplay count cannot be negative');
  
  // Check disabled types have 0
  if (!enabledTypes.mcq && counts.mcq > 0) {
    errors.push('mcq is disabled but count > 0');
  }
  if (!enabledTypes.open && counts.open > 0) {
    errors.push('open is disabled but count > 0');
  }
  if (!enabledTypes.roleplay && counts.roleplay > 0) {
    errors.push('roleplay is disabled but count > 0');
  }
  
  // Check sum
  const sum = counts.mcq + counts.open + counts.roleplay;
  if (sum !== totalQuestions) {
    errors.push(`Type counts sum (${sum}) does not equal totalQuestions (${totalQuestions})`);
  }
  
  // Check at least one type enabled with count > 0
  if (sum === 0 && totalQuestions > 0) {
    errors.push('No questions allocated to any type');
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * Calculate global type quotas from settings
 */
export function calculateGlobalQuotas(
  settings: CourseGenV2Settings,
  totalQuestions: number
): { mcq: number; open: number; roleplay: number } {
  if (settings.quotaMode === 'counts' && settings.typeCounts) {
    // Validate and use explicit counts
    const validation = validateTypeCounts(totalQuestions, settings.typeCounts, settings.enabledTypes);
    if (validation.valid) {
      return settings.typeCounts;
    }
    console.warn('[BatchAlloc] Invalid explicit counts, falling back to percentages:', validation.errors);
  }
  
  // Use percentages (default or explicit)
  const percentages = settings.typePercentages || { mcq: 60, open: 30, roleplay: 10 };
  return percentagesToCounts(totalQuestions, percentages, settings.enabledTypes);
}

/**
 * Greedy allocation of type quotas across batches
 * 
 * Algorithm:
 * - For each batch, allocate proportionally based on remaining quotas
 * - Ensure each batch gets at least 1 of each enabled type (if quota allows)
 * - Final batch gets all remaining
 */
export function allocateQuotasToBatches(
  totalBatches: number,
  totalQuestions: number,
  globalQuotas: { mcq: number; open: number; roleplay: number }
): BatchPlan[] {
  const batches: BatchPlan[] = [];
  
  // Remaining quotas to allocate
  const remaining = { ...globalQuotas };
  let remainingQuestions = totalQuestions;
  
  for (let i = 0; i < totalBatches; i++) {
    const isLastBatch = i === totalBatches - 1;
    
    // Questions for this batch
    const batchQuestionCount = isLastBatch 
      ? remainingQuestions 
      : Math.min(BATCH_SIZE, remainingQuestions);
    
    // Allocate types for this batch
    let batchQuotas = { mcq: 0, open: 0, roleplay: 0 };
    
    if (isLastBatch) {
      // Last batch gets all remaining
      batchQuotas = { ...remaining };
    } else {
      // Proportional allocation with greedy approach
      const totalRemaining = remaining.mcq + remaining.open + remaining.roleplay;
      
      if (totalRemaining > 0) {
        // Calculate proportional allocation
        batchQuotas.mcq = Math.round((remaining.mcq / totalRemaining) * batchQuestionCount);
        batchQuotas.open = Math.round((remaining.open / totalRemaining) * batchQuestionCount);
        batchQuotas.roleplay = Math.round((remaining.roleplay / totalRemaining) * batchQuestionCount);
        
        // Cap to remaining
        batchQuotas.mcq = Math.min(batchQuotas.mcq, remaining.mcq);
        batchQuotas.open = Math.min(batchQuotas.open, remaining.open);
        batchQuotas.roleplay = Math.min(batchQuotas.roleplay, remaining.roleplay);
        
        // Compensate for rounding to match batchQuestionCount
        let sum = batchQuotas.mcq + batchQuotas.open + batchQuotas.roleplay;
        const diff = batchQuestionCount - sum;
        
        if (diff > 0) {
          // Add to largest pool with remaining quota
          if (remaining.mcq > batchQuotas.mcq) {
            batchQuotas.mcq += Math.min(diff, remaining.mcq - batchQuotas.mcq);
          }
          sum = batchQuotas.mcq + batchQuotas.open + batchQuotas.roleplay;
          if (sum < batchQuestionCount && remaining.open > batchQuotas.open) {
            batchQuotas.open += Math.min(batchQuestionCount - sum, remaining.open - batchQuotas.open);
          }
          sum = batchQuotas.mcq + batchQuotas.open + batchQuotas.roleplay;
          if (sum < batchQuestionCount && remaining.roleplay > batchQuotas.roleplay) {
            batchQuotas.roleplay += Math.min(batchQuestionCount - sum, remaining.roleplay - batchQuotas.roleplay);
          }
        } else if (diff < 0) {
          // Remove from largest allocation
          const absDiff = Math.abs(diff);
          if (batchQuotas.mcq >= absDiff) {
            batchQuotas.mcq -= absDiff;
          } else if (batchQuotas.open >= absDiff) {
            batchQuotas.open -= absDiff;
          } else if (batchQuotas.roleplay >= absDiff) {
            batchQuotas.roleplay -= absDiff;
          }
        }
      }
    }
    
    // Update remaining
    remaining.mcq -= batchQuotas.mcq;
    remaining.open -= batchQuotas.open;
    remaining.roleplay -= batchQuotas.roleplay;
    remainingQuestions -= batchQuestionCount;
    
    batches.push({
      batchIndex: i,
      totalBatches,
      questionCount: batchQuestionCount,
      typeQuotas: batchQuotas,
    });
  }
  
  return batches;
}

/**
 * Create complete batch plans from CourseGenV2 settings
 */
export function createBatchPlans(settings: CourseGenV2Settings): BatchPlan[] {
  const totalQuestions = calculateTotalQuestions(settings);
  const totalBatches = calculateBatchCount(totalQuestions);
  const globalQuotas = calculateGlobalQuotas(settings, totalQuestions);
  
  console.log(`[BatchAlloc] Creating ${totalBatches} batches for ${totalQuestions} questions`);
  console.log(`[BatchAlloc] Global quotas: mcq=${globalQuotas.mcq}, open=${globalQuotas.open}, roleplay=${globalQuotas.roleplay}`);
  
  const plans = allocateQuotasToBatches(totalBatches, totalQuestions, globalQuotas);
  
  // Verify allocation
  const actualTotal = {
    mcq: plans.reduce((sum, p) => sum + p.typeQuotas.mcq, 0),
    open: plans.reduce((sum, p) => sum + p.typeQuotas.open, 0),
    roleplay: plans.reduce((sum, p) => sum + p.typeQuotas.roleplay, 0),
  };
  
  const totalAllocated = actualTotal.mcq + actualTotal.open + actualTotal.roleplay;
  
  if (totalAllocated !== totalQuestions) {
    console.error(`[BatchAlloc] MISMATCH: allocated ${totalAllocated} vs expected ${totalQuestions}`);
  }
  if (actualTotal.mcq !== globalQuotas.mcq || actualTotal.open !== globalQuotas.open || actualTotal.roleplay !== globalQuotas.roleplay) {
    console.error(`[BatchAlloc] QUOTA MISMATCH: allocated mcq=${actualTotal.mcq}/open=${actualTotal.open}/roleplay=${actualTotal.roleplay} vs expected mcq=${globalQuotas.mcq}/open=${globalQuotas.open}/roleplay=${globalQuotas.roleplay}`);
  }
  
  return plans;
}

/**
 * Get default settings for a course size
 */
export function getDefaultCourseGenV2Settings(size: CourseSizePreset = 'M'): CourseGenV2Settings {
  return {
    courseSize: size,
    enabledTypes: { mcq: true, open: true, roleplay: true },
    quotaMode: 'percentages',
    typePercentages: { mcq: 60, open: 30, roleplay: 10 },
  };
}
