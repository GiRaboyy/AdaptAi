import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { api } from "@shared/routes";
import { z } from "zod";
import { insertDrillAttemptSchema } from "@shared/schema";
import { seedDatabase } from "./seed";
import OpenAI from "openai";
import multer from "multer";
import mammoth from "mammoth";

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }
});

async function extractTextFromFile(file: Express.Multer.File): Promise<string> {
  const ext = file.originalname.toLowerCase().split('.').pop();
  
  if (ext === 'txt' || ext === 'md') {
    return file.buffer.toString('utf-8').replace(/\x00/g, '');
  }
  
  if (ext === 'docx') {
    const result = await mammoth.extractRawText({ buffer: file.buffer });
    return result.value.replace(/\x00/g, '');
  }
  
  throw new Error(`Неподдерживаемый формат: ${ext}. Используйте TXT, MD или DOCX.`);
}

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

async function generateTrackContent(title: string, knowledgeBase: string, strictMode: boolean = true) {
  const kbLength = knowledgeBase.length;
  const minSteps = kbLength > 5000 ? 15 : kbLength > 2000 ? 10 : 6;
  const maxSteps = kbLength > 5000 ? 25 : kbLength > 2000 ? 15 : 10;
  
  const systemPrompt = `Ты - эксперт по созданию КОМПЛЕКСНЫХ обучающих курсов на РУССКОМ языке.
Твоя задача: создать ПОЛНОЦЕННЫЙ мульти-модульный учебный курс на основе предоставленной базы знаний.

КРИТИЧЕСКИ ВАЖНЫЕ ПРАВИЛА:
1. ВСЕ тексты ТОЛЬКО НА РУССКОМ ЯЗЫКЕ
2. ${strictMode ? 'Используй СТРОГО ТОЛЬКО информацию из базы знаний. Не выдумывай факты.' : 'Можешь дополнять, но основывайся на базе знаний.'}
3. Создай от ${minSteps} до ${maxSteps} шагов, покрывающих ВСЕ основные темы из базы знаний
4. Каждая тема должна иметь: content (объяснение) + quiz или open вопрос
5. ОБЯЗАТЕЛЬНО 2-3 roleplay сценария в разных частях курса
6. Каждый шаг должен иметь уникальный "tag" (тему), например: "введение", "основы_продаж", "работа_с_возражениями"
7. Текст content должен быть коротким (2-4 строки), понятным
8. Вопросы должны проверять понимание конкретных фактов из базы знаний

СТРУКТУРА КУРСА (пример для большой базы знаний):
- 1-2 вводных content
- Модуль 1: 2-3 content + 2 quiz/open по теме 1
- Модуль 2: 2-3 content + 2 quiz/open по теме 2
- Roleplay по темам 1-2
- Модуль 3: 2-3 content + 2 quiz/open по теме 3
- Финальный roleplay

ТИПЫ ШАГОВ:
{
  "type": "content",
  "tag": "название_темы",
  "content": { "text": "Короткий урок 2-4 строки..." }
}

{
  "type": "quiz",
  "tag": "название_темы", 
  "content": { 
    "question": "Вопрос строго по базе знаний?", 
    "options": ["Вариант 1", "Вариант 2", "Вариант 3", "Вариант 4"], 
    "correctIndex": 0,
    "explanation": "Почему это правильный ответ (со ссылкой на материал)"
  }
}

{
  "type": "open",
  "tag": "название_темы",
  "content": {
    "question": "Вопрос требующий развёрнутого ответа",
    "ideal_answer": "Образец идеального ответа",
    "key_points": ["ключевой момент 1", "ключевой момент 2"]
  }
}

{
  "type": "roleplay",
  "tag": "практика_название",
  "content": { 
    "scenario": "Конкретная рабочая ситуация...",
    "context": "Что нужно сделать",
    "ideal_answer": "Пример хорошего ответа"
  }
}

Ответ: ТОЛЬКО JSON объект с массивом "steps".`;

  const userPrompt = `Создай ПОЛНОЦЕННЫЙ учебный курс "${title}" из ${minSteps}-${maxSteps} шагов.

БАЗА ЗНАНИЙ:
${knowledgeBase.substring(0, 12000)}

ТРЕБОВАНИЯ:
- Покрой ВСЕ ключевые темы из базы знаний
- Минимум ${minSteps} шагов
- Разные типы: content, quiz, open, roleplay
- Каждый шаг = свой tag (тема)
- 2-3 roleplay сценария
- Всё на русском языке`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 8000,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0]?.message?.content || "[]";
    
    let parsed;
    try {
      parsed = JSON.parse(content);
      if (parsed.steps) parsed = parsed.steps;
      if (!Array.isArray(parsed)) parsed = [parsed];
    } catch {
      console.error("Failed to parse AI response:", content);
      return getFallbackContent(title, knowledgeBase);
    }

    const steps = parsed.map((step: any, index: number) => ({
      type: step.type || "content",
      tag: step.tag || null,
      content: step.content || { text: "Ошибка генерации" },
      orderIndex: index
    }));

    const hasRoleplay = steps.some((s: any) => s.type === "roleplay");
    if (!hasRoleplay) {
      steps.push({
        type: "roleplay",
        tag: "практика",
        content: {
          scenario: `Вы общаетесь с клиентом по теме "${title}". Продемонстрируйте знания из курса.`,
          context: "Клиент задаёт вопросы, вы отвечаете профессионально.",
          ideal_answer: "Применяйте знания из пройденного материала."
        },
        orderIndex: steps.length
      });
    }

    return steps;
  } catch (error) {
    console.error("OpenAI error:", error);
    return getFallbackContent(title, knowledgeBase);
  }
}

