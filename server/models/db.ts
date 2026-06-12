/**
 * Postgres connection pool for FutureCast models.
 * @see server/migrations/README.md
 *
 * Requires DATABASE_URL or SUPABASE_DATABASE_URL (direct Postgres connection string).
 */
import { Pool, type QueryResult, type QueryResultRow } from 'pg';

let pool: Pool | null = null;

function getConnectionString(): string {
  const url = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL (or SUPABASE_DATABASE_URL) is required for FutureCast DB access');
  }
  return url;
}

function getPool(): Pool {
  if (!pool) {
    const connectionString = getConnectionString();
    const useSsl =
      process.env.FUTURECAST_DB_SSL === 'true' ||
      /supabase\.co/i.test(connectionString) ||
      process.env.NODE_ENV === 'production';

    pool = new Pool({
      connectionString,
      ssl: useSsl ? { rejectUnauthorized: false } : undefined,
    });
  }
  return pool;
}

export const db = {
  async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[]
  ): Promise<QueryResult<T>> {
    return getPool().query<T>(text, params);
  },
};

/** Close the pool (tests / graceful shutdown). */
export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
