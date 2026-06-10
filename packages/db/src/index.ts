import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema';

const pool = new pg.Pool({
  connectionString:
    process.env.DATABASE_URL || 'postgresql://harga:harga_dev@127.0.0.1:5435/harga_indo',
});

export const db = drizzle(pool, { schema });
export * from './schema';
