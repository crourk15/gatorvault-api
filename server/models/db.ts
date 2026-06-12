/**
 * Postgres connection pool for FutureCast models.
 * @see server/migrations/README.md
 *
 * Requires DATABASE_URL or SUPABASE_DATABASE_URL (direct Postgres connection string).
 */
import { Pool, type PoolConfig, type QueryResult, type QueryResultRow } from 'pg';

let pool: Pool | null = null;

function getConnectionString(): string {
  const url = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL (or SUPABASE_DATABASE_URL) is required for FutureCast DB access');
  }
  return normalizePostgresUrl(url);
}

/** Trim quotes and always URL-encode password (handles #, @, % in Supabase passwords). */
export function normalizePostgresUrl(raw: string): string {
  const url = raw.trim().replace(/^['"]|['"]$/g, '');
  const prefix = 'postgresql://';
  if (!url.toLowerCase().startsWith(prefix)) {
    throw new Error('Invalid DATABASE_URL — must start with postgresql://');
  }
  const rest = url.slice(prefix.length);
  const at = rest.lastIndexOf('@');
  if (at < 0) throw new Error('Invalid DATABASE_URL');
  const userinfo = rest.slice(0, at);
  const hostpart = rest.slice(at + 1);
  const colon = userinfo.indexOf(':');
  if (colon < 0) throw new Error('Invalid DATABASE_URL');
  const user = userinfo.slice(0, colon);
  const pass = userinfo.slice(colon + 1);
  let encoded: string;
  try {
    encoded = encodeURIComponent(decodeURIComponent(pass));
  } catch {
    encoded = encodeURIComponent(pass);
  }
  return `${prefix}${user}:${encoded}@${hostpart}`;
}

/** Parse postgres URI without Node URL (avoids "Invalid URL" on special chars in password). */
export function parsePostgresConfig(raw: string): PoolConfig {
  const normalized = normalizePostgresUrl(raw);
  const rest = normalized.replace(/^postgresql:\/\//i, '');
  const at = rest.lastIndexOf('@');
  if (at < 0) throw new Error('Invalid DATABASE_URL');
  const userinfo = rest.slice(0, at);
  const hostpart = rest.slice(at + 1);
  const colon = userinfo.indexOf(':');
  if (colon < 0) throw new Error('Invalid DATABASE_URL');

  const user = decodeURIComponent(userinfo.slice(0, colon));
  const password = decodeURIComponent(userinfo.slice(colon + 1));

  const slash = hostpart.indexOf('/');
  const hostPort = slash >= 0 ? hostpart.slice(0, slash) : hostpart;
  const database = slash >= 0 ? hostpart.slice(slash + 1).split('?')[0] : 'postgres';

  const portColon = hostPort.lastIndexOf(':');
  const host = portColon >= 0 ? hostPort.slice(0, portColon) : hostPort;
  const port = portColon >= 0 ? Number(hostPort.slice(portColon + 1)) : 5432;

  if (!host || !Number.isFinite(port)) {
    throw new Error('Invalid DATABASE_URL');
  }

  const useSsl =
    process.env.FUTURECAST_DB_SSL === 'true' ||
    /supabase\.(co|com)|pooler\.supabase\.com|:6543/i.test(normalized) ||
    process.env.NODE_ENV === 'production';

  return {
    user,
    password,
    host,
    port,
    database: database || 'postgres',
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
  };
}

function getPool(): Pool {
  if (!pool) {
    const connectionString = getConnectionString();
    pool = new Pool(parsePostgresConfig(connectionString));
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
