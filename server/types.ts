/**
 * Global TypeScript type augmentations for Express and application types
 * This file extends Express types to support both Supabase JWT auth and Passport session auth
 */

import { User as SchemaUser } from '@shared/schema';

// AuthUser interface for Supabase JWT authentication
export interface AuthUser {
  id: number; // Internal INT ID for FK compatibility
  authUid: string; // Supabase Auth UUID
  email: string;
  role: 'curator' | 'employee';
  name: string;
  emailConfirmed: boolean; // From Supabase JWT
}

// Augment Express types to support both auth modes
declare global {
  namespace Express {
    // Union type supporting both Supabase JWT (AuthUser) and Passport session (SchemaUser)
    interface User extends Partial<AuthUser & SchemaUser> {
      // Common fields that should always exist
      email: string;
      role: 'curator' | 'employee';
      name: string;
      
      // Optional fields depending on auth mode
      id?: number; // Always present, but optional for type safety
      authUid?: string; // Present for JWT auth
      emailConfirmed?: boolean; // Present for JWT auth (Supabase)
      emailVerified?: boolean; // Present for session auth (Passport)
    }

    interface Request {
      user?: User;
      // Add custom request properties if needed
      requestId?: string;
    }
  }
}

/**
 * Helper function to check if user's email is verified
 * Works with both JWT (emailConfirmed) and session (emailVerified) auth
 */
export function isEmailVerified(user: Express.User | AuthUser | SchemaUser): boolean {
  // Check both properties for maximum compatibility
  const asAny = user as any;
  return !!(asAny.emailConfirmed || asAny.emailVerified);
}

/**
 * Helper function to check if user is authenticated via Supabase JWT
 */
export function isJWTUser(user: Express.User): user is AuthUser {
  return !!(user as any).authUid && !!(user as any).emailConfirmed;
}

/**
 * Helper function to check if user is authenticated via Passport session
 * Returns true if user has session-specific properties
 */
export function isSessionUser(user: Express.User): boolean {
  return (user as any).password !== undefined && (user as any).emailVerified !== undefined;
}
