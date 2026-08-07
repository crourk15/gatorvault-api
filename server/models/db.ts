/**
 * Postgres connection pool for FutureCast models.
 * @see server/migrations/README.md
 *
 * Prefer Supabase shared session pooler URI (port 6543) on Render.
 * Requires DATABASE_URL or SUPABASE_DATABASE_URL.
 */
import { Pool, type PoolConfig, type QueryResult, type QueryResultRow } from 'pg';

let pool: Pool | null = null;
/** Fail fast for a short window after auth/connect failures (keeps Render alive). */
let circuitOpenUntil = 0;
const CIRCUIT_OPEN_MS = 15_000;

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

function envInt(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallback;
}

function isConnectFailure(err: unknown): boolean {
  const anyErr = err as { code?: string; message?: string } | null;
  const code = String(anyErr?.code || '');
  const msg = String(anyErr?.message || err || '');
  return (
    code === 'EAUTHTIMEOUT' ||
    code === 'ETIMEDOUT' ||
    code === 'ECONNRESET' ||
    code === 'ECONNREFUSED' ||
    code === '08006' ||
    code === '57P01' ||
    /EAUTHTIMEOUT|timeout while waiting for message|Connection terminated|connect ETIMEDOUT|circuit open/i.test(
      msg
    )
  );
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

  // Bound hangs so Supabase auth blips cannot pin the event loop / crash Render.
  const connectionTimeoutMillis = envInt('PG_CONNECTION_TIMEOUT_MS', 5_000);
  const idleTimeoutMillis = envInt('PG_IDLE_TIMEOUT_MS', 20_000);
  const max = envInt('PG_POOL_MAX', 4);
  const statementTimeoutMs = envInt('PG_STATEMENT_TIMEOUT_MS', 8_000);

  return {
    user,
    password,
    host,
    port,
    database: database || 'postgres',
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
    connectionTimeoutMillis,
    idleTimeoutMillis,
    max,
    allowExitOnIdle: true,
    options: `-c statement_timeout=${statementTimeoutMs}`,
  };
}

function getPool(): Pool {
  if (!pool) {
    const connectionString = getConnectionString();
    pool = new Pool(parsePostgresConfig(connectionString));
    // Idle clients emit here on auth/network death. Without a listener, node-pg can
    // crash the process — which is the Render `==> Running 'node server.js'` loop.
    pool.on('error', (err) => {
      circuitOpenUntil = Date.now() + CIRCUIT_OPEN_MS;
      console.error(
        '[pg-pool] idle client error (kept process alive):',
        (err as { code?: string })?.code || '',
        err instanceof Error ? err.message : err
      );
    });
  }
  return pool;
}

export const db = {
  async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[]
  ): Promise<QueryResult<T>> {
    if (Date.now() < circuitOpenUntil) {
      const err = new Error('DATABASE_URL circuit open — recent connection failures');
      (err as { code?: string }).code = 'ECONNREFUSED';
      throw err;
    }
    try {
      return await getPool().query<T>(text, params);
    } catch (err) {
      if (isConnectFailure(err)) {
        circuitOpenUntil = Date.now() + CIRCUIT_OPEN_MS;
      }
      throw err;
    }
  },
};

/** Close the pool (tests / graceful shutdown). */
export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
  circuitOpenUntil = 0;
}
