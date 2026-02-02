-- Migration: Auth Profile Sync Trigger
-- Description: Automatically creates user profiles in public.users when auth.users records are created
-- This ensures profile synchronization for Supabase Auth integration

-- Function to create user profile on auth.users insert
CREATE OR REPLACE FUNCTION public.handle_auth_user_created()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if profile already exists (idempotency)
  IF NOT EXISTS (
    SELECT 1 FROM public.users WHERE auth_uid = NEW.id
  ) THEN
    -- Extract metadata from auth user
    INSERT INTO public.users (
      auth_uid,
      email,
      name,
      role,
      email_verified,
      plan,
      created_courses_count,
      password
    ) VALUES (
      NEW.id,
      NEW.email,
      COALESCE(
        NEW.raw_user_meta_data->>'name',
        split_part(NEW.email, '@', 1)
      ),
      COALESCE(
        CASE 
          WHEN NEW.raw_user_meta_data->>'role' IN ('curator', 'employee') 
          THEN NEW.raw_user_meta_data->>'role'
          ELSE 'employee'
        END,
        'employee'
      ),
      (NEW.email_confirmed_at IS NOT NULL),
      'trial',
      0,
      NULL -- Password managed by Supabase Auth
    )
    ON CONFLICT (auth_uid) DO NOTHING; -- Extra safety against race conditions
    
    -- Log profile creation
    RAISE LOG 'Created user profile for auth.users.id = %', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_auth_user_created();

-- Trigger to sync email verification status
CREATE OR REPLACE FUNCTION public.handle_auth_user_updated()
RETURNS TRIGGER AS $$
BEGIN
  -- Sync email verification status when changed in auth.users
  IF (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL) THEN
    UPDATE public.users
    SET 
      email_verified = true,
      email_verification_token = NULL,
      email_verification_expires = NULL
    WHERE auth_uid = NEW.id;
    
    RAISE LOG 'Synced email verification for auth.users.id = %', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for email verification sync
DROP TRIGGER IF EXISTS on_auth_user_email_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_email_confirmed
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  WHEN (OLD.email_confirmed_at IS DISTINCT FROM NEW.email_confirmed_at)
  EXECUTE FUNCTION public.handle_auth_user_updated();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.handle_auth_user_created() TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.handle_auth_user_updated() TO postgres, service_role;

-- Backfill: Create profiles for existing auth users without profiles
-- This handles migration of existing users
DO $$ 
DECLARE
  auth_user_record RECORD;
  new_profile_count INT := 0;
BEGIN
  FOR auth_user_record IN 
    SELECT id, email, raw_user_meta_data, email_confirmed_at
    FROM auth.users
    WHERE id NOT IN (SELECT auth_uid FROM public.users WHERE auth_uid IS NOT NULL)
  LOOP
    INSERT INTO public.users (
      auth_uid,
      email,
      name,
      role,
      email_verified,
      plan,
      created_courses_count,
      password
    ) VALUES (
      auth_user_record.id,
      auth_user_record.email,
      COALESCE(
        auth_user_record.raw_user_meta_data->>'name',
        split_part(auth_user_record.email, '@', 1)
      ),
      COALESCE(
        CASE 
          WHEN auth_user_record.raw_user_meta_data->>'role' IN ('curator', 'employee') 
          THEN auth_user_record.raw_user_meta_data->>'role'
          ELSE 'employee'
        END,
        'employee'
      ),
      (auth_user_record.email_confirmed_at IS NOT NULL),
      'trial',
      0,
      NULL
    )
    ON CONFLICT (auth_uid) DO NOTHING;
    
    new_profile_count := new_profile_count + 1;
  END LOOP;
  
  RAISE NOTICE 'Backfilled % user profiles', new_profile_count;
END $$;
