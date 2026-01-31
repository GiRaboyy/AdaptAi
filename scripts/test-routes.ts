#!/usr/bin/env tsx
/**
 * Route Testing Script
 * Tests that all defined routes are accessible
 * Usage: npm run test:routes (with server running on PORT or 5000)
 */

import { config } from 'dotenv';
import { existsSync } from 'fs';
import { resolve } from 'path';

// Load .env file
const envPath = resolve(process.cwd(), '.env');
if (existsSync(envPath)) {
  config({ path: envPath });
}

const PORT = process.env.PORT || 5000;
const BASE_URL = `http://localhost:${PORT}`;

interface RouteTest {
  path: string;
  expectedStatus: number;
  requiresAuth?: boolean;
  description: string;
}

const routes: RouteTest[] = [
  { path: '/', expectedStatus: 200, description: 'Landing page' },
  { path: '/auth', expectedStatus: 200, description: 'Auth page' },
  { path: '/auth/callback', expectedStatus: 200, description: 'Auth callback' },
  { path: '/app/courses', expectedStatus: 200, requiresAuth: true, description: 'Employee courses' },
  { path: '/app/profile', expectedStatus: 200, requiresAuth: true, description: 'Employee profile' },
  { path: '/curator', expectedStatus: 200, requiresAuth: true, description: 'Curator library' },
  { path: '/curator/analytics', expectedStatus: 200, requiresAuth: true, description: 'Curator analytics' },
  { path: '/curator/profile', expectedStatus: 200, requiresAuth: true, description: 'Curator profile' },
  { path: '/invalid-route-404', expectedStatus: 404, description: '404 page' },
];

const apiRoutes: RouteTest[] = [
  { path: '/api/auth/me', expectedStatus: 401, description: 'User info (no auth)' },
  { path: '/api/tracks', expectedStatus: 401, description: 'Tracks list (no auth)' },
];

async function testRoute(route: RouteTest): Promise<{
  success: boolean;
  actualStatus?: number;
  error?: string;
}> {
  try {
    const response = await fetch(`${BASE_URL}${route.path}`, {
      method: 'GET',
      redirect: 'manual', // Don't follow redirects
    });
    
    const actualStatus = response.status;
    
    // For auth-required routes, 302/307 redirect to /auth is acceptable
    if (route.requiresAuth && (actualStatus === 302 || actualStatus === 307)) {
      return { success: true, actualStatus };
    }
    
    // Check if status matches expected
    const success = actualStatus === route.expectedStatus;
    
    return { success, actualStatus };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || String(error),
    };
  }
}

async function runTests() {
  console.log('\n========================================');
  console.log('        ROUTE TESTING');
  console.log('========================================');
  console.log(`Testing server at: ${BASE_URL}\n`);
  
  // Check if server is running
  try {
    await fetch(BASE_URL);
  } catch (error) {
    console.log('\x1b[31m✗\x1b[0m Server is not running!');
    console.log('\n  Start the server first:');
    console.log('    npm run dev\n');
    process.exit(1);
  }
  
  let passedCount = 0;
  let failedCount = 0;
  
  console.log('Frontend Routes:\n');
  
  for (const route of routes) {
    const result = await testRoute(route);
    
    if (result.success) {
      console.log(`\x1b[32m✓\x1b[0m ${route.path.padEnd(30)} ${route.description}`);
      if (route.requiresAuth && (result.actualStatus === 302 || result.actualStatus === 307)) {
        console.log(`  → Redirects to auth (expected)`);
      }
      passedCount++;
    } else {
      console.log(`\x1b[31m✗\x1b[0m ${route.path.padEnd(30)} ${route.description}`);
      if (result.actualStatus) {
        console.log(`  → Expected ${route.expectedStatus}, got ${result.actualStatus}`);
      } else if (result.error) {
        console.log(`  → Error: ${result.error}`);
      }
      failedCount++;
    }
  }
  
  console.log('\nAPI Routes:\n');
  
  for (const route of apiRoutes) {
    const result = await testRoute(route);
    
    if (result.success) {
      console.log(`\x1b[32m✓\x1b[0m ${route.path.padEnd(30)} ${route.description}`);
      passedCount++;
    } else {
      console.log(`\x1b[31m✗\x1b[0m ${route.path.padEnd(30)} ${route.description}`);
      if (result.actualStatus) {
        console.log(`  → Expected ${route.expectedStatus}, got ${result.actualStatus}`);
      } else if (result.error) {
        console.log(`  → Error: ${result.error}`);
      }
      failedCount++;
    }
  }
  
  console.log('\n========================================');
  console.log(`Passed: ${passedCount}/${passedCount + failedCount}`);
  console.log(`Failed: ${failedCount}/${passedCount + failedCount}`);
  console.log('========================================\n');
  
  if (failedCount > 0) {
    console.log('Some routes failed. Check your application routing.\n');
    process.exit(1);
  } else {
    console.log('All routes are working correctly!\n');
    process.exit(0);
  }
}

runTests().catch((error) => {
  console.error('Test script error:', error);
  process.exit(1);
});
