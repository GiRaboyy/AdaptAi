/**
 * Environment Configuration & Validation Module
 * 
 * This module provides:
 * 1. Zod-based validation of all environment variables
 * 2. Production-specific requirements (no fallbacks in production)
 * 3. Clear error messages for missing/invalid variables
 * 4. Service availability detection
 * 5. Startup logging without exposing sensitive values
 * 
 * IMPORTANT: All server code should import config from this module
 * instead of accessing process.env directly.
 */

import { z } from 'zod';

// =============================================================================
// Environment Detection
// =============================================================================

export const isProduction = 
  process.env.NODE_ENV === 'production' || 
  process.env.VERCEL === '1' ||
  process.env.VERCEL === 'true';

export const isDevelopment = !isProduction;

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Creates a schema that requires a value in production but allows fallback in dev
 */
function requiredInProduction<T extends z.ZodTypeAny>(
  schema: T,
  devFallback: z.infer<T>,
  envName: string
): z.ZodEffects<T, z.infer<T>, unknown> {
  return schema.transform((val) => {
    if (val === undefined || val === null || val === '') {
      if (isProduction) {
        throw new Error(
          `FATAL: ${envName} is required in production. ` +
          `Set it in Vercel Dashboard → Settings → Environment Variables.`
        );
      }
      console.warn(`[Env] Using development fallback for ${envName}`);
      return devFallback;
    }
    return val;
  }) as z.ZodEffects<T, z.infer<T>, unknown>;
}

/**
 * Creates a schema for optional services that can be disabled
 */
function optionalService<T extends z.ZodTypeAny>(
  schema: T,
  serviceName: string
): z.ZodOptional<T> {
  return schema.optional();
}

// =============================================================================
// Core Environment Schema (Always Required)
// =============================================================================

const coreSchema = z.object({
  // Node environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // Server binding
  PORT: z.string().default('5000').transform(val => parseInt(val, 10)),
  HOST: z.string().default('0.0.0.0'),
  
  // Database - ALWAYS required
  DATABASE_URL: z.string().min(1, {
    message: 'DATABASE_URL is required. Set your PostgreSQL connection string.'
  }),
});

// =============================================================================
// Session Security Schema
// =============================================================================

const sessionSchema = z.object({
  // Session secret - production requires strong secret
  SESSION_SECRET: z.string().optional().transform((val) => {
    if (!val || val === '') {
      if (isProduction) {
        throw new Error(
          'FATAL: SESSION_SECRET is required in production. ' +
          'Generate with: openssl rand -base64 32 ' +
          'Then set in Vercel Dashboard → Settings → Environment Variables.'
        );
      }
      console.warn('[Env] WARNING: Using insecure dev-only session secret. Never use in production!');
      return 'dev_only_insecure_secret_32chars';
    }
    if (isProduction && val.length < 32) {
      throw new Error(
        'FATAL: SESSION_SECRET must be at least 32 characters in production for security.'
      );
    }
    return val;
  }),
  
  // Cookie security - must be true in production HTTPS
  COOKIE_SECURE: z.string().optional().transform(val => {
    if (isProduction) {
      // In production, default to secure=true unless explicitly disabled
      return val !== 'false';
    }
    // In development, default to false
    return val === 'true';
  }),
});

// =============================================================================
// Supabase Configuration Schema
// =============================================================================

const supabaseSchema = z.object({
  // Supabase Project URL (for Storage and Auth)
  DATABASE_FILE_STORAGE_URL: z.string().optional().transform((val) => {
    if (!val || val === '') {
      console.warn('[Env] DATABASE_FILE_STORAGE_URL not set - Supabase Storage disabled');
      return undefined;
    }
    if (!val.startsWith('https://') || !val.includes('.supabase.co')) {
      throw new Error(
        'DATABASE_FILE_STORAGE_URL must be a valid Supabase project URL ' +
        '(e.g., https://your-project.supabase.co)'
      );
    }
    return val;
  }),
  
  // Supabase Service Role Key (for server-side operations)
  DATABASE_FILE_STORAGE_KEY: z.string().optional().transform((val) => {
    if (!val || val === '') {
      console.warn('[Env] DATABASE_FILE_STORAGE_KEY not set - Supabase Storage operations limited');
      return undefined;
    }
    return val;
  }),
  
  // Supabase Anon Key (for JWT validation)
  SUPABASE_ANON_KEY: z.string().optional().transform((val) => {
    if (!val || val === '') {
      console.warn('[Env] SUPABASE_ANON_KEY not set - JWT authentication disabled');
      return undefined;
    }
    return val;
  }),
});

