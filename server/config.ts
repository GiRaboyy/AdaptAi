/**
 * Environment Configuration Module
 * 
 * Validates and exports typed environment variables with Zod schema validation.
 * This ensures all required variables are present in both development and production.
 */

import { z } from 'zod';

// Server configuration schema
const serverConfigSchema = z.object({
  // Node environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('5000'),
  HOST: z.string().default('0.0.0.0'),
  
  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  
  // Supabase
  DATABASE_FILE_STORAGE_URL: z.string().url('DATABASE_FILE_STORAGE_URL must be valid URL'),
  DATABASE_FILE_STORAGE_KEY: z.string().min(1, 'DATABASE_FILE_STORAGE_KEY is required'),
  SUPABASE_ANON_KEY: z.string().min(1, 'SUPABASE_ANON_KEY is required'),
  
  // Session
  SESSION_SECRET: z.string().min(16, 'SESSION_SECRET must be at least 16 characters'),
  COOKIE_SECURE: z.string().optional().transform(val => val === 'true'),
  
  // Application
  APP_URL: z.string().url('APP_URL must be valid URL'),
  
  // AI Service (Yandex)
  YANDEX_CLOUD_API_KEY: z.string().min(1, 'YANDEX_CLOUD_API_KEY is required'),
  YANDEX_CLOUD_PROJECT_FOLDER_ID: z.string().min(1, 'YANDEX_CLOUD_PROJECT_FOLDER_ID is required'),
  YANDEX_CLOUD_BASE_URL: z.string().url().default('https://rest-assistant.api.cloud.yandex.net/v1'),
  YANDEX_PROMPT_ID: z.string().min(1, 'YANDEX_PROMPT_ID is required'),
  YANDEX_TIMEOUT_MS: z.string().default('90000'),
  
  // Email (SMTP)
  SMTP_HOST: z.string().min(1, 'SMTP_HOST is required'),
  SMTP_PORT: z.string().transform(val => parseInt(val, 10)),
  SMTP_USER: z.string().min(1, 'SMTP_USER is required'),
  SMTP_PASSWORD: z.string().min(1, 'SMTP_PASSWORD is required'),
  SMTP_FROM: z.string().email('SMTP_FROM must be valid email'),
  
  // Optional
  LOG_LEVEL: z.string().default('info'),
  LOG_PRETTY: z.string().optional().transform(val => val === 'true'),
  SHUTDOWN_TIMEOUT_MS: z.string().default('10000'),
  REQUEST_LOG_SAMPLE: z.string().default('1'),
  OWNER_TELEGRAM: z.string().optional(),
});

// Parse and validate environment variables
function loadConfig() {
  try {
    const config = serverConfigSchema.parse(process.env);
    return config;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('[Config] Environment validation failed:');
      error.errors.forEach(err => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
      throw new Error('Invalid environment configuration. Check environment variables.');
    }
    throw error;
  }
}

// Export validated config
export const config = loadConfig();

// Log configuration status (without sensitive values)
console.log('[Config] Environment loaded:', {
  NODE_ENV: config.NODE_ENV,
  PORT: config.PORT,
  DATABASE_CONNECTED: !!config.DATABASE_URL,
  SUPABASE_CONFIGURED: !!config.DATABASE_FILE_STORAGE_URL,
  SMTP_CONFIGURED: !!config.SMTP_HOST,
  AI_CONFIGURED: !!config.YANDEX_CLOUD_API_KEY,
});

// Type export for convenience
export type ServerConfig = z.infer<typeof serverConfigSchema>;
