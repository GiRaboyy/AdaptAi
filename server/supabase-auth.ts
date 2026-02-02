import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Supabase Auth configuration
// Uses the same project URL as storage but with anon key for auth
const SUPABASE_URL = process.env.DATABASE_FILE_STORAGE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.DATABASE_FILE_STORAGE_KEY;

let supabaseAuthClient: SupabaseClient | null = null;

/**
 * Check if URL looks like a Supabase project URL
 */
function isValidSupabaseUrl(url: string | undefined): boolean {
  if (!url) return false;
  return url.startsWith('https://') && url.includes('.supabase.co');
}

/**
 * Get Supabase client for authentication operations
 * Uses service role key for backend operations (bypasses RLS)
 */
export function getSupabaseAuthClient(): SupabaseClient | null {
  if (!isValidSupabaseUrl(SUPABASE_URL)) {
    console.warn('[Supabase Auth] Invalid or missing SUPABASE_URL');
    return null;
  }

  // For server-side auth operations, prefer service role key
  const key = SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY;
  
  if (!key) {
    console.warn('[Supabase Auth] Missing API key - auth disabled');
    return null;
  }

  if (!supabaseAuthClient) {
    supabaseAuthClient = createClient(SUPABASE_URL!, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });
    console.log('[Supabase Auth] Client initialized');
  }

  return supabaseAuthClient;
}

/**
 * Check if Supabase Auth is available
 */
export function isSupabaseAuthAvailable(): boolean {
  return isValidSupabaseUrl(SUPABASE_URL) && !!(SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY);
}

/**
 * Sign up a new user with Supabase Auth
 * This will automatically send a verification email
 */
export async function signUpWithSupabase(email: string, password: string, metadata?: { name?: string; role?: string }): Promise<{
  success: boolean;
  userId?: string;
  error?: string;
  needsEmailVerification?: boolean;
}> {
  const client = getSupabaseAuthClient();
  if (!client) {
    return { success: false, error: 'Supabase Auth not configured' };
  }

  try {
    // APP_URL must be set via environment variable - only use fallback in development
    const appUrl = process.env.APP_URL || (process.env.NODE_ENV !== 'production' ? 'http://localhost:5000' : '');
    
    if (!appUrl) {
      console.error('[Supabase Auth] ERROR: APP_URL is not set. Email verification redirects will fail.');
      return { success: false, error: 'APP_URL environment variable is required' };
    }
    
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${appUrl}/auth/callback`,
        data: metadata, // Store name/role in user metadata
      },
    });

    if (error) {
      console.error('[Supabase Auth] SignUp error:', error.message);
      
      // Handle specific errors
      if (error.message.includes('already registered')) {
        return { success: false, error: 'Пользователь уже зарегистрирован' };
      }
      
      return { success: false, error: error.message };
    }

    if (!data.user) {
      return { success: false, error: 'Failed to create user' };
    }

    console.log(`[Supabase Auth] User created: ${email}, id: ${data.user.id}`);

    // Check if email confirmation is required
    const needsEmailVerification = !data.user.email_confirmed_at;
    
    return {
      success: true,
      userId: data.user.id,
      needsEmailVerification,
    };
  } catch (err) {
    console.error('[Supabase Auth] SignUp exception:', err);
    return { success: false, error: 'Registration failed' };
  }
}

/**
 * Resend verification email via Supabase
 */
export async function resendVerificationEmail(email: string): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseAuthClient();
  if (!client) {
    return { success: false, error: 'Supabase Auth not configured' };
  }

  try {
    // APP_URL must be set via environment variable - only use fallback in development
    const appUrl = process.env.APP_URL || (process.env.NODE_ENV !== 'production' ? 'http://localhost:5000' : '');
    
    if (!appUrl) {
      console.error('[Supabase Auth] ERROR: APP_URL is not set for resend email.');
      return { success: false, error: 'APP_URL environment variable is required' };
    }
    
    const { error } = await client.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: `${appUrl}/auth/callback`,
      },
    });

    if (error) {
      console.error('[Supabase Auth] Resend error:', error.message);
      return { success: false, error: error.message };
    }

    console.log(`[Supabase Auth] Verification email resent to: ${email}`);
    return { success: true };
  } catch (err) {
    console.error('[Supabase Auth] Resend exception:', err);
    return { success: false, error: 'Failed to resend email' };
  }
}

/**
 * Verify user's email using token from URL
 */
export async function verifyEmailToken(token: string, type: string = 'signup'): Promise<{
  success: boolean;
  email?: string;
  error?: string;
}> {
  const client = getSupabaseAuthClient();
  if (!client) {
    return { success: false, error: 'Supabase Auth not configured' };
  }

  try {
    const { data, error } = await client.auth.verifyOtp({
      token_hash: token,
      type: type as any,
    });

    if (error) {
      console.error('[Supabase Auth] Verify error:', error.message);
      return { success: false, error: error.message };
    }

    console.log(`[Supabase Auth] Email verified for: ${data.user?.email}`);
    return {
      success: true,
      email: data.user?.email,
    };
  } catch (err) {
    console.error('[Supabase Auth] Verify exception:', err);
    return { success: false, error: 'Verification failed' };
  }
}

/**
 * Get user by email from Supabase Auth (admin operation)
 */
export async function getSupabaseUserByEmail(email: string): Promise<{
  id: string;
  email: string;
  emailConfirmed: boolean;
  metadata: any;
} | null> {
  const client = getSupabaseAuthClient();
  if (!client) return null;

  try {
    // Use admin API to list users (requires service role key)
    const { data, error } = await client.auth.admin.listUsers();
    
    if (error) {
      console.error('[Supabase Auth] List users error:', error.message);
      return null;
    }

    const user = data.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    if (!user) return null;

    return {
      id: user.id,
      email: user.email!,
      emailConfirmed: !!user.email_confirmed_at,
      metadata: user.user_metadata,
    };
  } catch (err) {
    console.error('[Supabase Auth] Get user error:', err);
    return null;
  }
}
