ALTER TABLE "enrollments" ADD COLUMN "last_success_rate" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN "correct_answers" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN "total_answers" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN "score_points" integer DEFAULT 0;