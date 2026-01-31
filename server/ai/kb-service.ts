import { db, isDatabaseAvailable } from "../db";
import { kbChunks, aiLogs } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import crypto from "crypto";
import { callYandexResponseWithPromptId } from "./yandex-client";

/**
 * Knowledge Base Service for ADAPT Platform
 * 
 * Handles:
 * - Chunking of knowledge base text for RAG
 * - Retrieval of relevant chunks based on keywords
 * - AI logging for observability
 */

// ============================================================================
// Configuration
// ============================================================================

const CHUNK_SIZE = 950; // Target chunk size in characters (700-1200 range, avg 950)
const CHUNK_OVERLAP = 200; // Overlap between chunks in characters (150-250 range)
const MAX_CHUNK_SIZE = 1200; // Maximum chunk size before forced split
const MIN_CHUNK_SIZE = 400; // Minimum chunk size to keep (changed from 200 to avoid tiny chunks)

// ============================================================================
// Chunking Functions
// ============================================================================

/**
 * Detect if text contains a heading pattern
 * Patterns: ALL CAPS (>= 3 words), numbered sections, keyword prefixes
 */
function detectHeading(text: string, startPos: number, searchLength: number = 50): string | null {
  const searchText = text.slice(Math.max(0, startPos - searchLength), startPos + searchLength);
  
  // Pattern 1: ALL CAPS line (at least 3 words)
  const allCapsMatch = searchText.match(/([A-ZА-ЯЁ][A-ZА-ЯЁ\s]{15,})/);  
  if (allCapsMatch && allCapsMatch[1].split(/\s+/).length >= 3) {
    return allCapsMatch[1].trim();
  }
  
  // Pattern 2: Numbered sections
  const numberedMatch = searchText.match(/(\d+\.\d*\s+[А-ЯЁA-Z][^\n]{5,40}|Глава\s+\d+[^\n]{0,40})/i);
  if (numberedMatch) {
    return numberedMatch[1].trim();
  }
  
  // Pattern 3: Keyword prefixes
  const keywordMatch = searchText.match(/(Раздел:|Тема:|Chapter|Section|CHAPTER|SECTION)\s*[^\n]{5,40}/i);
  if (keywordMatch) {
    return keywordMatch[0].trim();
  }
  
  return null;
}

/**
 * Calculate content hash for deduplication
 */
function calculateContentHash(text: string): string {
  // Normalize: lowercase, remove excess whitespace
  const normalized = text.toLowerCase().replace(/\s+/g, ' ').trim();
  return crypto.createHash('sha256').update(normalized).digest('hex').substring(0, 16);
}

interface ChunkWithMetadata {
  content: string;
  sectionTitle: string | null;
  contentHash: string;
  charCount: number;
  wordCount: number;
  hasHeading: boolean;
  position: { start: number; end: number };
}

/**
 * Enhanced chunking with structure detection and deduplication
 * Returns chunks with metadata
 */
export function chunkKnowledgeBaseWithMetadata(text: string): ChunkWithMetadata[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  // Normalize text
  const normalized = text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s+/g, ' ')
    .trim();

  const chunks: ChunkWithMetadata[] = [];
  const seenHashes = new Set<string>();
  let position = 0;

  while (position < normalized.length) {
    let endPosition = position + CHUNK_SIZE;

    // If we're at the end, take everything
    if (endPosition >= normalized.length) {
      const content = normalized.slice(position).trim();
      if (content.length >= MIN_CHUNK_SIZE) {
        const hash = calculateContentHash(content);
        if (!seenHashes.has(hash)) {
          const heading = detectHeading(normalized, position);
          chunks.push({
            content,
            sectionTitle: heading,
            contentHash: hash,
            charCount: content.length,
            wordCount: content.split(/\s+/).length,
            hasHeading: !!heading,
            position: { start: position, end: normalized.length }
          });
          seenHashes.add(hash);
        }
      }
      break;
    }

    // Try to find a sentence boundary (. ! ?)
    let sentenceEnd = findSentenceBoundary(normalized, endPosition, position + MAX_CHUNK_SIZE);
    if (sentenceEnd > position) {
      endPosition = sentenceEnd;
    } else {
      // If no sentence boundary, try word boundary
      let wordEnd = findWordBoundary(normalized, endPosition);
      if (wordEnd > position) {
        endPosition = wordEnd;
      }
    }

    const content = normalized.slice(position, endPosition).trim();
    
    // Only add if meets minimum size
    if (content.length >= MIN_CHUNK_SIZE) {
      const hash = calculateContentHash(content);
      
      // Deduplicate: skip if we've seen this hash before
      if (!seenHashes.has(hash)) {
        const heading = detectHeading(normalized, position);
        chunks.push({
          content,
          sectionTitle: heading,
          contentHash: hash,
          charCount: content.length,
          wordCount: content.split(/\s+/).length,
          hasHeading: !!heading,
          position: { start: position, end: endPosition }
        });
        seenHashes.add(hash);
      }
    }
    
    // Move position forward with overlap
    position = endPosition - CHUNK_OVERLAP;
    if (position < 0) position = 0;
  }

  return chunks;
}

