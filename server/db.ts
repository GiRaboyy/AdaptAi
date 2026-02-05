import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

// Lazy initialization - only create pool when DATABASE_URL is available
let _pool: pg.Pool | null = null;
let _db: ReturnType<typeof drizzle> | null = null;

function getPool(): pg.Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL must be set. Did you forget to provision a database?",
    );
  }
  
  if (!_pool) {
    _pool = new Pool({ 
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
      // Increase timeouts for large operations
      statement_timeout: 300000, // 5 minutes for long-running queries
      query_timeout: 300000,     // 5 minutes for query execution
      connectionTimeoutMillis: 10000, // 10 seconds for connection
      idleTimeoutMillis: 30000,       // 30 seconds for idle connections
      max: 20                         // Maximum pool size
    });
  }
  return _pool;
}

function getDb() {
  if (!_db) {
    _db = drizzle(getPool(), { schema });
  }
  return _db;
}

// Export getters that lazily initialize
export const pool = new Proxy({} as pg.Pool, {
  get(_, prop) {
    return (getPool() as any)[prop];
  }
});

export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_, prop) {
    return (getDb() as any)[prop];
  }
});
