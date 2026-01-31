-- Migration 0002: Auth Enhancements - Email Verification & Promo Codes
-- Add email verification, user plans, and promo code system

-- 1. Extend users table with email verification fields
ALTER TABLE "users" ADD COLUMN "email_verified" boolean DEFAULT false;
ALTER TABLE "users" ADD COLUMN "email_verification_token" text;
ALTER TABLE "users" ADD COLUMN "email_verification_expires" timestamp;
ALTER TABLE "users" ADD COLUMN "plan" text DEFAULT 'trial' CHECK (plan IN ('trial', 'unlimited'));
ALTER TABLE "users" ADD COLUMN "created_courses_count" integer DEFAULT 0;
ALTER TABLE "users" ADD COLUMN "promo_activated_at" timestamp;

-- 2. Create promo_codes table
CREATE TABLE "promo_codes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "code" text NOT NULL UNIQUE,
  "email" text NOT NULL,
  "is_used" boolean DEFAULT false,
  "used_by" integer REFERENCES "users"("id"),
  "used_at" timestamp,
  "created_at" timestamp DEFAULT now()
);

-- 3. Add indexes for performance
CREATE INDEX "idx_users_verification_token" ON "users"("email_verification_token");
CREATE INDEX "idx_promo_codes_code" ON "promo_codes"("code");
CREATE INDEX "idx_promo_codes_email" ON "promo_codes"(LOWER("email"));

-- 4. Backfill: Set existing users as verified (grandfather clause)
UPDATE "users" SET "email_verified" = true WHERE "email_verified" = false;

-- 5. Backfill: Count existing courses for curators
UPDATE "users" u
SET "created_courses_count" = (
  SELECT COUNT(*) FROM "tracks" t WHERE t.curator_id = u.id
)
WHERE u.role = 'curator';

-- Comments for documentation
COMMENT ON COLUMN "users"."email_verified" IS 'Whether user has verified their email address';
COMMENT ON COLUMN "users"."email_verification_token" IS 'Token for email verification (32 bytes hex)';
COMMENT ON COLUMN "users"."email_verification_expires" IS 'When verification token expires (24 hours from creation)';
COMMENT ON COLUMN "users"."plan" IS 'User plan: trial (limited) or unlimited (promo activated)';
COMMENT ON COLUMN "users"."created_courses_count" IS 'Number of courses created (for trial limit enforcement)';
COMMENT ON COLUMN "users"."promo_activated_at" IS 'When promo code was activated to unlock unlimited plan';
COMMENT ON TABLE "promo_codes" IS 'Promo codes for upgrading trial accounts to unlimited';
