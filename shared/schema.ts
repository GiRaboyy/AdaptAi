import { pgTable, text, serial, integer, boolean, timestamp, jsonb, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  authUid: uuid("auth_uid").unique(), // Links to auth.users(id) - single source of truth
  email: text("email").notNull().unique(),
  password: text("password"), // DEPRECATED: Now nullable, managed by Supabase Auth
  role: text("role", { enum: ["curator", "employee"] }).notNull().default("employee"),
  name: text("name").notNull(),
  avatarUrl: text("avatar_url"),
  preferVoice: boolean("prefer_voice").default(false),
  // Email verification fields (deprecated - now handled by Supabase Auth)
  emailVerified: boolean("email_verified").default(false),
  emailVerificationToken: text("email_verification_token"),
  emailVerificationExpires: timestamp("email_verification_expires"),
  // Plan and limits
  plan: text("plan", { enum: ["trial", "unlimited"] }).default("trial"),
  createdCoursesCount: integer("created_courses_count").default(0),
  promoActivatedAt: timestamp("promo_activated_at"),
});

export const tracks = pgTable("tracks", {
  id: serial("id").primaryKey(),
  curatorId: integer("curator_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  rawKnowledgeBase: text("raw_knowledge_base").notNull(),
  joinCode: text("join_code").notNull().unique(),
  strictMode: boolean("strict_mode").default(true),
  courseStructure: jsonb("course_structure"),
  maxEmployees: integer("max_employees").default(3),
  createdAt: timestamp("created_at").defaultNow(),
});

// Step types: ONLY mcq, open, roleplay allowed. "content" type is FORBIDDEN.
export const steps = pgTable("steps", {
  id: serial("id").primaryKey(),
  trackId: integer("track_id").notNull(),
  type: text("type", { enum: ["mcq", "open", "roleplay"] }).notNull(),
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
  lastSuccessRate: integer("last_success_rate").default(0),
  correctAnswers: integer("correct_answers").default(0),
  totalAnswers: integer("total_answers").default(0),
  scorePoints: integer("score_points").default(0),
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

// Knowledge Sources - stores metadata about uploaded KB files
export const knowledgeSources = pgTable("knowledge_sources", {
  id: serial("id").primaryKey(),
  courseId: integer("course_id").notNull(),
  filename: text("filename").notNull(),
  storagePath: text("storage_path").notNull(),
  mimetype: text("mimetype").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  pageCount: integer("page_count"),
  extractedCharCount: integer("extracted_char_count").notNull(),
  status: text("status", { enum: ["uploaded", "parsing", "indexed", "failed"] }).notNull().default("uploaded"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Knowledge Base Chunks for RAG (Enhanced)
export const kbChunks = pgTable("kb_chunks", {
  id: serial("id").primaryKey(),
  trackId: integer("track_id").notNull(),
  sourceId: integer("source_id"),
  chunkIndex: integer("chunk_index").notNull(),
  sectionTitle: text("section_title"),
  content: text("content").notNull(),
  contentHash: text("content_hash"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

// KB Index - stores topic mapping for retrieval
export const kbIndex = pgTable("kb_index", {
  id: serial("id").primaryKey(),
  courseId: integer("course_id").notNull(),
  topics: jsonb("topics").notNull(),
  version: integer("version").default(1),
  createdAt: timestamp("created_at").defaultNow(),
});

// AI Logs for observability (Enhanced)
export const aiLogs = pgTable("ai_logs", {
  id: serial("id").primaryKey(),
  correlationId: text("correlation_id").notNull(),
  userId: integer("user_id"),
  trackId: integer("track_id"),
  courseId: integer("course_id"),
  actionType: text("action_type", { enum: ["generate_course", "assistant", "evaluate", "drill_generate", "test", "kb_index", "blueprint", "lesson_generate"] }).notNull(),
  kbEnabled: boolean("kb_enabled").default(false),
  kbSourceIds: integer("kb_source_ids").array(),
  blueprintId: integer("blueprint_id"),
  retrievedChunkIds: text("retrieved_chunk_ids").array(),
  retrievedChunkPreviews: text("retrieved_chunk_previews").array(),
  promptText: text("prompt_text"),
  promptHash: text("prompt_hash"),
  responseText: text("response_text"),
  responseHash: text("response_hash"),
  latencyMs: integer("latency_ms"),
  status: text("status", { enum: ["success", "error"] }).notNull(),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Promo Codes for unlimited plan activation
export const promoCodes = pgTable("promo_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  email: text("email").notNull(),
  isUsed: boolean("is_used").default(false),
  usedBy: integer("used_by"),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Course Members - tracks membership (separate from enrollment progress)
export const courseMembers = pgTable("course_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  courseId: integer("course_id").notNull(),
  userId: integer("user_id").notNull(),
  memberRole: text("member_role", { enum: ["employee", "curator"] }).notNull(),
  joinedAt: timestamp("joined_at").defaultNow(),
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
export type KnowledgeSource = typeof knowledgeSources.$inferSelect;
export type KBChunk = typeof kbChunks.$inferSelect;
export type KBIndex = typeof kbIndex.$inferSelect;
export type AILog = typeof aiLogs.$inferSelect;
export type PromoCode = typeof promoCodes.$inferSelect;
export type CourseMember = typeof courseMembers.$inferSelect;

// Insert schemas
export const insertKnowledgeSourceSchema = createInsertSchema(knowledgeSources).omit({ id: true, createdAt: true });
export const insertKBIndexSchema = createInsertSchema(kbIndex).omit({ id: true, createdAt: true });
export const insertPromoCodeSchema = createInsertSchema(promoCodes).omit({ id: true, createdAt: true });
export const insertCourseMemberSchema = createInsertSchema(courseMembers).omit({ id: true, joinedAt: true });
