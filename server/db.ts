import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
  // Increase timeouts for large operations
  statement_timeout: 300000, // 5 minutes for long-running queries
  query_timeout: 300000,     // 5 minutes for query execution
  connectionTimeoutMillis: 10000, // 10 seconds for connection
  idleTimeoutMillis: 30000,       // 30 seconds for idle connections
  max: 20                         // Maximum pool size
});
export const db = drizzle(pool, { schema });
