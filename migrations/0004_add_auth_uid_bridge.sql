-- Migration 0004: Add auth_uid bridge column to link public.users with auth.users
-- This migration adds the bridge column and necessary indexes for Supabase Auth integration
-- Part 1: Schema changes (non-blocking)

-- 1. Add auth_uid column to link with Supabase Auth users
ALTER TABLE "users" ADD COLUMN "auth_uid" uuid;

-- 2. Create unique partial index on auth_uid (only for non-null values)
-- Using CONCURRENTLY to avoid blocking
CREATE UNIQUE INDEX CONCURRENTLY "idx_users_auth_uid_unique" ON "users"("auth_uid") WHERE "auth_uid" IS NOT NULL;

-- 3. Create index on lowercase email for case-insensitive lookups
CREATE INDEX CONCURRENTLY "idx_users_email_lower" ON "users"(LOWER("email"));

-- 4. Make password column nullable (it will be deprecated in favor of Supabase Auth)
ALTER TABLE "users" ALTER COLUMN "password" DROP NOT NULL;

-- 5. Try to add foreign key constraint (may fail if permissions don't allow cross-schema FK)
-- If this fails, the unique index above provides data integrity
DO $$
BEGIN
  ALTER TABLE "users" 
    ADD CONSTRAINT "users_auth_uid_fkey" 
    FOREIGN KEY ("auth_uid") 
    REFERENCES auth.users("id") 
    ON DELETE SET NULL;
  RAISE NOTICE 'Foreign key constraint added successfully';
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping FK constraint due to permissions - relying on unique index';
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not add FK constraint: % - relying on unique index', SQLERRM;
END $$;

-- Comments for documentation
COMMENT ON COLUMN "users"."auth_uid" IS 'UUID linking to auth.users(id) - single source of truth for authentication';
COMMENT ON COLUMN "users"."password" IS 'DEPRECATED: Password now managed by Supabase Auth. This column kept for backward compatibility but should not be used.';
