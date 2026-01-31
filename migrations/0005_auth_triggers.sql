-- Migration 0005: Auth synchronization triggers
-- Auto-create public.users profile when auth.users is created
-- Sync email changes from auth.users to public.users

-- Function to handle new auth user creation
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
  existing_user_id INT;
  default_name TEXT;
BEGIN
  -- Extract name from metadata, or use email prefix as fallback
  default_name := COALESCE(
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );

  -- Check if a profile already exists with this email
  SELECT id INTO existing_user_id
  FROM public.users
  WHERE LOWER(email) = LOWER(NEW.email)
  LIMIT 1;

  IF existing_user_id IS NOT NULL THEN
    -- Update existing profile with auth_uid if it's null
    UPDATE public.users
    SET auth_uid = NEW.id
    WHERE id = existing_user_id
      AND auth_uid IS NULL;
    
    RAISE NOTICE 'Linked existing profile (id: %) with auth user: %', existing_user_id, NEW.id;
  ELSE
    -- Create new profile
    INSERT INTO public.users (
      email,
      name,
      role,
      password,
      auth_uid,
      email_verified,
      plan,
      created_courses_count
    ) VALUES (
      NEW.email,
      default_name,
      COALESCE(NEW.raw_user_meta_data->>'role', 'employee'),
      NULL, -- password managed by Supabase Auth
      NEW.id,
      (NEW.email_confirmed_at IS NOT NULL),
      'trial',
      0
    );
    
    RAISE NOTICE 'Created new profile for auth user: %', NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create profile on auth user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

-- Function to sync email changes from auth.users to public.users
CREATE OR REPLACE FUNCTION public.sync_auth_email()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if email actually changed
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    UPDATE public.users
    SET email = NEW.email
    WHERE auth_uid = NEW.id;
    
    RAISE NOTICE 'Synced email change for auth user: % to %', NEW.id, NEW.email;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to sync email changes
DROP TRIGGER IF EXISTS on_auth_user_email_change ON auth.users;
CREATE TRIGGER on_auth_user_email_change
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  WHEN (NEW.email IS DISTINCT FROM OLD.email)
  EXECUTE FUNCTION public.sync_auth_email();

-- Backfill existing users: Link auth.users to public.users by matching emails
-- This is a data migration that runs once
DO $$
DECLARE
  linked_count INT;
  orphaned_profiles INT;
  orphaned_auth_users INT;
BEGIN
  -- Link existing users by email (case-insensitive)
  WITH updated AS (
    UPDATE public.users u
    SET auth_uid = a.id
    FROM auth.users a
    WHERE u.auth_uid IS NULL
      AND LOWER(u.email) = LOWER(a.email)
    RETURNING u.id
  )
  SELECT COUNT(*) INTO linked_count FROM updated;
  
  RAISE NOTICE 'Backfill: Linked % existing profiles with auth users', linked_count;

  -- Count orphaned profiles (no matching auth user)
  SELECT COUNT(*) INTO orphaned_profiles
  FROM public.users
  WHERE auth_uid IS NULL;
  
  IF orphaned_profiles > 0 THEN
    RAISE WARNING 'Found % profiles without matching auth users', orphaned_profiles;
  END IF;

  -- Count auth users without profiles (should be rare after trigger)
  SELECT COUNT(*) INTO orphaned_auth_users
  FROM auth.users
  WHERE id NOT IN (SELECT auth_uid FROM public.users WHERE auth_uid IS NOT NULL);
  
  IF orphaned_auth_users > 0 THEN
    RAISE WARNING 'Found % auth users without profiles - will be created on next login', orphaned_auth_users;
  END IF;
END $$;

-- Comments
COMMENT ON FUNCTION public.handle_new_auth_user() IS 'Auto-creates or links public.users profile when auth.users record is created';
COMMENT ON FUNCTION public.sync_auth_email() IS 'Keeps public.users.email in sync with auth.users.email';
