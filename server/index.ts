import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { logger } from "./logger";
import { requestIdMiddleware, type RequestWithId } from "./request-id-middleware";
import { authFromSupabase } from "./middleware/auth-supabase";

const app = express();
const httpServer = createServer(app);

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

  httpServer.close((closeErr) => {
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

app.use(
  express.json({
    limit: "10mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false, limit: "10mb" }));

app.use(requestIdMiddleware);

// JWT Authentication Middleware - applied to all routes
// This validates Supabase JWT tokens and resolves user profiles
app.use(authFromSupabase());

app.use((req, res, next) => {
  activeRequests += 1;
  const start = Date.now();

  res.on("finish", () => {
    activeRequests -= 1;

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

app.get("/healthz", (_req, res) => {
  res.status(200).json({
    ok: true,
    uptime_seconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

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

(async () => {
  await registerRoutes(httpServer, app);

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
