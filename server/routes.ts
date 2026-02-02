import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { api } from "@shared/routes";
import { z } from "zod";
import { insertDrillAttemptSchema, enrollments, drillAttempts, steps as stepsTable } from "@shared/schema";
import { callYandexResponseWithPromptId } from "./ai/yandex-client";
import { registerAIRoutes } from "./ai/routes";
import roleplayRoutes from "./ai/roleplay-routes";
import multer from "multer";
import mammoth from "mammoth";
import { logAIInteraction } from "./ai/kb-service";
import { parseJSONFromLLM } from "./ai/prompts";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq, and, sql } from "drizzle-orm";
import { generateCourseV2, createCourseGenV2Settings } from "./ai/course-gen-v2";
import type { CourseSizePreset, CourseGenV2Settings } from "@shared/types";
import { uploadFile, downloadFile, isStorageAvailable } from "./supabase-storage";

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }
});

/**
 * Encode filename for Content-Disposition header (RFC 5987)
 * Non-ASCII characters must be percent-encoded
 */
function encodeFilenameForHeader(filename: string): string {
  // Check if filename contains non-ASCII characters
  const hasNonAscii = /[^\x00-\x7F]/.test(filename);
  
  if (hasNonAscii) {
    // Use RFC 5987 encoding: filename*=UTF-8''encoded_name
    const encoded = encodeURIComponent(filename).replace(/'/g, '%27');
    return `filename="download"; filename*=UTF-8''${encoded}`;
  } else {
    // ASCII-only filename, use simple format
    return `filename="${filename.replace(/"/g, '\\"')}"`;
  }
}

/**
 * Fix Cyrillic filename encoding issues from multipart form data
 * Browsers often send filenames in Latin-1 encoding, causing Cyrillic to be garbled
 * This function detects and fixes the encoding
 */
function fixCyrillicFilename(filename: string): string {
  if (!filename) return filename;
  
  // Check if the filename contains garbled Cyrillic (Latin-1 interpreted UTF-8)
  // Pattern: UTF-8 Cyrillic bytes read as Latin-1 characters like Ð, Ñ, etc.
  const hasGarbledCyrillic = /[\xC0-\xFF]{2,}/.test(filename) || 
                              /Ð[°-¿Ñ]/.test(filename) ||
                              /\u00D0[\u0080-\u00BF]/.test(filename);
  
  if (hasGarbledCyrillic) {
    try {
      // Convert string to Latin-1 bytes, then decode as UTF-8
      const latin1Bytes = Buffer.from(filename, 'latin1');
      const utf8Decoded = latin1Bytes.toString('utf-8');
      
      // Validate the result has actual Cyrillic characters
      if (/[\u0400-\u04FF]/.test(utf8Decoded)) {
        console.log(`[Filename Fix] Converted garbled filename: "${filename}" -> "${utf8Decoded}"`);
        return utf8Decoded;
      }
    } catch (e) {
      // If conversion fails, return original
      console.warn(`[Filename Fix] Failed to convert filename: ${filename}`, e);
    }
  }
  
  // Also try to handle RFC 2047 encoded filenames (=?UTF-8?...)
  if (filename.includes('=?') && filename.includes('?=')) {
    try {
      // Basic RFC 2047 decoding for UTF-8
      const decoded = filename.replace(/=\?UTF-8\?[BQ]\?([^?]+)\?=/gi, (match, encoded, offset, input) => {
        const isBase64 = match.toUpperCase().includes('?B?');
        if (isBase64) {
          return Buffer.from(encoded, 'base64').toString('utf-8');
        } else {
          // Quoted-printable
          return encoded.replace(/=([0-9A-F]{2})/gi, (m: string, hex: string) => 
            String.fromCharCode(parseInt(hex, 16))
          );
        }
      });
      if (decoded !== filename) {
        console.log(`[Filename Fix] RFC 2047 decoded: "${filename}" -> "${decoded}"`);
        return decoded;
      }
    } catch (e) {
      console.warn(`[Filename Fix] RFC 2047 decode failed: ${filename}`, e);
    }
  }
  
  return filename;
}

async function extractTextFromFile(file: Express.Multer.File): Promise<string> {
  const ext = file.originalname.toLowerCase().split('.').pop();
  const logPrefix = `[Text Extract] file="${file.originalname}"`;
  
  console.log(`${logPrefix} Starting extraction: type=${ext}, size=${(file.size / 1024).toFixed(1)}KB`);
  
  try {
    if (ext === 'txt' || ext === 'md') {
      const text = file.buffer.toString('utf-8').replace(/\x00/g, '');
      console.log(`${logPrefix} TXT/MD extraction success: ${text.length} chars`);
      return text;
    }
    
    if (ext === 'docx') {
      const result = await mammoth.extractRawText({ buffer: file.buffer });
      const text = result.value.replace(/\x00/g, '');
      console.log(`${logPrefix} DOCX extraction success: ${text.length} chars`);
      return text;
    }
    
    if (ext === 'pdf') {
      // Use the centralized PDF parser
      console.log(`${logPrefix} Starting PDF extraction...`);
      const { extractTextFromPDF } = await import('./ai/parsers');
      const result = await extractTextFromPDF(file.buffer, file.originalname);
      console.log(`${logPrefix} PDF extraction success: ${result.extractedCharCount} chars, ${result.pageCount} pages`);
      return result.fullText;
    }
    
    throw new Error(`Неподдерживаемый формат: ${ext}. Используйте TXT, MD, DOCX или PDF.`);
  } catch (error) {
    console.error(`${logPrefix} Extraction failed:`, error instanceof Error ? error.message : error);
    if (error instanceof Error && error.stack) {
      console.error(`${logPrefix} Stack:`, error.stack);
    }
    throw error;
  }
}

// Legacy V1 generator using Yandex Cloud AI Assistant
async function generateTrackContent(title: string, knowledgeBase: string, strictMode: boolean = true, courseSize?: 'S' | 'M' | 'L') {
  const kbLength = knowledgeBase.length;
  
  // Import deterministic budget calculation
  const { calculateDeterministicBudget, recommendCourseSize } = await import('./ai/parsers');
  
  // Determine course size: use provided or auto-recommend
  const finalSize = courseSize || recommendCourseSize(kbLength);
  
  // Get DETERMINISTIC budget - fixed counts: S=12, M=24, L=36
  const budget = calculateDeterministicBudget({
    courseSize: finalSize,
    enabledTypes: { mcq: true, open: true, roleplay: true }
  });
  
  const totalQuestions = budget.totalQuestions; // 12, 24, or 48
  const { mcq, open, roleplay } = budget.typeQuotas;
  
  console.log(`[Course Gen V1] Budget: size=${finalSize}, total=${totalQuestions}, mcq=${mcq}, open=${open}, roleplay=${roleplay}`);
  
  // SIMPLIFIED PROMPT: No modules, just a flat list of steps
  const systemPrompt = `Ты создаёшь учебный курс на РУССКОМ языке.

СГЕНЕРИРУЙ РОВНО ${totalQuestions} ВОПРОСОВ.

ТИПЫ ВОПРОСОВ:
- "mcq": ${mcq} шт. (тест с 4 вариантами)
- "open": ${open} шт. (открытый вопрос)
- "roleplay": ${roleplay} шт. (ролевая игра)

ПРАВИЛА:
1. ВСЕ на РУССКОМ
2. КРАТКО: вопрос макс 15 слов, вариант ответа макс 5 слов
3. Тип "content" ЗАПРЕЩЁН!
4. ${strictMode ? 'Факты ТОЛЬКО из базы знаний' : 'Можно дополнять'}

JSON СХЕМА:
{
  "steps": [
    {"type": "mcq", "tag": "тема", "content": {"question": "?", "options": ["A","B","C","D"], "correct_index": 0, "explanation": "..."}},
    {"type": "open", "tag": "тема", "content": {"question": "?", "ideal_answer": "...", "rubric": [{"score":0,"criteria":"X"},{"score":10,"criteria":"Y"}]}},
    {"type": "roleplay", "tag": "тема", "content": {"scenario": "...", "ai_role": "...", "user_role": "...", "task": "...", "rubric": [{"score":0,"criteria":"X"},{"score":10,"criteria":"Y"}]}}
  ]
}

Ответ: ТОЛЬКО JSON. РОВНО ${totalQuestions} элементов в "steps".`;

  const userPrompt = `Создай курс "${title}".

ОБЯЗАТЕЛЬНО: РОВНО ${totalQuestions} вопросов (mcq=${mcq}, open=${open}, roleplay=${roleplay}).

БАЗА ЗНАНИЙ:
${knowledgeBase.substring(0, 8000)}`;

  let attempts = 0;
  const maxAttempts = 3; // More attempts for reliability

  while (attempts < maxAttempts) {
    attempts++;
    
    try {
      let input = `${systemPrompt}\n\n${userPrompt}`;
      
      console.log(`[Course Gen V1] Attempt ${attempts}/${maxAttempts}`);
      
      const response = await callYandexResponseWithPromptId({
        promptId: process.env.YANDEX_PROMPT_ID || "",
        variables: {},
        input,
        timeoutMs: 90000,
      });

      const content = response.outputText || "{}";
      console.log(`[Course Gen V1] Response length: ${content.length}`);
      
      let parsed;
      try {
        parsed = parseJSONFromLLM(content);
      } catch (error) {
        console.error(`[Course Gen V1] JSON parse error:`, error);
        if (attempts >= maxAttempts) {
          throw new Error('Ошибка генерации: попробуйте ещё раз');
        }
        continue;
      }

      // Parse steps - support both flat and nested formats
      const rawSteps = parsed.steps || [];
      
      // Also try to extract from modules if AI ignored instructions
      if (rawSteps.length === 0 && parsed.modules) {
        for (const mod of parsed.modules) {
          if (mod.steps) rawSteps.push(...mod.steps);
        }
      }
      
      // Validate and normalize steps
      const steps: any[] = [];
      const VALID_TYPES = ['mcq', 'open', 'roleplay'];
      
      for (let i = 0; i < rawSteps.length; i++) {
        const step = rawSteps[i];
        let stepType = step.type || 'mcq';
        if (stepType === 'quiz') stepType = 'mcq';
        
        // Skip content type
        if (stepType === 'content' || !VALID_TYPES.includes(stepType)) {
          console.warn(`[Course Gen V1] Skipping invalid step type: ${stepType}`);
          continue;
        }
        
        // Normalize MCQ correct_index
        if (stepType === 'mcq' && step.content) {
          if (step.content.correctIndex !== undefined) {
            step.content.correct_index = step.content.correctIndex;
            delete step.content.correctIndex;
          }
        }
        
        steps.push({
          type: stepType,
          tag: step.tag || null,
          content: step.content || {},
          orderIndex: steps.length
        });
      }
      
      console.log(`[Course Gen V1] Parsed ${steps.length}/${totalQuestions} valid steps`);
      
      // STRICT VALIDATION: Must have EXACTLY the required count
      if (steps.length < totalQuestions) {
        const deficit = totalQuestions - steps.length;
        console.warn(`[Course Gen V1] INSUFFICIENT: ${steps.length}/${totalQuestions} (missing ${deficit})`);
        
        if (attempts >= maxAttempts) {
          // Final attempt failed - throw error, DON'T create incomplete course
          throw new Error('Ошибка генерации: попробуйте ещё раз');
        }
        
        // Retry
        console.log(`[Course Gen V1] Retrying...`);
        continue;
      }
      
      // Trim excess if more than needed
      if (steps.length > totalQuestions) {
        console.log(`[Course Gen V1] Trimming ${steps.length} -> ${totalQuestions}`);
        steps.length = totalQuestions;
      }
      
      console.log(`[Course Gen V1] SUCCESS: ${steps.length} steps generated`);
      return steps;
      
    } catch (error) {
      if (attempts >= maxAttempts) {
        throw error;
      }
      console.log(`[Course Gen V1] Attempt ${attempts} failed, retrying...`);
    }
  }
  
  throw new Error('Ошибка генерации: попробуйте ещё раз');
}



export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  setupAuth(app);

  // Promo Code Redemption
  app.post("/api/promo/redeem", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ code: "UNAUTHORIZED", message: "Unauthorized" });
    }
    
    const user = req.user as any;
    if (user.role !== 'curator') {
      return res.status(403).json({ message: "Только кураторы могут активировать промокоды" });
    }

    try {
      const { code } = req.body;
      if (!code || typeof code !== 'string') {
        return res.status(400).json({ message: "Промокод обязателен" });
      }

      const trimmedCode = code.trim().toUpperCase();

      // Get promo code
      const promo = await storage.getPromoCode(trimmedCode);
      if (!promo) {
        return res.status(400).json({ 
          errorCode: "PROMO_NOT_FOUND",
          message: "Промокод не найден." 
        });
      }

      // Check if already used
      if (promo.isUsed) {
        return res.status(400).json({ 
          errorCode: "PROMO_ALREADY_USED",
          message: "Промокод уже использован." 
        });
      }

      // Check email match (case-insensitive)
      if (promo.email.toLowerCase() !== user.email.toLowerCase()) {
        return res.status(400).json({ 
          errorCode: "PROMO_EMAIL_MISMATCH",
          message: "Этот промокод предназначен для другого email." 
        });
      }

      // Redeem promo code and upgrade user plan
      await storage.redeemPromoCode(promo.id, user.id);
      await storage.updateUser(user.id, {
        plan: 'unlimited',
        promoActivatedAt: new Date(),
      });

      console.log(`[Promo] User ${user.email} activated promo code: ${trimmedCode}`);

      res.status(200).json({ 
        message: "Промокод активирован",
        plan: "unlimited" 
      });
    } catch (err) {
      console.error('[Promo] Error redeeming promo code:', err);
      res.status(500).json({ message: "Ошибка активации промокода" });
    }
  });

  // Tracks - File upload endpoint (optimized)
  app.post(api.tracks.generate.path, upload.array('files', 20), async (req, res) => {
    const user = req.user as any;
    if (!user || user.role !== 'curator') {
      return res.status(401).json({ code: "UNAUTHORIZED", message: "Необходима авторизация" });
    }
    
    const userId = user.id;
    const correlationId = randomUUID();
    
    try {
      // Check trial limits BEFORE processing files
      const curator = await storage.getUser(userId);
      if (!curator) {
        return res.status(401).json({ message: "Пользователь не найден" });
      }

      if (curator.plan === 'trial' && (curator.createdCoursesCount || 0) >= 1) {
        console.log(`[Track Gen] Trial limit reached for user ${curator.email}`);
        return res.status(403).json({ 
          errorCode: "COURSE_LIMIT_REACHED",
          message: "Доступна только 1 тестовая генерация курса. Введите промокод или свяжитесь с владельцем.",
          canRetry: false
        });
      }

      const title = req.body.title;
      if (!title || typeof title !== 'string' || !title.trim()) {
        return res.status(400).json({ message: "Название тренинга обязательно" });
      }
      
      // Parse course size (S/M/L) - defaults to auto-recommendation if not provided
      const courseSizeParam = req.body.courseSize as string | undefined;
      let courseSize: 'S' | 'M' | 'L' | undefined;
      if (courseSizeParam && ['S', 'M', 'L'].includes(courseSizeParam)) {
        courseSize = courseSizeParam as 'S' | 'M' | 'L';
      }
      
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ message: "Загрузите хотя бы один файл" });
      }
      
      console.log(`[Track Gen] Upload received: correlationId=${correlationId}, userId=${userId}, title="${title}", courseSize=${courseSize || 'auto'}, files=${files.length}`);
      files.forEach(f => {
        const fixedName = fixCyrillicFilename(f.originalname);
        console.log(`[Track Gen]   - file="${fixedName}", size=${(f.size / 1024).toFixed(1)}KB, type=${f.mimetype}`);
      });
      
      // Set longer timeout for this operation
      req.setTimeout(300000); // 5 minutes
      
      const textParts: string[] = [];
      const fileMetadata: Array<{
        filename: string;
        mimetype: string;
        sizeBytes: number;
        buffer: Buffer;
        extractedChars: number;
      }> = [];
      
      // Process files in parallel for better performance
      console.log(`[Track Gen] Starting parallel file processing for ${files.length} files`);
      
      const fileProcessingPromises = files.map(async (file) => {
        // Fix Cyrillic filename encoding from multipart form data
        const fixedFilename = fixCyrillicFilename(file.originalname);
        
        try {
          console.log(`[Track Gen] Processing file: "${fixedFilename}" (${(file.size / 1024).toFixed(1)}KB)`);
          const startTime = Date.now();
          
          const text = await extractTextFromFile(file);
          const processingTime = Date.now() - startTime;
          
          if (text.trim()) {
            console.log(`[Track Gen] File processed successfully: "${fixedFilename}", extractedChars=${text.length}, time=${processingTime}ms`);
            return {
              success: true,
              textPart: `=== ${fixedFilename} ===\n${text}`,
              metadata: {
                filename: fixedFilename,
                mimetype: file.mimetype,
                sizeBytes: file.size,
                buffer: file.buffer,
                extractedChars: text.length
              }
            };
          } else {
            console.warn(`[Track Gen] File returned empty text: "${fixedFilename}"`);
            return { success: false, error: "Empty text extracted", filename: fixedFilename };
          }
        } catch (err) {
          console.error(`[Track Gen] Error processing file "${fixedFilename}":`, err instanceof Error ? err.message : err);
          return { 
            success: false, 
            error: err instanceof Error ? err.message : String(err),
            filename: fixedFilename 
          };
        }
      });
      
      // Wait for all files to be processed
      const results = await Promise.all(fileProcessingPromises);
      
      // Collect successful results
      results.forEach(result => {
        if (result.success && result.textPart && result.metadata) {
          textParts.push(result.textPart);
          fileMetadata.push(result.metadata);
        } else if (!result.success && result.filename && result.error) {
          console.warn(`[Track Gen] Skipping file "${result.filename}": ${result.error}`);
        }
      });
      
      if (textParts.length === 0) {
        console.error(`[Track Gen] No text extracted from any files: correlationId=${correlationId}`);
        return res.status(400).json({ message: "Не удалось извлечь текст из файлов" });
      }
      
      const combinedText = textParts.join('\n\n').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
      console.log(`[Track Gen] Combined text length: ${combinedText.length} chars from ${fileMetadata.length} files`);
      
      // Determine max_employees based on curator's plan
      const maxEmployees = curator.plan === 'unlimited' ? null : 3;
      
      // Создаём курс
      const track = await storage.createTrack({
        curatorId: userId,
        title: title.trim(),
        rawKnowledgeBase: combinedText,
        strictMode: true,
        joinCode: Math.random().toString().substring(2, 8),
        maxEmployees: maxEmployees,
      });
      
      console.log(`[Track Gen] Track created: trackId=${track.id}, title="${track.title}", maxEmployees=${maxEmployees}`);

      // Increment created courses count atomically
      await storage.incrementCreatedCoursesCount(userId);
      console.log(`[Track Gen] Incremented course count for user ${curator.email}`);

      // Create curator membership
      await storage.createCourseMember({
        courseId: track.id,
        userId: userId,
        memberRole: 'curator',
      });
      console.log(`[Track Gen] Created curator membership for trackId=${track.id}`);

      // Batch save files to knowledge_sources for better performance
      console.log(`[Track Gen] Saving ${fileMetadata.length} knowledge sources in batch`);
      const useSupabaseStorage = isStorageAvailable();
      console.log(`[Track Gen] Supabase Storage available: ${useSupabaseStorage}`);
      
      const knowledgeSourcePromises = fileMetadata.map(async (fileMeta) => {
        try {
          let storagePath: string;
          let storageType: string;
          
          // Try Supabase Storage first (recommended for binary files like PDFs)
          if (useSupabaseStorage) {
            const supabasePath = await uploadFile(
              fileMeta.buffer,
              fileMeta.filename,
              fileMeta.mimetype,
              track.id
            );
            
            if (supabasePath) {
              storagePath = supabasePath;
              storageType = 'supabase';
              console.log(`[Track Gen] File uploaded to Supabase: ${fileMeta.filename}`);
            } else {
              // Fallback to base64 if Supabase upload fails
              console.warn(`[Track Gen] Supabase upload failed, falling back to base64: ${fileMeta.filename}`);
              storagePath = `data:${fileMeta.mimetype};base64,${fileMeta.buffer.toString('base64')}`;
              storageType = 'base64';
            }
          } else {
            // No Supabase Storage - use base64 for small files, metadata for large
            const shouldStoreFullFile = fileMeta.sizeBytes < 5 * 1024 * 1024; // 5MB limit
            
            storagePath = shouldStoreFullFile 
              ? `data:${fileMeta.mimetype};base64,${fileMeta.buffer.toString('base64')}`
              : `metadata_only:${fileMeta.filename}`;
            storageType = shouldStoreFullFile ? 'base64' : 'metadata_only';
          }
          
          const source = await storage.createKnowledgeSource({
            courseId: track.id,
            filename: fileMeta.filename,
            storagePath,
            mimetype: fileMeta.mimetype,
            sizeBytes: fileMeta.sizeBytes,
            extractedCharCount: fileMeta.extractedChars,
            status: 'indexed'
          });
          
          console.log(`[Track Gen] Knowledge source saved: sourceId=${source.id}, filename="${fileMeta.filename}", storage=${storageType}`);
          return source;
        } catch (err) {
          console.error(`[Track Gen] Failed to save knowledge source "${fileMeta.filename}":`, err);
          // Don't fail the whole operation if one source fails
          return null;
        }
      });
      
      const savedSources = await Promise.all(knowledgeSourcePromises);
      const successfulSaves = savedSources.filter(s => s !== null).length;
      console.log(`[Track Gen] Successfully saved ${successfulSaves}/${fileMetadata.length} knowledge sources`);

      // === CourseGenV2: Batched generation ===
      // Parse generation settings from request body
      const useV2 = req.body.useV2 !== 'false'; // Default to V2
      
      if (useV2) {
        console.log(`[Track Gen] Using CourseGenV2 batched generation`);
        
        // Parse settings
        let genSettings: CourseGenV2Settings;
        const sizeParam = req.body.courseSize as string;
        const customTotal = req.body.customTotalQuestions ? parseInt(req.body.customTotalQuestions, 10) : undefined;
        
        // Parse enabled types
        const enabledTypes = {
          mcq: req.body.enableMcq !== 'false',
          open: req.body.enableOpen !== 'false',
          roleplay: req.body.enableRoleplay !== 'false',
        };
        
        // At least one type must be enabled
        if (!enabledTypes.mcq && !enabledTypes.open && !enabledTypes.roleplay) {
          enabledTypes.mcq = true;
        }
        
        // Parse type percentages or counts
        let typePercentages: { mcq: number; open: number; roleplay: number } | undefined;
        let typeCounts: { mcq: number; open: number; roleplay: number } | undefined;
        let quotaMode: 'counts' | 'percentages' = 'percentages';
        
        if (req.body.mcqCount !== undefined || req.body.openCount !== undefined || req.body.roleplayCount !== undefined) {
          quotaMode = 'counts';
          typeCounts = {
            mcq: parseInt(req.body.mcqCount || '0', 10),
            open: parseInt(req.body.openCount || '0', 10),
            roleplay: parseInt(req.body.roleplayCount || '0', 10),
          };
        } else if (req.body.mcqPct !== undefined || req.body.openPct !== undefined || req.body.roleplayPct !== undefined) {
          typePercentages = {
            mcq: parseInt(req.body.mcqPct || '60', 10),
            open: parseInt(req.body.openPct || '30', 10),
            roleplay: parseInt(req.body.roleplayPct || '10', 10),
          };
        } else {
          typePercentages = { mcq: 60, open: 30, roleplay: 10 };
        }
        
        // Determine course size
        let size: CourseSizePreset;
        if (sizeParam === 'Custom' && customTotal) {
          size = 'Custom';
        } else if (sizeParam === 'S' || sizeParam === 'M' || sizeParam === 'L') {
          size = sizeParam;
        } else {
          // Auto-recommend based on KB size
          const { recommendCourseSize } = await import('./ai/parsers');
          size = recommendCourseSize(combinedText.length);
          console.log(`[Track Gen] Auto-recommended size: ${size} (KB: ${(combinedText.length/1024).toFixed(1)}KB)`);
        }
        
        genSettings = {
          courseSize: size,
          customTotalQuestions: size === 'Custom' ? customTotal : undefined,
          enabledTypes,
          quotaMode,
          typeCounts: quotaMode === 'counts' ? typeCounts : undefined,
          typePercentages: quotaMode === 'percentages' ? typePercentages : undefined,
        };
        
        console.log(`[Track Gen] V2 Settings:`, JSON.stringify(genSettings));
        
        // Generate course with V2
        const result = await generateCourseV2({
          title: title.trim(),
          rawKnowledgeBase: combinedText,
          trackId: track.id,
          userId,
          settings: genSettings,
        });
        
        if (!result.success) {
          console.error(`[Track Gen] V2 generation failed:`, result.error);
          return res.status(500).json({
            message: result.error || 'Ошибка генерации курса',
            canRetry: result.canRetry,
            batches: result.batches,
          });
        }
        
        // Flatten modules to steps with trackId
        const allSteps: any[] = [];
        result.modules.forEach(module => {
          module.steps.forEach(step => {
            allSteps.push({ ...step, trackId: track.id });
          });
        });
        
        const createdSteps = await storage.createSteps(allSteps);
        
        console.log(`[Track Gen] V2 Success: trackId=${track.id}, steps=${createdSteps.length}, batches=${result.batches.length}`);
        console.log(`[Track Gen] V2 Quotas: requested mcq=${result.quotas.requested.mcq}/open=${result.quotas.requested.open}/roleplay=${result.quotas.requested.roleplay}`);
        console.log(`[Track Gen] V2 Quotas: actual mcq=${result.quotas.actual.mcq}/open=${result.quotas.actual.open}/roleplay=${result.quotas.actual.roleplay}`);
        
        res.status(201).json({
          track,
          steps: createdSteps,
          generation: {
            version: 'v2',
            totalQuestions: result.totalQuestions,
            generatedQuestions: result.generatedQuestions,
            batchCount: result.batches.length,
            quotas: result.quotas,
          },
        });
      } else {
        // Legacy V1 generation (kept for backwards compatibility)
        console.log(`[Track Gen] Using legacy V1 generation`);
        const generatedSteps = await generateTrackContent(title, combinedText, true, courseSize);
        const stepsWithTrackId = generatedSteps.map((s: any) => ({ ...s, trackId: track.id }));
        
        const createdSteps = await storage.createSteps(stepsWithTrackId);
        
        console.log(`[Track Gen] V1 Success: trackId=${track.id}, steps=${createdSteps.length}, correlationId=${correlationId}`);
        
        res.status(201).json({ track, steps: createdSteps });
      }
    } catch (err: any) {
      console.error(`[Track Gen] Track generation error: correlationId=${correlationId}:`, err instanceof Error ? err.message : err);
      if (err instanceof Error && err.stack) {
        console.error(`[Track Gen] Stack trace:`, err.stack);
      }
      
      // Если это ошибка генерации - возвращаем понятное сообщение
      const errorMessage = err.message || "Ошибка генерации тренинга";
      res.status(500).json({ 
        message: errorMessage,
        canRetry: true  // Флаг для фронтенда, что можно повторить
      });
    }
  });

  app.get(api.tracks.list.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user as any;
    
    if (user.role === 'curator') {
      // Use optimized single-query method instead of N+1 queries
      const tracks = await storage.getTracksWithEmployeeCount(user.id);
      res.json(tracks);
    } else {
      res.json([]);
    }
  });

  app.get(api.tracks.get.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user as any;
    const track = await storage.getTrack(Number(req.params.id));
    if (!track) return res.status(404).json({ message: "Track not found" });
    
    // Check ownership for curators
    if (user.role === 'curator' && track.curatorId !== user.id) {
      return res.status(403).json({ message: "Доступ запрещён" });
    }
    
    // For employees, check enrollment
    if (user.role === 'employee') {
      const enrollment = await storage.getEnrollment(user.id, track.id);
      if (!enrollment) {
        return res.status(403).json({ message: "Вы не записаны на этот курс" });
      }
    }
    
    const steps = await storage.getStepsByTrackId(track.id);
    res.json({ track, steps });
  });

  app.post(api.tracks.join.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const { code } = api.tracks.join.input.parse(req.body);
    const userId = (req.user as any).id;
    
    try {
      const track = await storage.getTrackByCode(code);
      if (!track) {
        return res.status(404).json({ message: "Неверный код присоединения" });
      }
      
      // Check if already a member
      const isMember = await storage.isCourseMember(track.id, userId);
      if (isMember) {
        // Get existing enrollment
        const existing = await storage.getEnrollment(userId, track.id);
        return res.json({ enrollment: existing, trackId: track.id, message: "Вы уже записаны на этот курс" });
      }
      
      // Check employee limit and add member
      const courseLimit = track.maxEmployees; // null = unlimited
      const currentEmployees = await storage.getCourseMemberCount(track.id, 'employee');
      
      if (courseLimit !== null && currentEmployees >= courseLimit) {
        console.log(`[Track Join] Employee limit reached: ${currentEmployees}/${courseLimit} for course ${track.id}`);
        return res.status(403).json({ 
          errorCode: 'EMPLOYEE_LIMIT_REACHED',
          message: 'К этому курсу уже подключено максимальное число сотрудников.'
        });
      }
      
      // Add member
      try {
        await storage.createCourseMember({
          courseId: track.id,
          userId: userId,
          memberRole: 'employee',
        });
      } catch (memberErr: any) {
        if (memberErr.code === '23505') {
          console.log(`[Track Join] User ${userId} already a member of course ${track.id}`);
        } else {
          throw memberErr;
        }
      }
      
      // Create enrollment for progress tracking
      const enrollment = await storage.createEnrollment(userId, track.id);
      
      console.log(`[Track Join] User ${userId} joined course ${track.id}`);
      res.json({ enrollment, trackId: track.id });
    } catch (err) {
      console.error('[Track Join] Error:', err);
      res.status(500).json({ message: "Ошибка присоединения к курсу" });
    }
  });

  // Get knowledge sources (files) for a track
  app.get("/api/tracks/:id/sources", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user as any;
    const trackId = Number(req.params.id);
    
    console.log(`[KB Sources] GET /api/tracks/${trackId}/sources - userId=${user.id}`);
    
    // Check access rights
    const track = await storage.getTrack(trackId);
    if (!track) {
      console.log(`[KB Sources] Track not found: ${trackId}`);
      return res.status(404).json({ message: "Track not found" });
    }
    
    if (user.role === 'curator' && track.curatorId !== user.id) {
      return res.status(403).json({ message: "Доступ запрещён" });
    }
    
    try {
      const sources = await storage.getKnowledgeSourcesByCourseId(trackId);
      console.log(`[KB Sources] Found ${sources.length} sources for trackId=${trackId}`);
      
      // Fix Cyrillic filenames and remove storagePath from response
      const sourcesWithoutData = sources.map(s => {
        // Filename is already fixed during upload, but fix again just in case
        const displayFilename = fixCyrillicFilename(s.filename);
        console.log(`[KB Sources]   - id=${s.id}, filename="${displayFilename}", size=${s.sizeBytes}`);
        return {
          id: s.id,
          courseId: s.courseId,
          filename: displayFilename,
          mimetype: s.mimetype,
          sizeBytes: s.sizeBytes,
          pageCount: s.pageCount,
          extractedCharCount: s.extractedCharCount,
          status: s.status,
          createdAt: s.createdAt
        };
      });
      
      res.json(sourcesWithoutData);
    } catch (error) {
      console.error(`[KB Sources] Error fetching sources for trackId=${trackId}:`, error);
      res.status(500).json({ message: "Failed to fetch knowledge sources" });
    }
  });

  // Download a specific knowledge source file
  app.get("/api/tracks/:trackId/sources/:sourceId/download", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user as any;
    const trackId = Number(req.params.trackId);
    const sourceId = Number(req.params.sourceId);
    
    // Check access rights
    const track = await storage.getTrack(trackId);
    if (!track) return res.status(404).json({ message: "Track not found" });
    
    if (user.role === 'curator' && track.curatorId !== user.id) {
      return res.status(403).json({ message: "Доступ запрещён" });
    }
    
    const sources = await storage.getKnowledgeSourcesByCourseId(trackId);
    const source = sources.find(s => s.id === sourceId);
    
    if (!source) {
      return res.status(404).json({ message: "File not found" });
    }
    
    // Fix Cyrillic filename encoding
    const fixedFilename = fixCyrillicFilename(source.filename);
    
    // Handle different storage formats
    let buffer: Buffer;
    let contentType = source.mimetype;
    
    if (source.storagePath.startsWith('supabase:')) {
      // File stored in Supabase Storage - download it
      console.log(`[Download] Fetching from Supabase: ${source.storagePath}`);
      const fileData = await downloadFile(source.storagePath);
      
      if (!fileData) {
        console.error(`[Download] Failed to download from Supabase: ${source.storagePath}`);
        return res.status(500).json({ message: "Не удалось скачать файл из хранилища" });
      }
      
      buffer = fileData.buffer;
      contentType = fileData.contentType || source.mimetype;
      console.log(`[Download] Supabase download success: ${fixedFilename} (${(buffer.length / 1024).toFixed(1)}KB)`);
    } else if (source.storagePath.startsWith('data:')) {
      // Full file stored as base64 in database
      const dataUriMatch = source.storagePath.match(/^data:(.+?);base64,([\s\S]+)$/);
      if (!dataUriMatch) {
        return res.status(500).json({ message: "Invalid file data format" });
      }
      buffer = Buffer.from(dataUriMatch[2], 'base64');
      console.log(`[Download] Base64 decode success: ${fixedFilename} (${(buffer.length / 1024).toFixed(1)}KB)`);
    } else if (source.storagePath.startsWith('metadata_only:')) {
      // Metadata-only storage - return a placeholder file with extracted text
      const placeholderContent = `=== ${source.filename} (Original file not stored due to size) ===

Extracted text content (${source.extractedCharCount} characters):

[Text content was extracted during upload but original file was not stored to save database space.]

File size: ${(source.sizeBytes / 1024).toFixed(1)} KB
Extraction date: ${source.createdAt?.toISOString() || 'Unknown'}`;
      
      // Create appropriate file based on original type
      if (source.mimetype.includes('pdf')) {
        buffer = Buffer.from(placeholderContent, 'utf-8');
        // For PDF, we could generate a simple text PDF, but for now return text
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', `attachment; ${encodeFilenameForHeader(fixedFilename.replace(/\.pdf$/i, '.txt'))}`);
      } else {
        buffer = Buffer.from(placeholderContent, 'utf-8');
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', `attachment; ${encodeFilenameForHeader(fixedFilename + '.txt')}`);
      }
      
      res.setHeader('Content-Length', buffer.length);
      return res.send(buffer);
    } else {
      return res.status(500).json({ message: "Unsupported storage format" });
    }
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; ${encodeFilenameForHeader(fixedFilename)}`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  });

  // Enrollments
  app.get(api.enrollments.list.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const data = await storage.getUserEnrollments((req.user as any).id);
    res.json(data);
  });

  app.patch(api.enrollments.updateProgress.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const { stepIndex, isCompleted } = api.enrollments.updateProgress.input.parse(req.body);
    const id = Number(req.params.id);
    
    try {
      const updated = await storage.updateEnrollmentProgress(id, stepIndex, isCompleted);
      res.json(updated);
    } catch (err) {
      return res.status(404).json({ message: "Enrollment not found" });
    }
  });

  app.patch("/api/enrollments/progress", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const trackId = Number(req.body.trackId);
    const stepIndex = Number(req.body.stepIndex);
    const isCompleted = req.body.completed === true;
    
    if (isNaN(trackId) || isNaN(stepIndex)) {
      return res.status(400).json({ message: "Invalid trackId or stepIndex" });
    }
    
    const userId = (req.user as any).id;
    
    const enrollment = await storage.getEnrollment(userId, trackId);
    if (!enrollment) return res.status(404).json({ message: "Enrollment not found" });
    
    try {
      const updated = await storage.updateEnrollmentProgress(enrollment.id, stepIndex, isCompleted);
      res.json(updated);
    } catch (err) {
      return res.status(500).json({ message: "Failed to update progress" });
    }
  });

  // Calculate course success rate
  app.post("/api/enrollments/:trackId/calculate-success", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const trackId = Number(req.params.trackId);
    const userId = (req.user as any).id;
    
    if (isNaN(trackId)) {
      return res.status(400).json({ message: "Invalid trackId" });
    }
    
    try {
      const currentEnrollment = await storage.getEnrollment(userId, trackId);
      if (!currentEnrollment) {
        return res.status(400).json({ message: "Enrollment not found" });
      }
      
      // Получаем время начала текущей сессии (последнего сброса)
      // updatedAt обновляется при сбросе курса
      const sessionStartTime = currentEnrollment.updatedAt || new Date(0);
      
      // Получаем ТОЛЬКО попытки с начала текущей сессии
      const attempts = await db.select()
        .from(drillAttempts)
        .where(
          and(
            eq(drillAttempts.userId, userId),
            eq(drillAttempts.trackId, trackId),
            eq(drillAttempts.attemptType, 'initial'), // Только первые попытки
            sql`${drillAttempts.timestamp} >= ${sessionStartTime}` // Только с начала сессии
          )
        );
      
      const totalAnswers = attempts.length;
      const correctAnswers = attempts.filter(a => a.isCorrect).length;
      const successRate = totalAnswers > 0 ? Math.round((correctAnswers / totalAnswers) * 100) : 0;
      const scorePoints = attempts.reduce((sum, a) => sum + (a.score || 0), 0);
      
      // Анализ сильных и слабых тем
      const topicStats: Record<string, { correct: number; total: number }> = {};
      
      attempts.forEach(attempt => {
        if (attempt.tag) {
          if (!topicStats[attempt.tag]) {
            topicStats[attempt.tag] = { correct: 0, total: 0 };
          }
          topicStats[attempt.tag].total++;
          if (attempt.isCorrect) {
            topicStats[attempt.tag].correct++;
          }
        }
      });
      
      const strongTopics: string[] = [];
      const weakTopics: string[] = [];
      
      Object.entries(topicStats).forEach(([topic, stats]) => {
        const topicRate = stats.total > 0 ? (stats.correct / stats.total) * 100 : 0;
        if (topicRate >= 80) {
          strongTopics.push(topic);
        } else if (topicRate < 60) {
          weakTopics.push(topic);
        }
      });
      
      // Обновляем enrollment с результатами и помечаем как завершённый
      if (currentEnrollment) {
        await db.update(enrollments)
          .set({
            isCompleted: true,
            progressPct: 100,
            lastSuccessRate: successRate,
            correctAnswers,
            totalAnswers,
            scorePoints,
            updatedAt: new Date(),
          })
          .where(eq(enrollments.id, currentEnrollment.id));
      }
      
      res.json({
        successRate,
        correctAnswers,
        totalAnswers,
        scorePoints,
        strongTopics,
        weakTopics,
      });
    } catch (error) {
      console.error('Calculate success error:', error);
      return res.status(500).json({ message: "Failed to calculate success" });
    }
  });

  // Add needs repeat tag for drill mode
  app.post("/api/enrollments/needs-repeat", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const { trackId, tag } = req.body;
    if (!trackId || !tag) {
      return res.status(400).json({ message: "trackId and tag are required" });
    }
    
    const userId = (req.user as any).id;
    const enrollment = await storage.getEnrollment(userId, trackId);
    if (!enrollment) return res.status(404).json({ message: "Enrollment not found" });
    
    try {
      const updated = await storage.addNeedsRepeatTag(enrollment.id, tag);
      res.json(updated);
    } catch (err) {
      return res.status(500).json({ message: "Failed to update" });
    }
  });

  // Reset course progress (for retaking)
  app.post("/api/enrollments/:trackId/reset", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const trackId = Number(req.params.trackId);
    const userId = (req.user as any).id;
    
    if (isNaN(trackId)) {
      return res.status(400).json({ message: "Invalid trackId" });
    }
    
    try {
      const enrollment = await storage.getEnrollment(userId, trackId);
      if (!enrollment) {
        return res.status(404).json({ message: "Enrollment not found" });
      }
      
      // Сбрасываем прогресс курса
      await db.update(enrollments)
        .set({
          progressPct: 0,
          isCompleted: false,
          lastStepIndex: 0,
          lastSuccessRate: 0,
          correctAnswers: 0,
          totalAnswers: 0,
          scorePoints: 0,
          needsRepeatTags: [],
          updatedAt: new Date(),
        })
        .where(eq(enrollments.id, enrollment.id));
      
      // Удаляем все попытки для этого курса
      await db.delete(drillAttempts)
        .where(
          and(
            eq(drillAttempts.userId, userId),
            eq(drillAttempts.trackId, trackId)
          )
        );
      
      res.json({ message: "Progress reset successfully" });
    } catch (error) {
      console.error('Reset progress error:', error);
      return res.status(500).json({ message: "Failed to reset progress" });
    }
  });

  // Analytics for curator
  app.get("/api/analytics", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== 'curator') return res.sendStatus(401);
    
    const curatorId = (req.user as any).id;
    const analytics = await storage.getCuratorAnalytics(curatorId);
    res.json(analytics);
  });

  app.get("/api/analytics/track/:trackId", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== 'curator') return res.sendStatus(401);
    
    const trackId = Number(req.params.trackId);
    const curatorId = (req.user as any).id;
    
    // Verify curator owns this track
    const track = await storage.getTrack(trackId);
    if (!track || track.curatorId !== curatorId) {
      return res.status(403).json({ message: "Доступ запрещён" });
    }
    
    const analytics = await storage.getTrackAnalytics(trackId);
    res.json(analytics);
  });

  // Validate step content based on type
  function validateStepContent(type: string, content: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Forbidden type check
    if (type === 'content') {
      return { valid: false, errors: ['Тип "content" запрещён. Используйте mcq, open или roleplay.'] };
    }
    
    if (!['mcq', 'open', 'roleplay', 'quiz'].includes(type)) {
      return { valid: false, errors: [`Неизвестный тип шага: ${type}`] };
    }
    
    switch (type) {
      case 'mcq':
      case 'quiz':
        // Question required
        if (!content.question?.trim()) {
          errors.push('Вопрос обязателен');
        }
        // Exactly 4 options required
        const options = content.options || [];
        if (!Array.isArray(options) || options.length !== 4) {
          errors.push('Требуется ровно 4 варианта ответа');
        } else {
          // All options must be non-empty
          const emptyOptions = options.filter((o: any) => !o?.trim()).length;
          if (emptyOptions > 0) {
            errors.push(`${emptyOptions} вариант(а) ответа пустые`);
          }
          // Check for duplicates
          const uniqueOptions = new Set(options.map((o: string) => o?.toLowerCase()?.trim()));
          if (uniqueOptions.size < options.length) {
            errors.push('Варианты ответа не должны повторяться');
          }
        }
        // correctIndex must be 0-3
        const correctIdx = content.correctIndex ?? content.correctIdx ?? content.correct_index;
        if (typeof correctIdx !== 'number' || correctIdx < 0 || correctIdx > 3) {
          errors.push('Выберите правильный вариант ответа');
        }
        break;
        
      case 'open':
        // Question required
        if (!content.question?.trim()) {
          errors.push('Вопрос обязателен');
        }
        // Rubric required with at least 1 criterion
        const rubric = content.rubric;
        if (!Array.isArray(rubric) || rubric.length < 1) {
          errors.push('Критерии оценки обязательны (минимум 1)');
        }
        // sample_good_answer is optional (no validation needed)
        break;
        
      case 'roleplay':
        // Scenario required
        if (!content.scenario?.trim()) {
          errors.push('Сценарий обязателен');
        }
        // user_role required
        const userRole = content.user_role || content.userRole;
        if (!userRole?.trim()) {
          errors.push('Роль сотрудника обязательна');
        }
        // ai_role required
        const aiRole = content.ai_role || content.aiRole;
        if (!aiRole?.trim()) {
          errors.push('Роль AI обязательна');
        }
        // goal required
        const goal = content.goal || content.task;
        if (!goal?.trim()) {
          errors.push('Цель диалога обязательна');
        }
        break;
    }
    
    return { valid: errors.length === 0, errors };
  }

  // Update step content
  app.patch("/api/steps/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user as any;
    if (user.role !== 'curator') return res.sendStatus(403);
    
    const stepId = Number(req.params.id);
    const { content, type } = req.body;
    
    if (!content) return res.status(400).json({ message: "Содержимое шага обязательно" });
    
    // Get step to determine type if not provided
    const steps = await db.select().from(stepsTable).where(eq(stepsTable.id, stepId)).limit(1);
    if (steps.length === 0) {
      return res.status(404).json({ message: "Шаг не найден" });
    }
    
    const stepType = type || steps[0].type;
    
    // Validate content
    const validation = validateStepContent(stepType, content);
    if (!validation.valid) {
      return res.status(400).json({ 
        message: validation.errors.join('. '),
        errors: validation.errors 
      });
    }
    
    const updated = await storage.updateStep(stepId, content);
    if (!updated) return res.status(404).json({ message: "Шаг не найден" });
    
    res.json(updated);
  });

  // Create new step
  app.post("/api/steps", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user as any;
    if (user.role !== 'curator') return res.sendStatus(403);
    
    const { trackId, type, content, order } = req.body;
    
    if (!trackId || !type || !content) {
      return res.status(400).json({ message: "trackId, type и content обязательны" });
    }
    
    // Forbid content type
    if (type === 'content') {
      return res.status(400).json({ message: 'Тип "content" запрещён. Используйте mcq, open или roleplay.' });
    }
    
    // Validate content
    const validation = validateStepContent(type, content);
    if (!validation.valid) {
      return res.status(400).json({ 
        message: validation.errors.join('. '),
        errors: validation.errors 
      });
    }
    
    // Verify curator owns this track
    const track = await storage.getTrack(trackId);
    if (!track || track.curatorId !== user.id) {
      return res.status(403).json({ message: "Доступ запрещён" });
    }
    
    // Normalize type: quiz -> mcq
    const normalizedType = type === 'quiz' ? 'mcq' : type;
    
    const newStep = await storage.createStep({ trackId, type: normalizedType, content, orderIndex: order || 0 });
    res.status(201).json(newStep);
  });

  // AI Answer Evaluation
  app.post("/api/evaluate-answer", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const { question, userAnswer, idealAnswer, context } = req.body;
    
    if (!question || !userAnswer) {
      return res.status(400).json({ message: "Вопрос и ответ обязательны" });
    }
    
    try {
      const systemPrompt = `Ты — строгий эксперт-оценщик ответов по защите персональных данных.

ГЛАВНОЕ: Оценивай КОРРЕКТНОСТЬ и ПРАВИЛЬНОСТЬ ответа, а не его длину!

КРИТИЧЕСКИЕ ПРАВИЛА:
1. Ответ НЕ СООТВЕТСТВУЕТ сути вопроса → 0 баллов
2. Ответ ФАКТИЧЕСКИ НЕВЕРНЫЙ → 0-3 балла
3. Ответ ПРАВИЛЬНЫЙ, но короткий → 6-8 баллов (это НОРМАЛЬНО!)
4. Ответ ПРАВИЛЬНЫЙ и развёрнутый → 9-10 баллов
5. Короткий но ПРАВИЛЬНЫЙ ответ ЛУЧШЕ, чем длинный но НЕВЕРНЫЙ!

Отвечай ТОЛЬКО JSON:
{
  "score": 0-10,
  "feedback": "краткий отзыв",
  "isCorrect": true если >= 6,
  "improvements": "рекомендации"
}

ШКАЛА (по ПРАВИЛЬНОСТИ):
0: Не по теме
1-3: Фактически неверно
4-5: Частично верно
6-8: Правильно (может быть коротким)
9-10: Правильно и полно`;

      const userPrompt = `Вопрос/сценарий: ${question}
${context ? `Контекст: ${context}` : ''}
${idealAnswer ? `Примерный правильный ответ: ${idealAnswer}` : ''}

Ответ пользователя: "${userAnswer}"

ОБЯЗАТЕЛЬНО проверь:
1. Относится ли ответ к теме вопроса?
2. Показывает ли ответ понимание или это просто случайное слово/цифра?
3. Достаточно ли развёрнут ответ?

Оцени ответ строго и объективно.`;

      const input = `${systemPrompt}\n\n${userPrompt}`;

      const response = await callYandexResponseWithPromptId({
        promptId: process.env.YANDEX_PROMPT_ID || "",
        variables: {},
        input,
        timeoutMs: 60000,
      });
      
      const content = response.outputText || '{}';
      const evaluation = JSON.parse(content);
      
      res.json({
        score: Math.min(10, Math.max(0, Number(evaluation.score) || 0)),
        feedback: evaluation.feedback || "Не удалось оценить ответ",
        isCorrect: evaluation.isCorrect === true || (Number(evaluation.score) >= 6),
        improvements: evaluation.improvements || "Попробуйте дать более развёрнутый ответ"
      });
    } catch (error) {
      console.error("Evaluation error:", error);
      // При ошибке возвращаем негативную оценку
      res.status(500).json({
        score: 0,
        feedback: "Не удалось оценить ответ. Попробуйте снова.",
        isCorrect: false,
        improvements: "Убедитесь, что ваш ответ относится к теме вопроса и содержит развёрнутое объяснение"
      });
    }
  });

  // Drills
  app.post(api.drills.record.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).id;
    const { stepId, isCorrect, transcript, score, trackId, userAnswer, correctAnswer, tag, attemptType } = req.body;
    
    const attempt = await storage.createDrillAttempt({
      userId,
      stepId: Number(stepId),
      trackId: Number(trackId) || 0,
      isCorrect: isCorrect === true,
      userAnswer: userAnswer || transcript || null,
      correctAnswer: correctAnswer || null,
      tag: tag || null,
      attemptType: attemptType || 'initial',
      score: Number(score) || 0,
    });
    res.status(201).json(attempt);
  });

  // Register AI routes (including roleplay)
  app.use('/api/roleplay', roleplayRoutes);

  return httpServer;
}
