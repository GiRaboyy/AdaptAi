import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { api } from "@shared/routes";
import { z } from "zod";
import { insertDrillAttemptSchema } from "@shared/schema";
import { seedDatabase } from "./seed";

// Mock AI Logic
async function generateTrackContent(title: string, text: string) {
  // Simulate AI delay
  await new Promise(resolve => setTimeout(resolve, 1500));

  // If OLLAMA_BASE_URL is set, we would fetch(process.env.OLLAMA_BASE_URL + '/api/generate', ...)
  // But for MVP, we stick to the mock logic as requested if missing.

  const steps = [
    {
      type: "content" as const,
      content: { text: `Welcome to "${title}". Here is the core concept: ${text.substring(0, 100)}...` },
      orderIndex: 0
    },
    {
      type: "quiz" as const,
      content: { 
        question: "What is the main topic of this training?", 
        options: [title, "Something unrelated", "Cooking 101"], 
        correctIndex: 0 
      },
      orderIndex: 1
    },
    {
      type: "content" as const,
      content: { text: "Key principle: Listen first, then act. This ensures you understand the problem fully." },
      orderIndex: 2
    },
    {
      type: "roleplay" as const,
      content: { 
        scenario: "A customer says they are unhappy with the service delay. Respond appropriately.",
        ideal_answer: "I apologize for the delay. I'm looking into it now."
      },
      orderIndex: 3
    }
  ];
  return steps;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Setup Auth (Passport + Session)
  setupAuth(app);

  // Tracks
  app.post(api.tracks.generate.path, async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== 'curator') return res.sendStatus(401);
    
    try {
      const { title, text } = api.tracks.generate.input.parse(req.body);
      
      // 1. Create Track
      const track = await storage.createTrack({
        curatorId: (req.user as any).id,
        title,
        rawKnowledgeBase: text,
        joinCode: Math.random().toString().substring(2, 8) // 6 digit random code
      });

      // 2. Generate Steps (Mock AI)
      const generatedSteps = await generateTrackContent(title, text);
      const stepsWithTrackId = generatedSteps.map(s => ({ ...s, trackId: track.id }));
      
      const createdSteps = await storage.createSteps(stepsWithTrackId);
      
      res.status(201).json({ track, steps: createdSteps });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.get(api.tracks.list.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user as any;
    
    if (user.role === 'curator') {
      const tracks = await storage.getTracksByCurator(user.id);
      res.json(tracks);
    } else {
      // Employee sees enrolled tracks (handled via enrollments endpoint mostly, but maybe here too?)
      // For now, simple logic: return empty or implement enrolled tracks
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
    
    // Check if already enrolled
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
    
    const updated = await storage.updateEnrollmentProgress(id, stepIndex, isCompleted);
    res.json(updated);
  });

  app.patch("/api/enrollments/progress", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const trackId = Number(req.body.trackId);
    const stepIndex = Number(req.body.stepIndex);
    const isCompleted = req.body.isCompleted === true;
    
    if (isNaN(trackId) || isNaN(stepIndex)) {
      return res.status(400).json({ message: "Invalid trackId or stepIndex" });
    }
    
    const userId = (req.user as any).id;
    
    const enrollment = await storage.getEnrollment(userId, trackId);
    if (!enrollment) return res.status(404).json({ message: "Enrollment not found" });
    
    const updated = await storage.updateEnrollmentProgress(enrollment.id, stepIndex, isCompleted);
    res.json(updated);
  });

  // Drills
  app.post(api.drills.record.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).id;
    const { stepId, isCorrect, transcript, score } = req.body;
    
    const attempt = await storage.createDrillAttempt({
      userId,
      stepId: Number(stepId),
      isCorrect: isCorrect === true,
      transcript: transcript || null,
      score: Number(score) || 0,
    });
    res.status(201).json(attempt);
  });

  seedDatabase().catch(err => console.error("Seeding failed:", err));

  return httpServer;
}
