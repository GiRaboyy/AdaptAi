import { z } from 'zod';
import { insertUserSchema, insertTrackSchema, insertDrillAttemptSchema, tracks, steps, enrollments, users, drillAttempts } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  unauthorized: z.object({
    message: z.string(),
  }),
};

// API Contract
export const api = {
  auth: {
    register: {
      method: 'POST' as const,
      path: '/api/register',
      input: insertUserSchema,
      responses: {
        201: z.custom<typeof users.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    login: {
      method: 'POST' as const,
      path: '/api/login',
      input: z.object({ username: z.string(), password: z.string() }), // using username field for email to match passport-local standard
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: errorSchemas.unauthorized,
      },
    },
    logout: {
      method: 'POST' as const,
      path: '/api/logout',
      responses: {
        200: z.void(),
      },
    },
    me: {
      method: 'GET' as const,
      path: '/api/user',
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: errorSchemas.unauthorized,
      },
    },
  },
  tracks: {
    generate: {
      method: 'POST' as const,
      path: '/api/tracks/generate',
      input: z.object({
        title: z.string(),
        text: z.string(),
      }),
      responses: {
        201: z.object({
          track: z.custom<typeof tracks.$inferSelect>(),
          steps: z.array(z.custom<typeof steps.$inferSelect>())
        }),
      },
    },
    list: {
      method: 'GET' as const,
      path: '/api/tracks',
      responses: {
        200: z.array(z.custom<typeof tracks.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/tracks/:id',
      responses: {
        200: z.object({
          track: z.custom<typeof tracks.$inferSelect>(),
          steps: z.array(z.custom<typeof steps.$inferSelect>())
        }),
        404: errorSchemas.notFound,
      },
    },
    join: {
      method: 'POST' as const,
      path: '/api/tracks/join',
      input: z.object({ code: z.string() }),
      responses: {
        200: z.object({
          enrollment: z.custom<typeof enrollments.$inferSelect>(),
          trackId: z.number()
        }),
        404: errorSchemas.notFound,
      },
    },
  },
  enrollments: {
    list: {
      method: 'GET' as const,
      path: '/api/enrollments',
      responses: {
        200: z.array(z.object({
          enrollment: z.custom<typeof enrollments.$inferSelect>(),
          track: z.custom<typeof tracks.$inferSelect>()
        })),
      },
    },
    updateProgress: {
      method: 'PATCH' as const,
      path: '/api/enrollments/:id/progress',
      input: z.object({
        stepIndex: z.number(),
        isCompleted: z.boolean().optional()
      }),
      responses: {
        200: z.custom<typeof enrollments.$inferSelect>(),
      },
    },
  },
  drills: {
    record: {
      method: 'POST' as const,
      path: '/api/drills',
      input: insertDrillAttemptSchema,
      responses: {
        201: z.custom<typeof drillAttempts.$inferSelect>(),
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}

// Type exports
export type InsertUser = z.infer<typeof insertUserSchema>;
