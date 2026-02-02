import { type Request, Response, NextFunction } from "express";
import { createApp } from "./app";
import { serveStatic } from "./static";
import { createServer } from "http";
import { logger } from "./logger";
import { type RequestWithId } from "./request-id-middleware";

/**
 * Validate required environment variables at startup.
 * Throws an error in production if critical variables are missing.
 * Logs warnings in development for missing optional variables.
 */
function validateEnvironmentVariables(): void {
  const isProduction = process.env.NODE_ENV === "production";
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Required variables in production
  const requiredInProduction = [
    "DATABASE_URL",
    "SESSION_SECRET",
    "DATABASE_FILE_STORAGE_URL",
    "SUPABASE_ANON_KEY",
    "APP_URL",
  ];
  
  // Recommended variables (warn if missing)
  const recommended = [
    "YANDEX_CLOUD_API_KEY",
    "YANDEX_CLOUD_PROJECT_FOLDER_ID",
    "YANDEX_PROMPT_ID",
  ];
  
  // Check required variables
  for (const envVar of requiredInProduction) {
    if (!process.env[envVar]) {
      if (isProduction) {
        errors.push(`Missing required environment variable: ${envVar}`);
      } else {
        warnings.push(`Missing environment variable (required in production): ${envVar}`);
      }
    }
  }
  
  // Check recommended variables
  for (const envVar of recommended) {
    if (!process.env[envVar]) {
      warnings.push(`Missing recommended environment variable: ${envVar} (AI features will be disabled)`);
    }
  }
  
  // Check for localhost in APP_URL in production
  if (isProduction && process.env.APP_URL?.includes("localhost")) {
    errors.push(
      "APP_URL contains 'localhost' in production. " +
      "Set it to your production domain (e.g., https://adapt-ai-nu.vercel.app)"
    );
  }
  
  // Log warnings
  for (const warning of warnings) {
    logger.warn({ msg: warning, context: "env-validation" });
  }
  
  // Throw error in production if required variables are missing
  if (errors.length > 0 && isProduction) {
    const errorMessage = 
      "Environment variable validation failed:\n" +
      errors.map(e => `  - ${e}`).join("\n") +
      "\n\nSet these variables in Vercel Dashboard → Settings → Environment Variables";
    
    logger.error({ msg: errorMessage, context: "env-validation" });
    throw new Error(errorMessage);
  }
  
  // Log success
  if (errors.length === 0) {
    logger.info({ 
      msg: `Environment validation passed (${isProduction ? 'production' : 'development'} mode)`,
      context: "env-validation" 
    });
  }
}

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

const SHUTDOWN_TIMEOUT_MS = parseInt(
  process.env.SHUTDOWN_TIMEOUT_MS || "10000",
  10,
);
let isReady = false;
let isShuttingDown = false;
let activeRequests = 0;
let httpServer: any; // Will be set in async block

function toErrorObject(err: unknown) {
  if (!err) return undefined;
  if (err instanceof Error) {
    return { message: err.message, name: err.name, stack: err.stack };
  }
  return { message: String(err) };
}

function initiateShutdown(reason: string, err?: unknown) {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;
  isReady = false;

  logger.warn({
    msg: "Shutdown initiated",
    context: "server",
    reason,
    error: toErrorObject(err),
  });

  const timeout = setTimeout(() => {
    logger.error({
      msg: "Shutdown timeout exceeded, forcing exit",
      context: "server",
    });
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);

  // Only try to close if httpServer exists (may not exist if error during startup)
  if (httpServer) {
    httpServer.close((closeErr: any) => {
      if (closeErr) {
        logger.error({
          msg: "Error while closing HTTP server",
          context: "server",
          error: toErrorObject(closeErr),
        });
        process.exit(1);
      }

      const checkInterval = setInterval(() => {
        if (activeRequests === 0) {
          clearInterval(checkInterval);
          clearTimeout(timeout);
          logger.info({
            msg: "Shutdown complete",
            context: "server",
          });
          process.exit(0);
        }
      }, 100);
    });
  } else {
    clearTimeout(timeout);
    logger.info({
      msg: "Shutdown complete (server not started)",
      context: "server",
    });
    process.exit(0);
  }
}

process.on("unhandledRejection", (reason) => {
  logger.error({
    msg: "Unhandled promise rejection",
    context: "process",
    error: toErrorObject(reason),
  });
  initiateShutdown("unhandledRejection", reason);
});

process.on("uncaughtException", (err) => {
  logger.error({
    msg: "Uncaught exception",
    context: "process",
    error: toErrorObject(err),
  });
  initiateShutdown("uncaughtException", err);
});

["SIGTERM", "SIGINT"].forEach((signal) => {
  process.on(signal as NodeJS.Signals, () => {
    logger.info({
      msg: `Received ${signal}, starting graceful shutdown`,
      context: "process",
    });
    initiateShutdown(signal);
  });
});

(async () => {
  // Validate environment variables before starting the server
  validateEnvironmentVariables();
  
  // Create the Express app using the factory function
  const app = await createApp();
  httpServer = createServer(app);

  // Middleware to track active requests for graceful shutdown
  app.use((req, res, next) => {
    activeRequests += 1;
    res.on("finish", () => {
      activeRequests -= 1;
    });
    next();
  });

  // Readiness check that considers shutdown state (local server only)
  app.get("/readyz", (_req, res) => {
    if (!isReady || isShuttingDown) {
      res.status(503).json({
        ready: false,
        reason: isShuttingDown
          ? "Server is shutting down"
          : "Server is initializing",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    res.status(200).json({
      ready: true,
      timestamp: new Date().toISOString(),
    });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  const host = process.env.HOST || "0.0.0.0";

  httpServer.listen(
    {
      port,
      host,
    },
    () => {
      isReady = true;
      logger.info({
        msg: `Server listening on ${host}:${port}`,
        context: "server",
      });
    },
  );
})();