/**
 * Legacy function for backward compatibility
 * Uses enhanced chunking but returns only content strings
 */
export function chunkKnowledgeBase(text: string): string[] {
  return chunkKnowledgeBaseWithMetadata(text).map(chunk => chunk.content);
}

/**
 * Find the nearest sentence boundary
 */
function findSentenceBoundary(text: string, start: number, max: number): number {
  const sentenceEnders = ['. ', '! ', '? ', '.\n', '!\n', '?\n'];
  let bestPos = -1;

  for (let i = start; i < Math.min(max, text.length); i++) {
    for (const ender of sentenceEnders) {
      if (text.slice(i, i + ender.length) === ender) {
        bestPos = i + ender.length;
        break;
      }
    }
    if (bestPos > 0) break;
  }

  return bestPos;
}

/**
 * Find the nearest word boundary
 */
function findWordBoundary(text: string, start: number): number {
  for (let i = start; i < Math.min(start + 100, text.length); i++) {
    if (text[i] === ' ' || text[i] === '\n') {
      return i + 1;
    }
  }
  return start;
}

/**
 * Calculate KB complexity factor based on heading density
 * Higher factor (up to 1.3) for more structured content
 * Used to adjust question counts
 */
export function calculateKBComplexity(chunks: Array<{ sectionTitle?: string | null }>): number {
  const headingCount = chunks.filter(c => c.sectionTitle && c.sectionTitle.length > 0).length;
  const totalChunks = chunks.length;
  
  if (totalChunks === 0) return 1.0;
  
  // density_score = min(1.0, heading_count / (total_chunks * 0.15))
  const densityScore = Math.min(1.0, headingCount / (totalChunks * 0.15));
  
  // complexity_factor = 1.0 + (0.3 * density_score)
  const complexityFactor = 1.0 + (0.3 * densityScore);
  
  return complexityFactor;
}

// ============================================================================
// Storage Functions
// ============================================================================

/**
 * Store knowledge base chunks in database with enhanced metadata
 * Returns stats about stored chunks
 */
export async function storeKBChunks(
  trackId: number,
  text: string,
  sourceId?: number
): Promise<{ totalChunks: number; uniqueChunks: number; duplicatesSkipped: number }> {
  // Delete existing chunks for this track
  await db.delete(kbChunks).where(eq(kbChunks.trackId, trackId));

  const chunksWithMetadata = chunkKnowledgeBaseWithMetadata(text);
  
  if (chunksWithMetadata.length === 0) {
    return { totalChunks: 0, uniqueChunks: 0, duplicatesSkipped: 0 };
  }

  // Insert all chunks with metadata
  const values = chunksWithMetadata.map((chunk, index) => ({
    trackId,
    sourceId: sourceId || null,
    chunkIndex: index,
    sectionTitle: chunk.sectionTitle,
    content: chunk.content,
    contentHash: chunk.contentHash,
    metadata: {
      charCount: chunk.charCount,
      wordCount: chunk.wordCount,
      hasHeading: chunk.hasHeading,
      position: chunk.position
    },
  }));

  await db.insert(kbChunks).values(values);

  const uniqueCount = chunksWithMetadata.length;
  const totalAttempted = chunksWithMetadata.length;
  
  return {
    totalChunks: totalAttempted,
    uniqueChunks: uniqueCount,
    duplicatesSkipped: 0
  };
}

