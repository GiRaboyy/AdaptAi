import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role", { enum: ["curator", "employee"] }).notNull().default("employee"),
  name: text("name").notNull(),
});

export const tracks = pgTable("tracks", {
  id: serial("id").primaryKey(),
  curatorId: integer("curator_id").notNull(), // References users.id
  title: text("title").notNull(),
  rawKnowledgeBase: text("raw_knowledge_base").notNull(),
  joinCode: text("join_code").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const steps = pgTable("steps", {
  id: serial("id").primaryKey(),
  trackId: integer("track_id").notNull(), // References tracks.id
  type: text("type", { enum: ["content", "quiz", "roleplay"] }).notNull(),
  // content_json stores the step data based on type:
  // content: { text: string }
  // quiz: { question: string, options: string[], correctIndex: number }
  // roleplay: { scenario: string, ideal_answer: string }
  content: jsonb("content").notNull(), 
  orderIndex: integer("order_index").notNull(),
});

export const enrollments = pgTable("enrollments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  trackId: integer("track_id").notNull(),
  progressPct: integer("progress_pct").default(0),
  isCompleted: boolean("is_completed").default(false),
  lastStepIndex: integer("last_step_index").default(0),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const drillAttempts = pgTable("drill_attempts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  stepId: integer("step_id").notNull(),
  isCorrect: boolean("is_correct").notNull(),
  transcript: text("transcript"), // User's spoken answer
  score: integer("score"), // 0-10
  timestamp: timestamp("timestamp").defaultNow(),
});

// Relations
export const tracksRelations = relations(tracks, ({ one, many }) => ({
  curator: one(users, {
    fields: [tracks.curatorId],
    references: [users.id],
  }),
  steps: many(steps),
}));

export const stepsRelations = relations(steps, ({ one }) => ({
  track: one(tracks, {
    fields: [steps.trackId],
    references: [tracks.id],
  }),
}));

export const enrollmentsRelations = relations(enrollments, ({ one }) => ({
  user: one(users, {
    fields: [enrollments.userId],
    references: [users.id],
  }),
  track: one(tracks, {
    fields: [enrollments.trackId],
    references: [tracks.id],
  }),
}));

// Schemas
export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  password: true,
  role: true,
  name: true,
});

export const insertTrackSchema = createInsertSchema(tracks).omit({ 
  id: true, 
  curatorId: true, 
  createdAt: true 
});

export const insertStepSchema = createInsertSchema(steps).omit({ id: true });
export const insertEnrollmentSchema = createInsertSchema(enrollments).omit({ id: true, updatedAt: true });
export const insertDrillAttemptSchema = createInsertSchema(drillAttempts).omit({ id: true, timestamp: true });

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Track = typeof tracks.$inferSelect;
export type Step = typeof steps.$inferSelect;
export type Enrollment = typeof enrollments.$inferSelect;
export type DrillAttempt = typeof drillAttempts.$inferSelect;
