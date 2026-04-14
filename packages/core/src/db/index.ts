import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';

/** SSL config for node-postgres connections. Returns undefined when DATABASE_SSL is not set. */
export function pgSslConfig(): { rejectUnauthorized: false } | undefined {
  return process.env.DATABASE_SSL === 'true'
    ? { rejectUnauthorized: false }
    : undefined;
}

/** Direct connection string (bypasses Supabase pooler for LISTEN/NOTIFY), falls back to DATABASE_URL. */
export function pgDirectConnectionString(): string {
  const url = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL environment variable is required');
  return url;
}

let pool: pg.Pool | null = null;
let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (!db) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is required for PostgreSQL');
    }

    pool = new pg.Pool({
      connectionString: databaseUrl,
      ssl: pgSslConfig(),
      max: 10,
    });
    db = drizzle(pool, { schema });
  }
  return db;
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    db = null;
  }
}

export { schema };
export type Database = ReturnType<typeof getDb>;