/**
 * Get all chunks for a track
 */
export async function getKBChunks(trackId: number) {
  return await db
    .select()
    .from(kbChunks)
    .where(eq(kbChunks.trackId, trackId))
    .orderBy(kbChunks.chunkIndex);
}

// ============================================================================
// Retrieval Functions (RAG)
// ============================================================================

/**
 * Retrieve relevant KB chunks based on query keywords
 * Uses simple keyword matching and scoring
 */
export async function retrieveRelevantChunks(
  trackId: number,
  query: string,
  topK: number = 5
): Promise<Array<{ chunk: typeof kbChunks.$inferSelect; score: number }>> {
  const chunks = await getKBChunks(trackId);

  if (chunks.length === 0) {
    return [];
  }

  // Extract keywords from query (lowercase, remove stop words)
  const keywords = extractKeywords(query);

  if (keywords.length === 0) {
    // Return first few chunks if no keywords
    return chunks.slice(0, topK).map(chunk => ({ chunk, score: 0 }));
  }

  // Score each chunk
  const scored = chunks.map(chunk => {
    const score = scoreChunk(chunk.content, keywords);
    return { chunk, score };
  });

  // Sort by score descending and take top K
  scored.sort((a, b) => b.score - a.score);
  
  return scored.slice(0, topK);
}

/**
 * Extract keywords from query (simple implementation)
 */
function extractKeywords(query: string): string[] {
  const stopWords = new Set([
    'и', 'в', 'на', 'с', 'по', 'для', 'как', 'что', 'это', 'к', 'от', 'о',
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should'
  ]);

  return query
    .toLowerCase()
    .replace(/[^\wа-яё\s]/gi, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word))
    .slice(0, 10); // Limit to top 10 keywords
}

/**
 * Score a chunk based on keyword matches
 */
function scoreChunk(content: string, keywords: string[]): number {
  const lowerContent = content.toLowerCase();
  let score = 0;

  for (const keyword of keywords) {
    // Count occurrences
    const regex = new RegExp(keyword, 'gi');
    const matches = lowerContent.match(regex);
    if (matches) {
      // More weight for earlier occurrences
      score += matches.length * 2;
      
      // Bonus for exact word match (not substring)
      const wordRegex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const wordMatches = lowerContent.match(wordRegex);
      if (wordMatches) {
        score += wordMatches.length * 3;
      }
    }
  }

  return score;
}

// ============================================================================
// AI Logging Functions
// ============================================================================

/**
 * Create hash for text (for deduplication and privacy)
 */
function hashText(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex').substring(0, 16);
}

/**
 * Sanitize text by removing sensitive data
 */
function sanitizeForLogging(text: string, maxLength: number = 2000): string {
  // Remove potential API keys, tokens, emails if needed
  let sanitized = text
    .replace(/Bearer\s+[\w-]+/gi, 'Bearer [REDACTED]')
    .replace(/api[_-]?key[\s:=]+[\w-]+/gi, 'api_key=[REDACTED]');

  // Truncate if too long
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength) + '... [TRUNCATED]';
  }

  return sanitized;
}

/**
 * Log AI interaction for observability
 */