// =============================================================================
// Application URLs Schema
// =============================================================================

const appUrlSchema = z.object({
  // Application URL for email links
  APP_URL: z.string().optional().transform((val) => {
    if (!val || val === '') {
      if (isProduction) {
        throw new Error(
          'FATAL: APP_URL is required in production for email verification links. ' +
          'Set to your production domain (e.g., https://your-app.vercel.app)'
        );
      }
      return 'http://localhost:5000';
    }
    // Warn about localhost in production
    if (isProduction && val.includes('localhost')) {
      throw new Error(
        'FATAL: APP_URL cannot use localhost in production. ' +
        'Set to your production domain (e.g., https://your-app.vercel.app)'
      );
    }
    return val;
  }),
});

// =============================================================================
// AI Service (Yandex) Schema
// =============================================================================

const yandexSchema = z.object({
  YANDEX_CLOUD_API_KEY: z.string().optional().transform((val) => {
    if (!val || val === '') {
      console.warn('[Env] YANDEX_CLOUD_API_KEY not set - AI course generation disabled');
      return undefined;
    }
    return val;
  }),
  
  YANDEX_CLOUD_PROJECT_FOLDER_ID: z.string().optional().transform((val) => {
    if (!val || val === '') {
      console.warn('[Env] YANDEX_CLOUD_PROJECT_FOLDER_ID not set - AI features disabled');
      return undefined;
    }
    return val;
  }),
  
  YANDEX_CLOUD_BASE_URL: z.string().url().default('https://rest-assistant.api.cloud.yandex.net/v1'),
  
  YANDEX_PROMPT_ID: z.string().optional().transform((val) => {
    if (!val || val === '') {
      console.warn('[Env] YANDEX_PROMPT_ID not set - AI features disabled');
      return undefined;
    }
    return val;
  }),
  
  YANDEX_TIMEOUT_MS: z.string().default('90000').transform(val => parseInt(val, 10)),
});

// =============================================================================
// Email (SMTP) Schema
// =============================================================================

const smtpSchema = z.object({
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional().transform(val => val ? parseInt(val, 10) : undefined),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().optional(),
});

// =============================================================================
// Logging & Debug Schema
// =============================================================================

const loggingSchema = z.object({
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  LOG_PRETTY: z.string().optional().transform(val => val === 'true'),
  REQUEST_LOG_SAMPLE: z.string().default('1').transform(val => parseFloat(val)),
  SHUTDOWN_TIMEOUT_MS: z.string().default('10000').transform(val => parseInt(val, 10)),
});

// =============================================================================
// Optional Configuration Schema
// =============================================================================

const optionalSchema = z.object({
  OWNER_TELEGRAM: z.string().optional(),
});

// =============================================================================
// Combined Schema
// =============================================================================

const envSchema = coreSchema
  .merge(sessionSchema)
  .merge(supabaseSchema)
  .merge(appUrlSchema)
  .merge(yandexSchema)
  .merge(smtpSchema)
  .merge(loggingSchema)
  .merge(optionalSchema);

// =============================================================================
// Validation & Export
// =============================================================================

export type Env = z.infer<typeof envSchema>;

let _env: Env | null = null;

/**
 * Validates and returns environment configuration.
 * Throws detailed errors for missing/invalid required variables.
 */
