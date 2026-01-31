CREATE TABLE "ai_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"correlation_id" text NOT NULL,
	"user_id" integer,
	"track_id" integer,
	"course_id" integer,
	"action_type" text NOT NULL,
	"kb_enabled" boolean DEFAULT false,
	"kb_source_ids" integer[],
	"blueprint_id" integer,
	"retrieved_chunk_ids" text[],
	"retrieved_chunk_previews" text[],
	"prompt_text" text,
	"prompt_hash" text,
	"response_text" text,
	"response_hash" text,
	"latency_ms" integer,
	"status" text NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "drill_attempts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"step_id" integer NOT NULL,
	"track_id" integer NOT NULL,
	"tag" text,
	"attempt_type" text DEFAULT 'initial',
	"is_correct" boolean NOT NULL,
	"user_answer" text,
	"correct_answer" text,
	"error_reason" text,
	"score" integer,
	"timestamp" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "enrollments" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"track_id" integer NOT NULL,
	"progress_pct" integer DEFAULT 0,
	"is_completed" boolean DEFAULT false,
	"last_step_index" integer DEFAULT 0,
	"needs_repeat_tags" text[],
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "kb_chunks" (
	"id" serial PRIMARY KEY NOT NULL,
	"track_id" integer NOT NULL,
	"source_id" integer,
	"chunk_index" integer NOT NULL,
	"section_title" text,
	"content" text NOT NULL,
	"content_hash" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "kb_index" (
	"id" serial PRIMARY KEY NOT NULL,
	"course_id" integer NOT NULL,
	"topics" jsonb NOT NULL,
	"version" integer DEFAULT 1,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "knowledge_sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"course_id" integer NOT NULL,
	"filename" text NOT NULL,
	"storage_path" text NOT NULL,
	"mimetype" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"page_count" integer,
	"extracted_char_count" integer NOT NULL,
	"status" text DEFAULT 'uploaded' NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "steps" (
	"id" serial PRIMARY KEY NOT NULL,
	"track_id" integer NOT NULL,
	"type" text NOT NULL,
	"tag" text,
	"content" jsonb NOT NULL,
	"order_index" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tracks" (
	"id" serial PRIMARY KEY NOT NULL,
	"curator_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"raw_knowledge_base" text NOT NULL,
	"join_code" text NOT NULL,
	"strict_mode" boolean DEFAULT true,
	"course_structure" jsonb,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "tracks_join_code_unique" UNIQUE("join_code")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"role" text DEFAULT 'employee' NOT NULL,
	"name" text NOT NULL,
	"avatar_url" text,
	"prefer_voice" boolean DEFAULT false,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