export async function logAIInteraction(params: {
  correlationId?: string;
  userId?: number;
  trackId?: number;
  courseId?: number;
  actionType: 'generate_course' | 'assistant' | 'evaluate' | 'drill_generate' | 'test' | 'kb_index' | 'blueprint' | 'lesson_generate';
  kbEnabled?: boolean;
  retrievedChunkIds?: number[];
  retrievedChunks?: Array<{ id: number; content: string }>;
  promptText: string;
  responseText: string;
  latencyMs: number;
  status: 'success' | 'error';
  errorMessage?: string;
}): Promise<void> {
  const {
    correlationId = randomUUID().substring(0, 8),
    userId,
    trackId,
    courseId,
    actionType,
    kbEnabled = false,
    retrievedChunkIds,
    retrievedChunks,
    promptText,
    responseText,
    latencyMs,
    status,
    errorMessage,
  } = params;

  // Prepare chunk previews (first 100 chars of each)
  const chunkPreviews = retrievedChunks?.map(c => 
    `[${c.id}] ${c.content.substring(0, 100)}...`
  );

  try {
    await db.insert(aiLogs).values({
      correlationId,
      userId: userId || null,
      trackId: trackId || null,
      courseId: courseId || null,
      actionType,
      kbEnabled,
      retrievedChunkIds: retrievedChunkIds ? retrievedChunkIds.map(String) : null,
      retrievedChunkPreviews: chunkPreviews || null,
      promptText: sanitizeForLogging(promptText, 5000),
      promptHash: hashText(promptText),
      responseText: sanitizeForLogging(responseText, 3000),
      responseHash: hashText(responseText),
      latencyMs,
      status,
      errorMessage: errorMessage || null,
    });

    // Logged to database - no console output
  } catch (error) {
    console.error('[AI Log] Failed to log interaction:', error);
    // Don't throw - logging failures should not break the main flow
  }
}

/**
 * Get AI logs with optional filters
 */
export async function getAILogs(filters?: {
  trackId?: number;
  actionType?: string;
  status?: 'success' | 'error';
  limit?: number;
}) {
  const { trackId, actionType, status, limit = 50 } = filters || {};

  let query = db.select().from(aiLogs);

  if (trackId) {
    query = query.where(eq(aiLogs.trackId, trackId)) as any;
  }

  if (actionType) {
    query = query.where(eq(aiLogs.actionType, actionType as any)) as any;
  }

  if (status) {
    query = query.where(eq(aiLogs.status, status)) as any;
  }

  const logs = await query.orderBy(sql`${aiLogs.createdAt} DESC`).limit(limit);
  
  return logs;
}

/**
 * Get single AI log by correlation ID
 */
export async function getAILogByCorrelationId(correlationId: string) {
  const [log] = await db
    .select()
    .from(aiLogs)
    .where(eq(aiLogs.correlationId, correlationId));

  return log;
}

/**
 * Get statistics for a track
 */
export async function getTrackAIStats(trackId: number) {
  const logs = await db
    .select()
    .from(aiLogs)
    .where(eq(aiLogs.trackId, trackId));

  const totalCalls = logs.length;
  const successCalls = logs.filter(l => l.status === 'success').length;
  const errorCalls = logs.filter(l => l.status === 'error').length;
  const avgLatency = logs.length > 0
    ? Math.round(logs.reduce((sum, l) => sum + (l.latencyMs || 0), 0) / logs.length)
    : 0;

  return {
    totalCalls,
    successCalls,
    errorCalls,
    successRate: totalCalls > 0 ? Math.round((successCalls / totalCalls) * 100) : 0,
    avgLatency,
  };
}

// ============================================================================
// KB Index Generation
// ============================================================================

interface KBTopic {
  title: string;
  description: string;
  chunk_ids: number[];
  keywords: string[];
}

interface KBIndexResult {
  topics: KBTopic[];
}

/**
 * Determine topic count based on KB size
 */
function getTopicCountRange(kbCharCount: number): { min: number; max: number } {
  if (kbCharCount < 10000) return { min: 8, max: 12 };
  if (kbCharCount < 30000) return { min: 12, max: 20 };
  if (kbCharCount < 60000) return { min: 18, max: 30 };
  return { min: 25, max: 40 };
}

/**
 * Generate KB index using Yandex Cloud AI Assistant
 * Returns topic map with chunk references
 */
