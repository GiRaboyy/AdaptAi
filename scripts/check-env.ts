#!/usr/bin/env tsx
/**
 * Environment Variable Validation Script
 * Run this to check if all required environment variables are set
 * Usage: npm run check:env
 */

import { config } from 'dotenv';
import { existsSync } from 'fs';
import { resolve } from 'path';

// Load .env file
const envPath = resolve(process.cwd(), '.env');
if (existsSync(envPath)) {
  config({ path: envPath });
  console.log(`Loaded environment from: ${envPath}`);
} else {
  console.warn(`No .env file found at: ${envPath}`);
  console.log('Using system environment variables only');
}

interface EnvCheck {
  name: string;
  required: boolean;
  category: string;
  defaultValue?: string;
}

const ENV_CHECKS: EnvCheck[] = [
  // Database
  { name: 'DATABASE_URL', required: true, category: 'Database' },
  
  // Supabase Storage
  { name: 'DATABASE_FILE_STORAGE_URL', required: false, category: 'Supabase Storage (Optional)' },
  { name: 'DATABASE_FILE_STORAGE_KEY', required: false, category: 'Supabase Storage (Optional)' },
  
  // Supabase Auth
  { name: 'SUPABASE_ANON_KEY', required: true, category: 'Supabase Auth' },
  { name: 'VITE_SUPABASE_URL', required: true, category: 'Supabase Auth (Frontend)' },
  { name: 'VITE_SUPABASE_ANON_KEY', required: true, category: 'Supabase Auth (Frontend)' },
  
  // Session
  { name: 'SESSION_SECRET', required: true, category: 'Security' },
  { name: 'COOKIE_SECURE', required: false, category: 'Security', defaultValue: 'false' },
  
  // Application URLs
  { name: 'APP_URL', required: true, category: 'Application URLs' },
  { name: 'VITE_APP_URL', required: true, category: 'Application URLs' },
  
  // AI Integration
  { name: 'YANDEX_CLOUD_API_KEY', required: false, category: 'AI (Optional)' },
  { name: 'YANDEX_CLOUD_PROJECT_FOLDER_ID', required: false, category: 'AI (Optional)' },
  { name: 'YANDEX_PROMPT_ID', required: false, category: 'AI (Optional)' },
  
  // SMTP
  { name: 'SMTP_HOST', required: true, category: 'Email' },
  { name: 'SMTP_PORT', required: true, category: 'Email' },
  { name: 'SMTP_USER', required: true, category: 'Email' },
  { name: 'SMTP_PASSWORD', required: true, category: 'Email' },
  { name: 'SMTP_FROM', required: true, category: 'Email' },
  
  // Application Config
  { name: 'NODE_ENV', required: false, category: 'Application', defaultValue: 'development' },
  { name: 'PORT', required: false, category: 'Application', defaultValue: '5000' },
];

interface ValidationResult {
  category: string;
  checks: {
    name: string;
    status: 'OK' | 'MISSING' | 'DEFAULT';
    value?: string;
    required: boolean;
  }[];
}

function validateEnvironment(): { results: ValidationResult[]; isValid: boolean } {
  const categoryMap = new Map<string, ValidationResult>();
  
  for (const check of ENV_CHECKS) {
    if (!categoryMap.has(check.category)) {
      categoryMap.set(check.category, {
        category: check.category,
        checks: []
      });
    }
    
    const value = process.env[check.name];
    const categoryResult = categoryMap.get(check.category)!;
    
    if (value) {
      // Mask sensitive values
      const isSensitive = check.name.includes('KEY') || 
                         check.name.includes('SECRET') || 
                         check.name.includes('PASSWORD');
      const displayValue = isSensitive ? `${value.substring(0, 4)}...${value.substring(value.length - 4)}` : value;
      
      categoryResult.checks.push({
        name: check.name,
        status: 'OK',
        value: displayValue,
        required: check.required
      });
    } else if (check.defaultValue) {
      categoryResult.checks.push({
        name: check.name,
        status: 'DEFAULT',
        value: check.defaultValue,
        required: check.required
      });
    } else {
      categoryResult.checks.push({
        name: check.name,
        status: 'MISSING',
        required: check.required
      });
    }
  }
  
  const results = Array.from(categoryMap.values());
  const isValid = !results.some(r => 
    r.checks.some(c => c.status === 'MISSING' && c.required)
  );
  
  return { results, isValid };
}

function printResults(results: ValidationResult[], isValid: boolean) {
  console.log('\n========================================');
  console.log('   ENVIRONMENT VALIDATION REPORT');
  console.log('========================================\n');
  
  for (const category of results) {
    console.log(`\n[${category.category}]`);
    console.log('-'.repeat(50));
    
    for (const check of category.checks) {
      const requiredTag = check.required ? '(Required)' : '(Optional)';
      const statusSymbol = check.status === 'OK' ? '✓' : 
                          check.status === 'DEFAULT' ? '○' : 
                          check.required ? '✗' : '○';
      
      const statusColor = check.status === 'OK' ? '\x1b[32m' : 
                         check.status === 'MISSING' && check.required ? '\x1b[31m' : 
                         '\x1b[33m';
      const resetColor = '\x1b[0m';
      
      console.log(`  ${statusColor}${statusSymbol}${resetColor} ${check.name.padEnd(35)} ${requiredTag.padEnd(12)} ${check.value || (check.status === 'MISSING' ? 'NOT SET' : '')}`);
    }
  }
  
  console.log('\n========================================');
  if (isValid) {
    console.log('✓ All required environment variables are set');
    console.log('========================================\n');
    process.exit(0);
  } else {
    console.log('✗ Some required environment variables are missing');
    console.log('========================================\n');
    console.log('Action Required:');
    console.log('1. Copy .env.example to .env');
    console.log('2. Fill in all required values');
    console.log('3. Run this script again\n');
    process.exit(1);
  }
}

// Run validation
const { results, isValid } = validateEnvironment();
printResults(results, isValid);
