import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { api } from "@shared/routes";
import { z } from "zod";
import { insertDrillAttemptSchema } from "@shared/schema";
import { seedDatabase } from "./seed";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

async function generateTrackContent(title: string, knowledgeBase: string, strictMode: boolean = true) {
  const systemPrompt = `Ты - эксперт по созданию обучающих курсов на РУССКОМ языке. 
Твоя задача: создать учебный курс на основе предоставленной базы знаний.

ВАЖНЫЕ ПРАВИЛА:
1. ВСЕ тексты должны быть ТОЛЬКО НА РУССКОМ ЯЗЫКЕ
2. ${strictMode ? 'Используй ТОЛЬКО информацию из базы знаний. Не добавляй ничего от себя.' : 'Можешь дополнять информацию, но основывайся на базе знаний.'}
3. Вопросы и ответы должны быть напрямую связаны с текстом базы знаний
4. ОБЯЗАТЕЛЬНО включи ролевой сценарий в конце

Формат ответа - ТОЛЬКО JSON массив шагов:
[
  {
    "type": "content",
    "tag": "введение",
    "content": { "text": "Текст урока на русском..." }
  },
  {
    "type": "quiz", 
    "tag": "тема1",
    "content": { 
      "question": "Вопрос на русском?", 
      "options": ["Вариант 1", "Вариант 2", "Вариант 3", "Вариант 4"], 
      "correctIndex": 0,
      "explanation": "Объяснение правильного ответа"
    }
  },
  {
    "type": "content",
    "tag": "основы",
    "content": { "text": "Ещё текст урока..." }
  },
  {
    "type": "quiz",
    "tag": "основы", 
    "content": { 
      "question": "Ещё вопрос?", 
      "options": ["А", "Б", "В", "Г"], 
      "correctIndex": 1,
      "explanation": "Почему Б правильный ответ"
    }
  },
  {
    "type": "roleplay",
    "tag": "практика",
    "content": { 
      "scenario": "Описание ситуации для ролевой игры на русском...",
      "context": "Контекст ситуации",
      "ideal_answer": "Примерный идеальный ответ сотрудника"
    }
  }
]

Создай минимум 5 шагов: 2 content, 2 quiz и 1 roleplay.`;

  const userPrompt = `Создай учебный курс "${title}" на основе этой базы знаний:

${knowledgeBase}

Помни: всё на русском языке, вопросы строго по тексту, обязательно включи roleplay сценарий.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 4000,
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

  // Tracks
  app.post(api.tracks.generate.path, async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== 'curator') return res.sendStatus(401);
    
    try {
      const { title, text, strictMode } = api.tracks.generate.input.parse(req.body);
      
      const cleanText = text.replace(/\x00/g, '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
      
      const track = await storage.createTrack({
        curatorId: (req.user as any).id,
        title,
        rawKnowledgeBase: cleanText,
        strictMode: strictMode !== false,
        joinCode: Math.random().toString().substring(2, 8)
      });

      const generatedSteps = await generateTrackContent(title, cleanText, strictMode !== false);
      const stepsWithTrackId = generatedSteps.map(s => ({ ...s, trackId: track.id }));
      
      const createdSteps = await storage.createSteps(stepsWithTrackId);
      
      res.status(201).json({ track, steps: createdSteps });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Track generation error:", err);
      res.status(500).json({ message: "Ошибка генерации курса" });
    }
  });

  app.get(api.tracks.list.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user as any;
    
    if (user.role === 'curator') {
      const tracks = await storage.getTracksByCurator(user.id);
      res.json(tracks);
    } else {
      res.json([]);
    }
  });

  app.get(api.tracks.get.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const track = await storage.getTrack(Number(req.params.id));
    if (!track) return res.status(404).json({ message: "Track not found" });
    
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
    const analytics = await storage.getTrackAnalytics(trackId);
    res.json(analytics);
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