export async function generateKBIndex(
  courseId: number,
  chunks: Array<{ id: number; content: string; sectionTitle?: string | null }>,
  kbStats: { charCount: number; pageCount?: number }
): Promise<KBIndexResult> {
  const { parseJSONFromLLM } = await import('./prompts');
  
  const correlationId = `kb_index_${Date.now()}_${randomUUID().substring(0, 4)}`;
  const startTime = Date.now();
  
  const topicRange = getTopicCountRange(kbStats.charCount);
  
  const systemPrompt = `You are an expert content analyst. Analyze the Knowledge Base and extract major topics with supporting evidence.

Output ONLY valid JSON with no markdown:
{
  "topics": [
    {
      "title": "Topic name (3-8 words)",
      "description": "Brief summary (<= 180 chars)",
      "chunk_ids": [12, 45, 67],
      "keywords": ["keyword1", "keyword2", "keyword3"]
    }
  ]
}

Rules:
- Extract ${topicRange.min}-${topicRange.max} topics depending on KB size
- Every topic MUST reference 3-8 chunk_ids as evidence
- Topics must cover ALL major themes in KB
- Do not invent topics without chunk support
- Descriptions must be concise and specific`;

  // Prepare chunk previews (first 600 chars)
  const chunkPreviews = chunks.slice(0, 50).map((chunk, idx) => 
    `[Chunk ${idx + 1} - ID: ${chunk.id}]${chunk.sectionTitle ? ` (${chunk.sectionTitle})` : ''}\n${chunk.content.substring(0, 600)}${chunk.content.length > 600 ? '...' : ''}`
  ).join('\n\n');

  const userPrompt = `Analyze this Knowledge Base and extract all major topics.

KB Statistics:
- Total chunks: ${chunks.length}
- Total characters: ${kbStats.charCount}
${kbStats.pageCount ? `- Pages: ${kbStats.pageCount}` : ''}

KB Chunks (with IDs):
${chunkPreviews}

Extract topics with supporting chunk IDs.`;

  try {
    // KB Index generation started
    
    const input = `${systemPrompt}\n\n${userPrompt}`;

    const response = await callYandexResponseWithPromptId({
      promptId: process.env.YANDEX_PROMPT_ID || "",
      variables: {},
      input,
      timeoutMs: 90000,
    });

    const latencyMs = Date.now() - startTime;
    
    let indexResult: KBIndexResult;
    try {
      indexResult = parseJSONFromLLM(response.outputText);
    } catch (parseError) {
      console.error(`[KB Index:${correlationId}] JSON parse failed, using fallback`);
      throw parseError;
    }

    // Validate topics
    if (!indexResult.topics || !Array.isArray(indexResult.topics) || indexResult.topics.length < topicRange.min) {
      console.warn(`[KB Index:${correlationId}] Insufficient topics (${indexResult.topics?.length || 0}), using fallback`);
      throw new Error('Insufficient topics returned');
    }

    // Validate each topic has required fields
    const validTopics = indexResult.topics.filter(topic => 
      topic.title && 
      topic.description && 
      topic.chunk_ids && 
      Array.isArray(topic.chunk_ids) && 
      topic.chunk_ids.length >= 2
    );

    if (validTopics.length < topicRange.min) {
      console.warn(`[KB Index:${correlationId}] Too few valid topics (${validTopics.length}), using fallback`);
      throw new Error('Too few valid topics');
    }

    // Log success
    await logAIInteraction({
      correlationId,
      courseId,
      actionType: 'kb_index',
      kbEnabled: true,
      retrievedChunkIds: chunks.slice(0, 50).map(c => c.id),
      promptText: systemPrompt + '\n\n' + userPrompt,
      responseText: JSON.stringify(indexResult),
      latencyMs,
      status: 'success'
    });

    // KB Index success logged to database
    
    return { topics: validTopics };

  } catch (error) {
    const latencyMs = Date.now() - startTime;
    console.error(`[KB Index:${correlationId}] Error:`, error);
    
    // Log error
    await logAIInteraction({
      correlationId,
      courseId,
      actionType: 'kb_index',
      kbEnabled: true,
      promptText: 'KB Index generation',
      responseText: '',
      latencyMs,
      status: 'error',
      errorMessage: (error as Error).message
    });

    // Use fallback
    // Using fallback index generation
    return generateKBIndexFallback(chunks, kbStats);
  }
}

/**
 * Fallback KB index generation using keyword frequency
 */
