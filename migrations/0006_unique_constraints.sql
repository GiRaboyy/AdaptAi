-- Migration 0006: Add unique constraints to prevent data corruption
-- Ensures that users can't enroll in the same track multiple times

-- Add unique constraint on enrollments if it doesn't exist
DO $$
BEGIN
  -- Check if constraint already exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'enrollments_user_id_track_id_unique'
  ) THEN
    -- Create unique constraint
    ALTER TABLE "enrollments"
      ADD CONSTRAINT "enrollments_user_id_track_id_unique"
      UNIQUE ("user_id", "track_id");
    
    RAISE NOTICE 'Added unique constraint: enrollments(user_id, track_id)';
  ELSE
    RAISE NOTICE 'Unique constraint already exists: enrollments(user_id, track_id)';
  END IF;
END $$;

-- Note: course_members and tracks already have necessary unique constraints:
-- - course_members: Has unique constraint on (course_id, user_id)
-- - tracks: Has unique constraint on join_code

-- Add index for common query patterns
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_enrollments_user_id" ON "enrollments"("user_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_enrollments_track_id" ON "enrollments"("track_id");

-- Comments
COMMENT ON CONSTRAINT "enrollments_user_id_track_id_unique" ON "enrollments" 
  IS 'Ensures a user can only enroll in a track once';
