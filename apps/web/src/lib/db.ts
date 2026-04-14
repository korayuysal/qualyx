import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { schema, pgSslConfig } from '@qualyx/core';

const globalForDb = globalThis as unknown as { dbPool: pg.Pool };

const pool = globalForDb.dbPool ??= new pg.Pool({
  connectionString: process.env.DATABASE_URL!,
  ssl: pgSslConfig(),
  max: 5,
});

export const db = drizzle(pool, { schema });