function generateKBIndexFallback(
  chunks: Array<{ id: number; content: string; sectionTitle?: string | null }>,
  kbStats: { charCount: number }
): KBIndexResult {
  // Extract keywords from all chunks
  const stopWords = new Set([
    'и', 'в', 'на', 'с', 'по', 'для', 'как', 'что', 'это', 'к', 'от', 'о', 'из', 'у', 'за', 'при',
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should'
  ]);

  const wordCounts = new Map<string, { count: number; chunkIds: Set<number> }>();

  chunks.forEach(chunk => {
    const words = chunk.content
      .toLowerCase()
      .replace(/[^\wа-яё\s]/gi, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3 && !stopWords.has(word));

    words.forEach(word => {
      if (!wordCounts.has(word)) {
        wordCounts.set(word, { count: 0, chunkIds: new Set() });
      }
      const entry = wordCounts.get(word)!;
      entry.count++;
      entry.chunkIds.add(chunk.id);
    });
  });

  // Sort by frequency and create topics
  const sortedWords = Array.from(wordCounts.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 15);

  const topics: KBTopic[] = sortedWords.map(([word, data]) => ({
    title: word.charAt(0).toUpperCase() + word.slice(1),
    description: `Тема, связанная с: ${word}`,
    chunk_ids: Array.from(data.chunkIds).slice(0, 8),
    keywords: [word]
  }));

  // Fallback completed
  
  return { topics };
}

// ============================================================================
// Two-Pass Course Generation
// ============================================================================

export interface BlueprintResult {
  blueprint: {
    title: string;
    summary: string;
    modules: Array<{
      module_id: string;
      title: string;
      objective: string;
      lessons: Array<{
        lesson_id: string;
        title: string;
        objective: string;
        question_budget: number;
        topic_refs: string[];
        kb_gap?: boolean;
      }>;
    }>;
    targets: {
      modules: number;
      lessons: number;
      questions: number;
    };
  };
  correlationId: string;
  latencyMs: number;
}

export interface LessonResult {
  lesson: {
    title: string;
    objective: string;
    estimated_minutes: number;
    steps: Array<{
      type: string;
      content: any;
      kb_refs: number[];
    }>;
    quality: {
      mcq_pass: boolean;
      kb_grounded: boolean;
      kb_gaps: string[];
    };
  };
  correlationId: string;
  latencyMs: number;
}

/**
 * Calculate module/lesson/question ranges based on KB size
 */
function getScalingParams(kbCharCount: number) {
  if (kbCharCount < 10000) {
    return {
      modulesMin: 2, modulesMax: 4,
      lessonsMin: 3, lessonsMax: 5,
      questionsMin: 20, questionsTarget: 40
    };
  } else if (kbCharCount < 30000) {
    return {
      modulesMin: 4, modulesMax: 6,
      lessonsMin: 4, lessonsMax: 6,
      questionsMin: 40, questionsTarget: 70
    };
  } else if (kbCharCount < 60000) {
    return {
      modulesMin: 6, modulesMax: 8,
      lessonsMin: 5, lessonsMax: 8,
      questionsMin: 60, questionsTarget: 110
    };
  } else {
    return {
      modulesMin: 8, modulesMax: 12,
      lessonsMin: 5, lessonsMax: 8,
      questionsMin: 80, questionsTarget: 160
    };
  }
}

/**
 * PASS A: Generate course blueprint
 */
