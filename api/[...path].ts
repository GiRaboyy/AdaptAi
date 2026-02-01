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
          // @ts-ignore - Dynamic import of compiled CJS bundle
          const mod = await import('./server-app.cjs');
          return await mod.createApp();
        } else {
          // In development, import TypeScript source
          console.log('[Vercel Function] Loading from TypeScript source...');
          const { createApp } = await import('../server/app');
          return await createApp();
        }
      } catch (err) {
        console.error('[Vercel Function] Failed to import app:', err);
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
  try {
    const app = await getApp();
    
    // Forward the request to Express
    // Express will handle routing, middleware, and response
    return app(req, res);
  } catch (err) {
    console.error("[Vercel Function] Error:", err);
    
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
