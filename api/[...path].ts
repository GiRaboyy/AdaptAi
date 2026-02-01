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

import { createApp } from "../server/app";
import type { VercelRequest, VercelResponse } from "@vercel/node";

// Create Express app instance once per serverless function instance
// This is reused across requests to the same function instance
let appPromise: Promise<any> | null = null;

async function getApp() {
  if (!appPromise) {
    appPromise = createApp();
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
  } catch (error) {
    console.error("[Vercel Function] Error:", error);
    
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