export async function generateBlueprint(
  courseId: number,
  title: string,
  kbStats: { chars: number; chunks: number; pages?: number },
  topics: KBTopic[],
  userId?: number
): Promise<BlueprintResult> {
  const { BLUEPRINT_SYSTEM_PROMPT, buildBlueprintUserPrompt, parseJSONFromLLM } = await import('./prompts');
  
  const correlationId = `blueprint_${Date.now()}_${randomUUID().substring(0, 4)}`;
  const startTime = Date.now();
  
  const scalingParams = getScalingParams(kbStats.chars);
  
  const userPrompt = buildBlueprintUserPrompt({
    title,
    targetDurationMinutes: 60,
    kbStats: {
      chars: kbStats.chars,
      chunks: kbStats.chunks,
      pages: kbStats.pages
    },
    topics,
    modulesMin: scalingParams.modulesMin,
    modulesMax: scalingParams.modulesMax,
    lessonsMin: scalingParams.lessonsMin,
    lessonsMax: scalingParams.lessonsMax,
    questionsMin: scalingParams.questionsMin
  });
  
  // Blueprint generation started
  
  const input = `${BLUEPRINT_SYSTEM_PROMPT}\n\n${userPrompt}`;
  
  try {
    const response = await callYandexResponseWithPromptId({
      promptId: process.env.YANDEX_PROMPT_ID || "",
      variables: {},
      input,
      timeoutMs: 90000,
    });
    
    const latencyMs = Date.now() - startTime;
    const content = response.outputText || '{}';
    
    let parsed = parseJSONFromLLM(content);
    const blueprint = parsed.blueprint || parsed;
    
    // Validation
    if (!blueprint.modules || blueprint.modules.length < scalingParams.modulesMin) {
      console.warn(`[Blueprint:${correlationId}] Module count below minimum: ${blueprint.modules?.length} < ${scalingParams.modulesMin}`);
    }
    
    // Log to ai_logs
    await logAIInteraction({
      correlationId,
      userId,
      courseId,
      actionType: 'blueprint',
      kbEnabled: true,
      promptText: BLUEPRINT_SYSTEM_PROMPT.substring(0, 500) + '...',
      responseText: JSON.stringify(blueprint).substring(0, 2000),
      latencyMs,
      status: 'success'
    });
    
    // Blueprint success logged to database
    
    return {
      blueprint,
      correlationId,
      latencyMs
    };
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    console.error(`[Blueprint:${correlationId}] Error:`, error);
    
    await logAIInteraction({
      correlationId,
      userId,
      courseId,
      actionType: 'blueprint',
      kbEnabled: true,
      promptText: BLUEPRINT_SYSTEM_PROMPT.substring(0, 500),
      responseText: '',
      latencyMs,
      status: 'error',
      errorMessage: error instanceof Error ? error.message : 'Unknown error'
    });
    
    throw error;
  }
}

/**
 * Retrieve chunks for lesson topics
 */
export async function getChunksForTopics(
  courseId: number,
  topicRefs: string[],
  allTopics: KBTopic[],
  maxChunksPerLesson: number = 20
): Promise<Array<{ id: number; content: string }>> {
  // Map topic titles to chunk IDs
  const chunkIds = new Set<number>();
  
  for (const topicRef of topicRefs) {
    const topic = allTopics.find(t => t.title === topicRef);
    if (topic) {
      // Take up to 10 chunks per topic
      topic.chunk_ids.slice(0, 10).forEach(id => chunkIds.add(id));
    }
  }
  
  // Limit total chunks
  const limitedIds = Array.from(chunkIds).slice(0, maxChunksPerLesson);
  
  // Fetch chunks from database
  const chunks = await db
    .select({ id: kbChunks.id, content: kbChunks.content })
    .from(kbChunks)
    .where(
      and(
        eq(kbChunks.trackId, courseId),
        sql`${kbChunks.id} = ANY(${limitedIds})`
      )
    );
  
  return chunks;
}

/**
 * PASS B: Generate single lesson
 */
