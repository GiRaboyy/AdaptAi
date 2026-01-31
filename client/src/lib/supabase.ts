import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Frontend Supabase client configuration
// Uses VITE_ prefixed environment variables (exposed to client)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

let supabaseClient: SupabaseClient | null = null;

/**
 * Get Supabase client for frontend auth operations
 * Used for handling email verification callbacks
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn('[Supabase] Missing configuration');
    return null;
  }

  if (!supabaseClient) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: true,
        persistSession: false, // We use our own session management
        detectSessionInUrl: false, // We handle this manually in callback page
      },
    });
  }

  return supabaseClient;
}

/**
 * Check if Supabase is configured for frontend
 */
export function isSupabaseConfigured(): boolean {
  return !!(SUPABASE_URL && SUPABASE_ANON_KEY);
}

/**
 * Parse hash fragment from URL (Supabase sends tokens in hash)
 * Format: #access_token=...&refresh_token=...&expires_in=...&token_type=bearer&type=signup
 */
export function parseHashParams(hash: string): Record<string, string> {
  if (!hash || !hash.startsWith('#')) return {};
  
  const params: Record<string, string> = {};
  const hashContent = hash.substring(1); // Remove leading #
  
  hashContent.split('&').forEach(param => {
    const [key, value] = param.split('=');
    if (key && value) {
      params[key] = decodeURIComponent(value);
    }
  });
  
  return params;
}

/**
 * Parse query params for code flow
 * Format: ?code=...
 */
export function parseQueryParams(search: string): Record<string, string> {
  if (!search || !search.startsWith('?')) return {};
  
  const params: Record<string, string> = {};
  const searchParams = new URLSearchParams(search);
  
  searchParams.forEach((value, key) => {
    params[key] = value;
  });
  
  return params;
}

/**
 * Set session from tokens (hash fragment flow)
 * IMPORTANT: Never log tokens!
 */
export async function setSessionFromTokens(
  accessToken: string,
  refreshToken: string
): Promise<{ success: boolean; email?: string; error?: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, error: 'Supabase не настроен' };
  }

  try {
    const { data, error } = await client.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      email: data.user?.email,
    };
  } catch (err) {
    return { success: false, error: 'Ошибка установки сессии' };
  }
}

/**
 * Exchange code for session (PKCE code flow)
 * IMPORTANT: Never log the code!
 */
export async function exchangeCodeForSession(
  code: string
): Promise<{ success: boolean; email?: string; error?: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, error: 'Supabase не настроен' };
  }

  try {
    const { data, error } = await client.auth.exchangeCodeForSession(code);

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      email: data.user?.email,
    };
  } catch (err) {
    return { success: false, error: 'Ошибка обмена кода' };
  }
}

/**
 * Mask sensitive data for safe logging
 * Shows first 4 and last 4 characters only
 */
export function maskToken(token: string): string {
  if (!token || token.length < 12) return '***';
  return `${token.substring(0, 4)}...${token.substring(token.length - 4)}`;
}

/**
 * Get authorization headers for API requests
 * Automatically includes the access token from current Supabase session
 */
export async function getAuthHeaders(): Promise<HeadersInit> {
  const client = getSupabaseClient();
  if (!client) {
    return {};
  }

  try {
    const { data: { session } } = await client.auth.getSession();
    
    if (session?.access_token) {
      return {
        'Authorization': `Bearer ${session.access_token}`,
      };
    }
  } catch (err) {
    console.warn('[Supabase] Failed to get auth headers:', err);
  }

  return {};
}

/**
 * Make authenticated API request
 * Automatically adds authorization headers
 */
export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const authHeaders = await getAuthHeaders();
  
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
      ...authHeaders,
    },
  });
}
