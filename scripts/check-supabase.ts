#!/usr/bin/env tsx
/**
 * Supabase Integration Verification Script
 * Checks Supabase connection and configuration
 * Usage: npm run check:supabase
 */

import { config } from 'dotenv';
import { existsSync } from 'fs';
import { resolve } from 'path';

// Load .env file
const envPath = resolve(process.cwd(), '.env');
if (existsSync(envPath)) {
  config({ path: envPath });
}

interface CheckResult {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
}

const results: CheckResult[] = [];

function addResult(name: string, status: 'pass' | 'fail' | 'warn', message: string) {
  results.push({ name, status, message });
}

// Check 1: Environment Variables
console.log('\nChecking environment variables...\n');

const requiredVars = [
  'DATABASE_URL',
  'SUPABASE_ANON_KEY',
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
];

for (const varName of requiredVars) {
  const value = process.env[varName];
  if (value) {
    const masked = value.includes('supabase.co') 
      ? value
      : `${value.substring(0, 6)}...${value.substring(value.length - 4)}`;
    addResult(varName, 'pass', `Set: ${masked}`);
  } else {
    addResult(varName, 'fail', 'Not set');
  }
}

// Check 2: Supabase URL Format
if (process.env.VITE_SUPABASE_URL) {
  const url = process.env.VITE_SUPABASE_URL;
  if (url.includes('supabase.co')) {
    addResult('Supabase URL Format', 'pass', `Valid: ${url}`);
  } else {
    addResult('Supabase URL Format', 'warn', 'URL does not appear to be a Supabase domain');
  }
} else {
  addResult('Supabase URL Format', 'fail', 'VITE_SUPABASE_URL not set');
}

// Check 3: Database URL Format
if (process.env.DATABASE_URL) {
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://')) {
    addResult('Database URL Format', 'pass', 'Valid PostgreSQL URL');
  } else {
    addResult('Database URL Format', 'warn', 'URL format may be incorrect');
  }
} else {
  addResult('Database URL Format', 'fail', 'DATABASE_URL not set');
}

// Check 4: Storage Configuration (Optional)
const storageUrl = process.env.DATABASE_FILE_STORAGE_URL;
const storageKey = process.env.DATABASE_FILE_STORAGE_KEY;

if (storageUrl && storageKey) {
  addResult('Supabase Storage', 'pass', 'Storage configured');
} else {
  addResult('Supabase Storage', 'warn', 'Storage not configured (optional)');
}

// Check 5: APP_URL Configuration
const appUrl = process.env.APP_URL;
const viteAppUrl = process.env.VITE_APP_URL;

if (appUrl && viteAppUrl) {
  if (appUrl === viteAppUrl) {
    addResult('APP URLs Match', 'pass', `Both set to: ${appUrl}`);
  } else {
    addResult('APP URLs Match', 'warn', `APP_URL and VITE_APP_URL differ`);
  }
  
  if (appUrl.includes('localhost') && process.env.NODE_ENV === 'production') {
    addResult('Production APP_URL', 'fail', 'Using localhost in production!');
  } else if (!appUrl.includes('localhost')) {
    addResult('Production APP_URL', 'pass', `Using production domain: ${appUrl}`);
  } else {
    addResult('Development APP_URL', 'pass', `Using localhost for development`);
  }
} else {
  addResult('APP URLs', 'fail', 'APP_URL and/or VITE_APP_URL not set');
}

// Print Results
console.log('\n========================================');
console.log('   SUPABASE INTEGRATION CHECK');
console.log('========================================\n');

let hasErrors = false;
let hasWarnings = false;

for (const result of results) {
  const symbol = result.status === 'pass' ? '✓' : result.status === 'warn' ? '⚠' : '✗';
  const color = result.status === 'pass' ? '\x1b[32m' : result.status === 'warn' ? '\x1b[33m' : '\x1b[31m';
  const reset = '\x1b[0m';
  
  console.log(`${color}${symbol}${reset} ${result.name.padEnd(30)} ${result.message}`);
  
  if (result.status === 'fail') hasErrors = true;
  if (result.status === 'warn') hasWarnings = true;
}

console.log('\n========================================');

if (hasErrors) {
  console.log('✗ Some required checks failed');
  console.log('========================================\n');
  console.log('Action Required:');
  console.log('1. Check your .env file');
  console.log('2. Ensure all REQUIRED variables are set');
  console.log('3. Verify Supabase project configuration\n');
  console.log('For Supabase setup:');
  console.log('- Go to https://supabase.com/dashboard');
  console.log('- Select your project');
  console.log('- Go to Settings → API');
  console.log('- Copy Project URL and anon key\n');
  process.exit(1);
} else if (hasWarnings) {
  console.log('⚠ All required checks passed, but there are warnings');
  console.log('========================================\n');
  console.log('Review the warnings above to ensure optimal configuration.\n');
  process.exit(0);
} else {
  console.log('✓ All checks passed! Supabase is properly configured');
  console.log('========================================\n');
  process.exit(0);
}
