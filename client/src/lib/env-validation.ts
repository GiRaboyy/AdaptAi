/**
 * Environment variables validation for client-side
 * Vite only exposes variables with VITE_ prefix
 */

interface ClientEnv {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
  VITE_APP_URL?: string;
}

interface ValidationResult {
  isValid: boolean;
  missing: string[];
  warnings: string[];
}

/**
 * Required environment variables for the app to function
 */
const REQUIRED_ENV_VARS = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
] as const;

/**
 * Optional but recommended environment variables
 */
const OPTIONAL_ENV_VARS = [
  'VITE_APP_URL',
] as const;

/**
 * Validate client-side environment variables
 * Returns validation result with missing/warning lists
 */
export function validateClientEnv(): ValidationResult {
  const env = import.meta.env as ClientEnv;
  const missing: string[] = [];
  const warnings: string[] = [];

  // Check required variables
  for (const key of REQUIRED_ENV_VARS) {
    if (!env[key]) {
      missing.push(key);
    }
  }

  // Check optional variables
  for (const key of OPTIONAL_ENV_VARS) {
    if (!env[key]) {
      warnings.push(key);
    }
  }

  return {
    isValid: missing.length === 0,
    missing,
    warnings,
  };
}

/**
 * Get environment variable with fallback
 * Never exposes the actual value in error messages
 */
export function getEnv(key: keyof ClientEnv, fallback?: string): string {
  const value = import.meta.env[key];
  
  if (!value && !fallback) {
    console.error(`[ENV] Missing required environment variable: ${key}`);
    return '';
  }
  
  return value || fallback || '';
}

/**
 * Check if we're in production environment
 */
export function isProduction(): boolean {
  return import.meta.env.PROD;
}

/**
 * Check if we're in development environment
 */
export function isDevelopment(): boolean {
  return import.meta.env.DEV;
}

/**
 * Log environment validation errors (safe for production)
 * Never logs actual values, only missing keys
 */
export function logEnvValidation(): void {
  const result = validateClientEnv();
  
  if (!result.isValid) {
    console.error(
      '[ENV] Missing required environment variables:',
      result.missing.join(', ')
    );
    console.error(
      '[ENV] Please add these variables in Vercel Project Settings → Environment Variables'
    );
  }
  
  if (result.warnings.length > 0 && isDevelopment()) {
    console.warn(
      '[ENV] Optional environment variables not set:',
      result.warnings.join(', ')
    );
  }
  
  if (result.isValid && isDevelopment()) {
    console.log('[ENV] ✓ All required environment variables are set');
  }
}

/**
 * Get current app URL (for redirects, email links, etc.)
 * Falls back to window.location.origin if not set
 */
export function getAppUrl(): string {
  return getEnv('VITE_APP_URL', typeof window !== 'undefined' ? window.location.origin : '');
}
