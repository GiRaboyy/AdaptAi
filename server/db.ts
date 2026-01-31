import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

// Check if DATABASE_URL is set
const isDatabaseConfigured = !!process.env.DATABASE_URL;

if (!isDatabaseConfigured) {
  console.warn(
    "[Database] DATABASE_URL is not set. Database operations will fail.",
    "\n[Database] Please configure Supabase integration to enable database features."
  );
}

// Create pool only if DATABASE_URL is set
export const pool = isDatabaseConfigured 
  ? new Pool({ 
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
      // Increase timeouts for large operations
      statement_timeout: 300000, // 5 minutes for long-running queries
      query_timeout: 300000,     // 5 minutes for query execution
      connectionTimeoutMillis: 10000, // 10 seconds for connection
      idleTimeoutMillis: 30000,       // 30 seconds for idle connections
      max: 20                         // Maximum pool size
    })
  : null;

// Create drizzle instance only if pool is available
export const db = pool ? drizzle(pool, { schema }) : null as any;

// Helper to check if database is available
export function isDatabaseAvailable(): boolean {
  return isDatabaseConfigured && pool !== null;
}