export function validateEnv(): Env {
  if (_env) return _env;
  
  console.log('[Env] Validating environment configuration...');
  console.log(`[Env] Mode: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
  
  try {
    _env = envSchema.parse(process.env);
    return _env;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('\n========================================');
      console.error('ENVIRONMENT CONFIGURATION ERROR');
      console.error('========================================\n');
      
      error.errors.forEach(err => {
        const path = err.path.join('.');
        console.error(`❌ ${path}: ${err.message}`);
      });
      
      console.error('\n----------------------------------------');
      console.error('How to fix:');
      console.error('1. Check your .env file (local) or Vercel Environment Variables');
      console.error('2. Ensure all required variables are set');
      console.error('3. Refer to .env.example for correct format');
      console.error('----------------------------------------\n');
      
      throw new Error('Environment validation failed. See errors above.');
    }
    throw error;
  }
}

/**
 * Get validated environment config (lazy-loads on first call)
 */
export function getEnv(): Env {
  return _env || validateEnv();
}

// =============================================================================
// Service Availability Checks
// =============================================================================

export interface ServiceStatus {
  database: boolean;
  supabaseStorage: boolean;
  supabaseAuth: boolean;
  email: boolean;
  ai: boolean;
}

/**
 * Check which services are properly configured
 */
export function getServiceStatus(): ServiceStatus {
  const env = getEnv();
  
  return {
    database: !!env.DATABASE_URL,
    supabaseStorage: !!(env.DATABASE_FILE_STORAGE_URL && env.DATABASE_FILE_STORAGE_KEY),
    supabaseAuth: !!(env.DATABASE_FILE_STORAGE_URL && env.SUPABASE_ANON_KEY),
    email: !!(env.SMTP_HOST && env.SMTP_PORT && env.SMTP_USER && env.SMTP_PASSWORD),
    ai: !!(env.YANDEX_CLOUD_API_KEY && env.YANDEX_CLOUD_PROJECT_FOLDER_ID && env.YANDEX_PROMPT_ID),
  };
}

/**
 * Log service configuration status (safe - no secrets exposed)
 */
export function logServiceStatus(): void {
  const env = getEnv();
  const services = getServiceStatus();
  
  console.log('\n========================================');
  console.log('SERVICE CONFIGURATION STATUS');
  console.log('========================================');
  console.log(`Environment: ${env.NODE_ENV}`);
  console.log(`Server: ${env.HOST}:${env.PORT}`);
  console.log('----------------------------------------');
  console.log(`Database:         ${services.database ? '✅ Connected' : '❌ Not configured'}`);
  console.log(`Supabase Storage: ${services.supabaseStorage ? '✅ Enabled' : '⚠️  Disabled (files stored in DB)'}`);
  console.log(`Supabase Auth:    ${services.supabaseAuth ? '✅ Enabled' : '⚠️  Disabled (using session auth)'}`);
  console.log(`Email (SMTP):     ${services.email ? '✅ Configured' : '⚠️  Disabled (verification limited)'}`);
  console.log(`AI (Yandex):      ${services.ai ? '✅ Configured' : '⚠️  Disabled (course gen unavailable)'}`);
  console.log('========================================\n');
  
  // Production warnings
  if (isProduction) {
    if (!services.email) {
      console.warn('⚠️  WARNING: Email not configured in production. Users cannot verify emails!');
    }
    if (!services.ai) {
      console.warn('⚠️  WARNING: AI not configured in production. Course generation disabled!');
    }
  }
}

// =============================================================================
// Convenience Getters (for cleaner imports)
// =============================================================================

/** Get database URL (always available after validation) */
export function getDatabaseUrl(): string {
  return getEnv().DATABASE_URL;
}

/** Get session secret (always available after validation) */
export function getSessionSecret(): string {
  return getEnv().SESSION_SECRET;
}

/** Get app URL (always available after validation) */
export function getAppUrl(): string {
  return getEnv().APP_URL;
}

/** Check if secure cookies should be used */
export function useSecureCookies(): boolean {
  return getEnv().COOKIE_SECURE;
}

/** Get Yandex config if available */
export function getYandexConfig() {
  const env = getEnv();
  if (!env.YANDEX_CLOUD_API_KEY || !env.YANDEX_CLOUD_PROJECT_FOLDER_ID) {
    return null;
  }
  return {
    apiKey: env.YANDEX_CLOUD_API_KEY,
    projectFolderId: env.YANDEX_CLOUD_PROJECT_FOLDER_ID,
    baseUrl: env.YANDEX_CLOUD_BASE_URL,
    promptId: env.YANDEX_PROMPT_ID,
    timeoutMs: env.YANDEX_TIMEOUT_MS,
  };
}

/** Get SMTP config if available */
export function getSmtpConfig() {
  const env = getEnv();
  if (!env.SMTP_HOST || !env.SMTP_PORT || !env.SMTP_USER || !env.SMTP_PASSWORD) {
    return null;
  }
  return {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    user: env.SMTP_USER,
    password: env.SMTP_PASSWORD,
    from: env.SMTP_FROM,
  };
}

/** Get Supabase config if available */
export function getSupabaseConfig() {
  const env = getEnv();
  if (!env.DATABASE_FILE_STORAGE_URL) {
    return null;
  }
  return {
    url: env.DATABASE_FILE_STORAGE_URL,
    serviceKey: env.DATABASE_FILE_STORAGE_KEY,
    anonKey: env.SUPABASE_ANON_KEY,
  };
}