export async function generateLesson(
  courseId: number,
  moduleTitle: string,
  lessonTitle: string,
  lessonObjective: string,
  questionBudget: number,
  topicRefs: string[],
  allTopics: KBTopic[],
  blueprintId: string,
  userId?: number
): Promise<LessonResult> {
  const { LESSON_SYSTEM_PROMPT, buildLessonUserPrompt, parseJSONFromLLM } = await import('./prompts');
  
  const correlationId = `lesson_${Date.now()}_${randomUUID().substring(0, 4)}`;
  const startTime = Date.now();
  
  // Retrieve relevant KB chunks
  const chunks = await getChunksForTopics(courseId, topicRefs, allTopics);
  
  // Lesson generation started
  
  const userPrompt = buildLessonUserPrompt({
    module_title: moduleTitle,
    lesson_title: lessonTitle,
    lesson_objective: lessonObjective,
    question_budget: questionBudget,
    topic_refs: topicRefs,
    kb_chunks: chunks.map(c => ({ id: c.id, content: c.content }))
  });
  
  const input = `${LESSON_SYSTEM_PROMPT}\n\n${userPrompt}`;
  
  try {
    const response = await callYandexResponseWithPromptId({
      promptId: process.env.YANDEX_PROMPT_ID || "",
      variables: {},
      input,
      timeoutMs: 90000,
    });
    
    const latencyMs = Date.now() - startTime;
    const content = response.outputText || '{}';
    
    let parsed = parseJSONFromLLM(content);
    const lesson = parsed.lesson || parsed;
    
    // Basic validation
    if (!lesson.steps || lesson.steps.length === 0) {
      console.warn(`[Lesson:${correlationId}] No steps generated`);
    }
    
    // Log to ai_logs
    await logAIInteraction({
      correlationId,
      userId,
      courseId,
      actionType: 'lesson_generate',
      kbEnabled: true,
      promptText: LESSON_SYSTEM_PROMPT.substring(0, 500) + '...',
      responseText: JSON.stringify(lesson).substring(0, 2000),
      latencyMs,
      status: 'success'
    });
    
    // Lesson success logged to database
    
    return {
      lesson,
      correlationId,
      latencyMs
    };
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    console.error(`[Lesson:${correlationId}] Error:`, error);
    
    await logAIInteraction({
      correlationId,
      userId,
      courseId,
      actionType: 'lesson_generate',
      kbEnabled: true,
      promptText: LESSON_SYSTEM_PROMPT.substring(0, 500),
      responseText: '',
      latencyMs,
      status: 'error',
      errorMessage: error instanceof Error ? error.message : 'Unknown error'
    });
    
    throw error;
  }
}

// ============================================================================
// Quality Validation
// ============================================================================

export interface MCQValidationResult {
  pass: boolean;
  issues: string[];
}

export interface MCQStep {
  type: string;
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
  kb_refs?: number[];
}

/**
 * Validate MCQ quality according to design spec
 */
export function validateMCQ(mcq: MCQStep): MCQValidationResult {
  const issues: string[] = [];
  
  // Check option length balance (max 2.2x ratio)
  const lengths = mcq.options.map(o => o.length);
  const maxLen = Math.max(...lengths);
  const minLen = Math.min(...lengths);
  const ratio = maxLen / minLen;
  
  if (ratio > 2.2) {
    issues.push(`Option length imbalance: ${ratio.toFixed(1)}x (max allowed: 2.2x)`);
  }
  
  // Check for obvious markers
  const obviousMarkers = [
    'всегда', 'никогда', 'очевидно', 'неверно', 
    'все вышеперечисленное', 'ничего из перечисленного'
  ];
  
  const correctOption = mcq.options[mcq.correct_index]?.toLowerCase() || '';
  
  for (let i = 0; i < mcq.options.length; i++) {
    if (i === mcq.correct_index) continue;
    
    const distractor = mcq.options[i].toLowerCase();
    for (const marker of obviousMarkers) {
      if (distractor.includes(marker) && !correctOption.includes(marker)) {
        issues.push(`Distractor contains obvious marker: "${marker}"`);
      }
    }
  }
  
  // Check KB references
  if (!mcq.kb_refs || mcq.kb_refs.length === 0) {
    issues.push('Missing KB references (kb_refs array)');
  }
  
  // Check explanation length
  if (!mcq.explanation || mcq.explanation.length < 100) {
    issues.push(`Explanation too short: ${mcq.explanation?.length || 0} chars (min: 100)`);
  }
  
  return {
    pass: issues.length === 0,
    issues
  };
}

/**
 * Check correct answer distribution across multiple MCQs
 */
export function checkCorrectIndexDistribution(mcqs: MCQStep[]): { pass: boolean; suggestion?: string } {
  if (mcqs.length === 0) return { pass: true };
  
  const counts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
  
  for (const mcq of mcqs) {
    const idx = mcq.correct_index;
    if (idx >= 0 && idx <= 3) {
      counts[idx]++;
    }
  }
  
  const total = mcqs.length;
  
  for (const [index, count] of Object.entries(counts)) {
    const percentage = count / total;
    if (percentage > 0.45) {
      return {
        pass: false,
        suggestion: `Position ${index} has ${count}/${total} (${(percentage * 100).toFixed(0)}%) correct answers. Should be <45%. Consider shuffling.`
      };
    }
  }
  
  return { pass: true };
}
