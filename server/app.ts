import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import { registerRoutes } from "./routes";
import { logger } from "./logger";
import { requestIdMiddleware, type RequestWithId } from "./request-id-middleware";
import { authFromSupabase } from "./middleware/auth-supabase";

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

function toErrorObject(err: unknown) {
  if (!err) return undefined;
  if (err instanceof Error) {
    return { message: err.message, name: err.name, stack: err.stack };
  }
  return { message: String(err) };
}

/**
 * Create and configure the Express application.
 * This factory function is used both for local development and Vercel serverless functions.
 * 
 * IMPORTANT: This function does NOT call app.listen() - that's handled by the caller.
 */
export async function createApp() {
  const app = express();

  // Trust proxy for Vercel serverless deployment
  // This must be set before session middleware
  app.set('trust proxy', 1);

  // CORS middleware - allow all origins for API
  app.use(cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
  }));

  // Body parsing middleware
  app.use(
    express.json({
      limit: "10mb",
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );

  app.use(express.urlencoded({ extended: false, limit: "10mb" }));

  // Request ID middleware for logging
  app.use(requestIdMiddleware);

  // JWT Authentication Middleware - applied to all routes
  // This validates Supabase JWT tokens and resolves user profiles
  app.use(authFromSupabase());

  // Request logging middleware
  app.use((req, res, next) => {
    const start = Date.now();

    res.on("finish", () => {
      const duration = Date.now() - start;
      const status = res.statusCode;
      const level =
        status >= 500 ? "error" : status >= 400 ? "warn" : "info";

      const sampleRateEnv = process.env.REQUEST_LOG_SAMPLE;
      const sampleRate = sampleRateEnv ? parseFloat(sampleRateEnv) : 1;

      if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
        return;
      }

      if (sampleRate < 1 && Math.random() > sampleRate) {
        return;
      }

      const reqWithId = req as RequestWithId;

      (logger as any)[level]?.({
        msg: "Request completed",
        context: "http",
        request_id: reqWithId.requestId,
        http: {
          method: req.method,
          path: req.path,
          status,
          duration_ms: duration,
        },
      });
    });

    next();
  });

  // Health check endpoints
  app.get("/healthz", (_req, res) => {
    res.status(200).json({
      ok: true,
      uptime_seconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/readyz", (_req, res) => {
    res.status(200).json({
      ready: true,
      timestamp: new Date().toISOString(),
    });
  });

  // Health check for Vercel - includes environment validation
  app.get("/api/health", async (_req, res) => {
    const nodeEnv = process.env.NODE_ENV || 'development';
    const hasDatabase = Boolean(process.env.DATABASE_URL);
    const hasSessionSecret = Boolean(process.env.SESSION_SECRET);
    const hasSupabaseUrl = Boolean(process.env.DATABASE_FILE_STORAGE_URL);
    const hasSupabaseKey = Boolean(process.env.SUPABASE_ANON_KEY);

    // Check runtime dependencies
    const dependencies: Record<string, boolean> = {};
    const errors: string[] = [];

    // Test pdf-parse
    try {
      // @ts-expect-error - pdf-parse has no type declarations
      const pdfParse = await import('pdf-parse');
      dependencies.pdfParse = Boolean(pdfParse);
    } catch (err) {
      dependencies.pdfParse = false;
      errors.push(`pdf-parse: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Test mammoth
    try {
      const mammoth = await import('mammoth');
      dependencies.mammoth = Boolean(mammoth);
    } catch (err) {
      dependencies.mammoth = false;
      errors.push(`mammoth: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Test multer
    try {
      const multer = await import('multer');
      dependencies.multer = Boolean(multer);
    } catch (err) {
      dependencies.multer = false;
      errors.push(`multer: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Verify critical route registration (check Express router stack)
    const routes: Record<string, string> = {};
    try {
      const routerStack = (app as any)._router?.stack || [];
      const registeredPaths = routerStack
        .filter((layer: any) => layer.route)
        .map((layer: any) => `${Object.keys(layer.route.methods)[0].toUpperCase()} ${layer.route.path}`);
      
      // Check for critical routes
      routes.tracksGenerate = registeredPaths.some((r: string) => r.includes('/api/tracks/generate')) ? 'registered' : 'missing';
      routes.tracksList = registeredPaths.some((r: string) => r.includes('/api/tracks') && !r.includes('generate')) ? 'registered' : 'missing';
      routes.apiUser = registeredPaths.some((r: string) => r.includes('/api/user') || r.includes('/api/me')) ? 'registered' : 'missing';
      
      if (nodeEnv === 'development') {
        console.log('[Health] Registered routes:', registeredPaths.length);
      }
    } catch (err) {
      errors.push(`Route check failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Log warnings for missing configuration in production
    if (nodeEnv === 'production') {
      if (!hasDatabase) {
        console.warn('[Health] Missing DATABASE_URL in production');
        errors.push('Missing DATABASE_URL');
      }
      if (!hasSessionSecret) {
        console.warn('[Health] Missing SESSION_SECRET in production');
        errors.push('Missing SESSION_SECRET');
      }
      if (!hasSupabaseUrl) {
        console.warn('[Health] Missing SUPABASE_URL in production');
        errors.push('Missing SUPABASE_URL');
      }
      if (!hasSupabaseKey) {
        console.warn('[Health] Missing SUPABASE_ANON_KEY in production');
        errors.push('Missing SUPABASE_ANON_KEY');
      }
    }

    const allDependenciesOk = Object.values(dependencies).every(v => v === true);
    const allConfigOk = nodeEnv !== 'production' || (hasDatabase && hasSessionSecret && hasSupabaseUrl && hasSupabaseKey);
    const allRoutesOk = Object.values(routes).every(v => v === 'registered');
    const ok = allDependenciesOk && allConfigOk && allRoutesOk;

    const statusCode = ok ? 200 : 500;

    res.status(statusCode).json({
      ok,
      nodeEnv,
      config: {
        hasDatabase,
        hasSessionSecret,
        hasSupabaseUrl,
        hasSupabaseKey,
      },
      dependencies,
      routes,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || 'unknown',
    });
  });

  // Register all API routes (auth, tracks, etc.)
  // Note: We pass a dummy httpServer for WebSocket routes (not used on Vercel)
  const dummyServer = {} as any;
  await registerRoutes(dummyServer, app);

  // Error handling middleware - must be last
  app.use(
    (err: any, req: Request, res: Response, _next: NextFunction) => {
      const status = err?.status || err?.statusCode || 500;
      const message =
        status >= 500
          ? "Internal Server Error"
          : err?.message || "Bad Request";
      const code =
        err?.code ||
        (status === 400
          ? "BAD_REQUEST"
          : status === 401
          ? "UNAUTHORIZED"
          : status === 403
          ? "FORBIDDEN"
          : status === 404
          ? "NOT_FOUND"
          : status >= 500
          ? "INTERNAL_ERROR"
          : "INTERNAL_ERROR");

      const reqWithId = req as RequestWithId;

      logger.error({
        msg: "Request failed",
        context: "http",
        request_id: reqWithId.requestId,
        error: toErrorObject(err),
        http: {
          method: req.method,
          path: req.path,
          status,
        },
      });

      if (res.headersSent) {
        return;
      }

      res.status(status).json({
        error: {
          code,
          message,
          request_id: reqWithId.requestId,
        },
      });
    },
  );

  return app;
}