function getFallbackContent(title: string, knowledgeBase: string) {
  const preview = knowledgeBase.substring(0, 200);
  return [
    {
      type: "content" as const,
      tag: "введение",
      content: { text: `Добро пожаловать в курс "${title}".\n\n${preview}...` },
      orderIndex: 0
    },
    {
      type: "quiz" as const,
      tag: "основы",
      content: { 
        question: `О чём этот курс "${title}"?`, 
        options: [title, "Кулинария", "Спорт", "Музыка"], 
        correctIndex: 0,
        explanation: `Этот курс посвящён теме "${title}".`
      },
      orderIndex: 1
    },
    {
      type: "content" as const,
      tag: "практика",
      content: { text: knowledgeBase.substring(200, 500) || "Продолжение материала курса..." },
      orderIndex: 2
    },
    {
      type: "roleplay" as const,
      tag: "ролевая_игра",
      content: { 
        scenario: `Клиент спрашивает о ${title}. Ответьте профессионально, используя знания из курса.`,
        context: "Рабочая ситуация с клиентом",
        ideal_answer: "Используйте информацию из базы знаний для ответа."
      },
      orderIndex: 3
    }
  ];
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  setupAuth(app);

  // Tracks - File upload endpoint
  app.post(api.tracks.generate.path, upload.array('files', 20), async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== 'curator') return res.sendStatus(401);
    
    try {
      const title = req.body.title;
      if (!title || typeof title !== 'string' || !title.trim()) {
        return res.status(400).json({ message: "Название тренинга обязательно" });
      }
      
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ message: "Загрузите хотя бы один файл" });
      }
      
      const textParts: string[] = [];
      for (const file of files) {
        try {
          const text = await extractTextFromFile(file);
          if (text.trim()) {
            textParts.push(`=== ${file.originalname} ===\n${text}`);
          }
        } catch (err) {
          console.error(`Error processing file ${file.originalname}:`, err);
        }
      }
      
      if (textParts.length === 0) {
        return res.status(400).json({ message: "Не удалось извлечь текст из файлов" });
      }
      
      const combinedText = textParts.join('\n\n').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
      
      const track = await storage.createTrack({
        curatorId: (req.user as any).id,
        title: title.trim(),
        rawKnowledgeBase: combinedText,
        strictMode: true,
        joinCode: Math.random().toString().substring(2, 8)
      });

      const generatedSteps = await generateTrackContent(title, combinedText, true);
      const stepsWithTrackId = generatedSteps.map(s => ({ ...s, trackId: track.id }));
      
      const createdSteps = await storage.createSteps(stepsWithTrackId);
      
      res.status(201).json({ track, steps: createdSteps });
    } catch (err) {
      console.error("Track generation error:", err);
      res.status(500).json({ message: "Ошибка генерации тренинга" });
    }
  });

  app.get(api.tracks.list.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user as any;
    
    if (user.role === 'curator') {
      const tracks = await storage.getTracksByCurator(user.id);
      const tracksWithCounts = await Promise.all(
        tracks.map(async (track) => {
          const enrollments = await storage.getEnrollmentsByTrackId(track.id);
          return { ...track, employeeCount: enrollments.length };
        })
      );
      res.json(tracksWithCounts);
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
    
    const track = await storage.getTrackByCode(code);
    if (!track) return res.status(404).json({ message: "Invalid join code" });
    
    const existing = await storage.getEnrollment((req.user as any).id, track.id);
    if (existing) {
      return res.json({ enrollment: existing, trackId: track.id });
    }
    
    const enrollment = await storage.createEnrollment((req.user as any).id, track.id);
    res.json({ enrollment, trackId: track.id });
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

  // Update step content
  app.patch("/api/steps/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user as any;
    if (user.role !== 'curator') return res.sendStatus(403);
    
    const stepId = Number(req.params.id);
    const { content } = req.body;
    
    if (!content) return res.status(400).json({ message: "Content is required" });
    
    const updated = await storage.updateStep(stepId, content);
    if (!updated) return res.status(404).json({ message: "Step not found" });
    
    res.json(updated);
  });

  // Create new step
  app.post("/api/steps", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user as any;
    if (user.role !== 'curator') return res.sendStatus(403);
    
    const { trackId, type, content, order } = req.body;
    
    if (!trackId || !type || !content) {
      return res.status(400).json({ message: "trackId, type, and content are required" });
    }
    
    // Verify curator owns this track
    const track = await storage.getTrack(trackId);
    if (!track || track.curatorId !== user.id) {
      return res.status(403).json({ message: "Access denied" });
    }
    
    const newStep = await storage.createStep({ trackId, type, content, orderIndex: order || 0 });
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
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `Ты — строгий оценщик ответов на учебные вопросы. Оценивай ответ по шкале от 0 до 10.
Отвечай ТОЛЬКО в формате JSON:
{
  "score": число от 0 до 10,
  "feedback": "краткий отзыв на русском (1-2 предложения)",
  "isCorrect": true если балл >= 6, иначе false,
  "improvements": "что можно улучшить (если балл < 10)"
}

Критерии оценки:
- 0-3: Ответ неверный или не по теме
- 4-5: Частично верно, много ошибок
- 6-7: В целом верно, есть недочёты
- 8-9: Хороший ответ с незначительными упущениями
- 10: Идеальный ответ`
          },
          {
            role: "user",
            content: `Вопрос/сценарий: ${question}
${context ? `Контекст: ${context}` : ''}
${idealAnswer ? `Примерный идеальный ответ: ${idealAnswer}` : ''}

Ответ пользователя: ${userAnswer}

Оцени ответ.`
          }
        ],
        temperature: 0.3,
        max_tokens: 300,
        response_format: { type: "json_object" }
      });
      
      const content = response.choices[0]?.message?.content || '{}';
      const evaluation = JSON.parse(content);
      
      res.json({
        score: Math.min(10, Math.max(0, Number(evaluation.score) || 0)),
        feedback: evaluation.feedback || "Ответ оценён",
        isCorrect: evaluation.isCorrect === true || (Number(evaluation.score) >= 6),
        improvements: evaluation.improvements || null
      });
    } catch (error) {
      console.error("Evaluation error:", error);
      res.json({
        score: 5,
        feedback: "Ответ принят",
        isCorrect: true,
        improvements: null
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

  seedDatabase().catch(err => console.error("Seeding failed:", err));

  return httpServer;
}
