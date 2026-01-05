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
  avatarUrl: text("avatar_url"),
  preferVoice: boolean("prefer_voice").default(false),
});

export const tracks = pgTable("tracks", {
  id: serial("id").primaryKey(),
  curatorId: integer("curator_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  rawKnowledgeBase: text("raw_knowledge_base").notNull(),
  joinCode: text("join_code").notNull().unique(),
  strictMode: boolean("strict_mode").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const steps = pgTable("steps", {
  id: serial("id").primaryKey(),
  trackId: integer("track_id").notNull(),
  type: text("type", { enum: ["content", "quiz", "open", "roleplay"] }).notNull(),
  tag: text("tag"),
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
  needsRepeatTags: text("needs_repeat_tags").array(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const drillAttempts = pgTable("drill_attempts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  stepId: integer("step_id").notNull(),
  trackId: integer("track_id").notNull(),
  tag: text("tag"),
  attemptType: text("attempt_type", { enum: ["initial", "drill_1", "drill_2"] }).default("initial"),
  isCorrect: boolean("is_correct").notNull(),
  userAnswer: text("user_answer"),
  correctAnswer: text("correct_answer"),
  errorReason: text("error_reason"),
  score: integer("score"),
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

// Chat tables for AI integration
export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Track = typeof tracks.$inferSelect;
export type Step = typeof steps.$inferSelect;
export type Enrollment = typeof enrollments.$inferSelect;
export type DrillAttempt = typeof drillAttempts.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
