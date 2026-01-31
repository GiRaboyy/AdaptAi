#!/usr/bin/env tsx
/**
 * Test script for email configuration
 * 
 * Usage:
 *   tsx test-email-config.ts
 * 
 * This script tests:
 * 1. SMTP configuration validation
 * 2. Email transporter initialization
 * 3. Port-specific behavior (465 SSL vs 587 STARTTLS)
 */

import { testEmailConnection } from './server/email.js';

console.log('=== Email Configuration Test ===\n');

// Check environment variables
const requiredVars = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD'];
const missingVars = requiredVars.filter(v => !process.env[v]);

if (missingVars.length > 0) {
  console.log('⚠️  SMTP not fully configured (this is OK if using Supabase only)');
  console.log('   Missing variables:', missingVars.join(', '));
  console.log('\nTo test SMTP, set these environment variables:');
  console.log('  SMTP_HOST=smtp.yandex.ru');
  console.log('  SMTP_PORT=465');
  console.log('  SMTP_USER=adapt-ai@yandex.com');
  console.log('  SMTP_PASSWORD=your_app_password_here');
  console.log('\nSkipping SMTP connection test.');
  process.exit(0);
}

console.log('✓ SMTP environment variables configured');
console.log(`  Host: ${process.env.SMTP_HOST}`);
console.log(`  Port: ${process.env.SMTP_PORT}`);
console.log(`  User: ${process.env.SMTP_USER}`);
console.log(`  From: ${process.env.SMTP_FROM || `ADAPT <${process.env.SMTP_USER}>`}`);

const port = parseInt(process.env.SMTP_PORT || '465', 10);
const connectionType = port === 465 ? 'SSL (direct)' : 'STARTTLS (upgrade)';
console.log(`  Connection: ${connectionType}\n`);

console.log('Testing SMTP connection...');

testEmailConnection()
  .then(success => {
    if (success) {
      console.log('\n✅ SMTP connection test PASSED');
      console.log('   Email sending is configured and ready.');
    } else {
      console.log('\n❌ SMTP connection test FAILED');
      console.log('   Check your credentials and network connection.');
      console.log('\nTroubleshooting:');
      console.log('  1. Verify you are using APP PASSWORD from https://id.yandex.ru/security');
      console.log('  2. Check if port 465 is blocked by firewall (try port 587)');
      console.log('  3. Ensure SMTP_USER matches the from address');
      process.exit(1);
    }
  })
  .catch(err => {
    console.error('\n❌ SMTP connection test ERROR:', err);
    process.exit(1);
  });
