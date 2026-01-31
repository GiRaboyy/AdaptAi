import { Request, Response, NextFunction } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { db, isDatabaseAvailable } from '../db';
import { users } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';

// Extended Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number; // Internal INT ID for FK compatibility
        authUid: string; // Supabase Auth UUID
        email: string;
        role: 'curator' | 'employee';
        name: string;
        emailConfirmed: boolean;
      };
      isAuthenticated?: () => boolean; // Backward compatibility with Passport.js
    }
  }
}

// Supabase client for server-side auth validation
const SUPABASE_URL = process.env.DATABASE_FILE_STORAGE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

let supabaseClient: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn('[Auth Middleware] Supabase credentials missing - JWT auth disabled');
    return null;
  }

  if (!supabaseClient) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });
    console.log('[Auth Middleware] Supabase client initialized');
  }

  return supabaseClient;
}

/**
 * Middleware to authenticate requests using Supabase JWT
 * Validates the Bearer token and resolves the user profile
 */
export function authFromSupabase() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check if database is available
      if (!isDatabaseAvailable()) {
        // No database - skip auth entirely, allow public access
        return next();
      }

      // Extract Bearer token from Authorization header
      const authHeader = req.headers.authorization;
      const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

      // If no JWT token, DON'T set req.user - let Passport session handle it
      // This allows both JWT auth (Supabase) and session auth (Passport) to work
      if (!token) {
        return next();
      }

      // Get Supabase client
      const supabase = getSupabaseClient();
      if (!supabase) {
        // Supabase not configured - let Passport session handle auth
        return next();
      }

      // Validate JWT with Supabase
      const { data: { user: authUser }, error } = await supabase.auth.getUser(token);

      if (error || !authUser) {
        console.warn('[Auth Middleware] Invalid token:', error?.message);
        return res.status(401).json({
          code: 'UNAUTHORIZED',
          message: 'Сессия истекла. Войдите снова.',
        });
      }

      // Extract auth data
      const authUid = authUser.id;
      const email = authUser.email!;
      const emailConfirmed = !!authUser.email_confirmed_at;

      // Resolve profile from public.users
      let profile = await db.query.users.findFirst({
        where: eq(users.authUid, authUid),
      });

      // If no profile with auth_uid, try to find by email and link
      if (!profile) {
        profile = await db.query.users.findFirst({
          where: sql`LOWER(${users.email}) = LOWER(${email})`,
        });

        if (profile && !profile.authUid) {
          // Link existing profile
          await db.update(users)
            .set({ authUid: authUid })
            .where(eq(users.id, profile.id));
          
          profile = { ...profile, authUid: authUid };
          console.log(`[Auth Middleware] Linked profile ${profile.id} to auth_uid ${authUid}`);
        }
      }

      // CRITICAL: Sync email verification from Supabase to local DB
      // This fixes the case where user verified email in Supabase but local DB wasn't updated
      if (profile && emailConfirmed && !profile.emailVerified) {
        await db.update(users)
          .set({ 
            emailVerified: true,
            emailVerificationToken: null,
            emailVerificationExpires: null,
          })
          .where(eq(users.id, profile.id));
        
        profile = { ...profile, emailVerified: true };
        console.log(`[Auth Middleware] Synced email verification for ${email} (Supabase -> local DB)`);
      }

      // If still no profile, create one (fallback)
      if (!profile) {
        const metadata = authUser.user_metadata || {};
        const name = metadata.name || email.split('@')[0];
        const role = (metadata.role === 'curator' || metadata.role === 'employee') 
          ? metadata.role 
          : 'employee';

        const [newProfile] = await db.insert(users).values({
          authUid: authUid,
          email: email,
          name: name,
          role: role,
          password: null, // Managed by Supabase
          emailVerified: emailConfirmed,
          plan: 'trial',
          createdCoursesCount: 0,
        }).returning();

        profile = newProfile;
        console.log(`[Auth Middleware] Created profile ${profile.id} for auth_uid ${authUid}`);
      }

      // Set normalized user object
      req.user = {
        id: profile.id,
        authUid: authUid,
        email: email,
        role: profile.role,
        name: profile.name,
        emailConfirmed: emailConfirmed,
      };

      // Backward compatibility with Passport.js
      req.isAuthenticated = () => true;

      next();
    } catch (err) {
      console.error('[Auth Middleware] Error:', err);
      return res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'Ошибка аутентификации',
      });
    }
  };
}

/**
 * Authorization guard middleware
 * Requires authenticated user and optionally checks email confirmation and role
 */
interface RequireAuthOptions {
  requireConfirmedEmail?: boolean;
  role?: 'curator' | 'employee';
}

export function requireAuth(options: RequireAuthOptions = {}) {
  const { requireConfirmedEmail = true, role } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    // Check authentication
    if (!req.user) {
      return res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'Необходима авторизация',
      });
    }

    // Check email confirmation
    if (requireConfirmedEmail && !req.user.emailConfirmed) {
      return res.status(403).json({
        code: 'EMAIL_NOT_CONFIRMED',
        message: 'Подтвердите email',
      });
    }

    // Check role
    if (role && req.user.role !== role) {
      return res.status(403).json({
        code: 'FORBIDDEN',
        message: 'Доступ запрещён',
      });
    }

    next();
  };
}
