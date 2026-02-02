/**
 * Vercel Serverless Function: API Handler
 * 
 * This catch-all route forwards all `/api/**` requests to the Express application.
 * The Express app is instantiated once per serverless function instance (module-level singleton)
 * to optimize cold start performance.
 * 
 * Routes handled:
 * - /api/health
 * - /api/login
 * - /api/register
 * - /api/tracks/*
 * - And all other API routes defined in server/routes.ts
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { Express } from "express";

// Dynamic import for development vs production
let appPromise: Promise<Express> | null = null;

async function getApp(): Promise<Express> {
  if (!appPromise) {
    appPromise = (async () => {
      try {
        // In production (Vercel), import from compiled bundle (copied to api folder)
        if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
          console.log('[Vercel Function] Loading from compiled bundle...');
          
          // Verify bundle exists before importing
          try {
            // Dynamic import of compiled CJS bundle - type checking disabled as format varies between dev/prod
            // @ts-ignore - CJS bundle structure not known at compile time
            const mod = await import('./server-app.cjs');
            // @ts-ignore - Accessing createApp from CJS module
            const createApp = (mod as any).createApp || (mod as any).default?.createApp;
            if (!createApp || typeof createApp !== 'function') {
              throw new Error('server-app.cjs missing createApp export');
            }
            console.log('[Vercel Function] ✅ Bundle loaded successfully');
            return await createApp();
          } catch (importErr) {
            console.error('[Vercel Function] ❌ Bundle import failed:', importErr);
            console.error('[Vercel Function] Attempted path: ./server-app.cjs');
            console.error('[Vercel Function] CWD:', process.cwd());
            throw new Error(`Failed to load server bundle: ${importErr}`);
          }
        } else {
          // In development, import TypeScript source
          console.log('[Vercel Function] Loading from TypeScript source...');
          const { createApp } = await import('../server/app');
          return await createApp();
        }
      } catch (err) {
        console.error('[Vercel Function] Fatal error during app initialization:', err);
        throw err;
      }
    })();
  }
  return appPromise;
}

/**
 * Vercel serverless function handler
 * Forwards all requests to the Express application
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const startTime = Date.now();
  const method = req.method || 'UNKNOWN';
  const url = req.url || '/unknown';
  
  try {
    const app = await getApp();
    
    // Log incoming request in production for debugging
    if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
      const hasAuth = !!req.headers.authorization;
      console.log(`[Vercel Function] ${method} ${url} auth=${hasAuth ? 'Bearer' : 'none'}`);
    }
    
    // Forward the request to Express
    // Express will handle routing, middleware, and response
    return app(req, res);
  } catch (err) {
    const duration = Date.now() - startTime;
    console.error(`[Vercel Function] Error after ${duration}ms:`, err);
    
    // If headers already sent, can't send error response
    if (res.headersSent) {
      return;
    }
    
    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Internal Server Error",
      },
    });
  }
}
