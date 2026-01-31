-- Migration 0003: Course Limits - Employee Limits & Course Members
-- Add max_employees to tracks and create course_members table

-- 1. Extend tracks table with employee limit
ALTER TABLE "tracks" ADD COLUMN "max_employees" integer DEFAULT 3;

-- 2. Create course_members table for tracking course membership
CREATE TABLE "course_members" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "course_id" integer NOT NULL REFERENCES "tracks"("id") ON DELETE CASCADE,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "member_role" text NOT NULL CHECK (member_role IN ('employee', 'curator')),
  "joined_at" timestamp DEFAULT now(),
  UNIQUE("course_id", "user_id")
);

-- 3. Add indexes for performance
CREATE INDEX "idx_course_members_course_id" ON "course_members"("course_id");
CREATE INDEX "idx_course_members_user_id" ON "course_members"("user_id");
CREATE INDEX "idx_course_members_role" ON "course_members"("course_id", "member_role");

-- 4. Create PostgreSQL function for atomic course join with limit checking
CREATE OR REPLACE FUNCTION join_course(
  p_course_id integer,
  p_user_id integer
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_max_employees integer;
  v_current_count integer;
  v_existing_member uuid;
  v_result jsonb;
BEGIN
  -- Lock the course row to prevent race conditions
  SELECT max_employees INTO v_max_employees
  FROM tracks
  WHERE id = p_course_id
  FOR UPDATE;
  
  -- Check if course exists
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'errorCode', 'COURSE_NOT_FOUND',
      'message', 'Курс не найден'
    );
  END IF;
  
  -- Check if user is already a member
  SELECT id INTO v_existing_member
  FROM course_members
  WHERE course_id = p_course_id AND user_id = p_user_id;
  
  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Already a member',
      'memberId', v_existing_member
    );
  END IF;
  
  -- Count current employees (excluding curators)
  SELECT COUNT(*) INTO v_current_count
  FROM course_members
  WHERE course_id = p_course_id AND member_role = 'employee';
  
  -- Check if limit reached (null means unlimited)
  IF v_max_employees IS NOT NULL AND v_current_count >= v_max_employees THEN
    RETURN jsonb_build_object(
      'success', false,
      'errorCode', 'EMPLOYEE_LIMIT_REACHED',
      'message', 'К этому курсу уже подключено максимальное число сотрудников. Обратитесь к куратору.'
    );
  END IF;
  
  -- Add member
  INSERT INTO course_members (course_id, user_id, member_role)
  VALUES (p_course_id, p_user_id, 'employee')
  RETURNING id INTO v_existing_member;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Successfully joined',
    'memberId', v_existing_member
  );
END;
$$;

-- 5. Backfill: Insert curator memberships for all existing tracks
INSERT INTO course_members (course_id, user_id, member_role)
SELECT t.id, t.curator_id, 'curator'
FROM tracks t
ON CONFLICT (course_id, user_id) DO NOTHING;

-- 6. Backfill: Insert employee memberships from existing enrollments
INSERT INTO course_members (course_id, user_id, member_role)
SELECT e.track_id, e.user_id, 'employee'
FROM enrollments e
INNER JOIN users u ON e.user_id = u.id
WHERE u.role = 'employee'
ON CONFLICT (course_id, user_id) DO NOTHING;

-- Comments for documentation
COMMENT ON COLUMN "tracks"."max_employees" IS 'Maximum employees allowed (3 for trial, NULL for unlimited)';
COMMENT ON TABLE "course_members" IS 'Tracks course membership (separate from enrollment progress)';
COMMENT ON FUNCTION join_course IS 'Atomically joins a course with employee limit checking';
