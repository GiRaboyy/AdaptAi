-- Migration 0007: Email Verification Sync
-- Sync email_verified status from Supabase auth to public.users
-- This ensures that when Supabase confirms email, the local DB is updated

-- Function to sync email verification from auth.users to public.users
CREATE OR REPLACE FUNCTION public.sync_email_verification()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if email_confirmed_at changed from NULL to a timestamp
  IF OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL THEN
    UPDATE public.users
    SET 
      email_verified = TRUE,
      email_verification_token = NULL,
      email_verification_expires = NULL
    WHERE auth_uid = NEW.id;
    
    RAISE NOTICE 'Synced email verification for auth user: %', NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to sync email verification on update
DROP TRIGGER IF EXISTS on_auth_email_confirmed ON auth.users;
CREATE TRIGGER on_auth_email_confirmed
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
  EXECUTE FUNCTION public.sync_email_verification();

-- Backfill existing verified users
-- Sync email_verified for users who are already confirmed in Supabase
DO $$
DECLARE
  synced_count INT;
BEGIN
  WITH updated AS (
    UPDATE public.users u
    SET 
      email_verified = TRUE,
      email_verification_token = NULL,
      email_verification_expires = NULL
    FROM auth.users a
    WHERE u.auth_uid = a.id
      AND a.email_confirmed_at IS NOT NULL
      AND u.email_verified = FALSE
    RETURNING u.id
  )
  SELECT COUNT(*) INTO synced_count FROM updated;
  
  RAISE NOTICE 'Backfill: Synced email verification for % existing users', synced_count;
END $$;

-- Comments
COMMENT ON FUNCTION public.sync_email_verification() IS 'Syncs email_verified status from auth.users.email_confirmed_at to public.users.email_verified';
