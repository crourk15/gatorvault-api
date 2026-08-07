/**
 * Graceful API responses when FutureCast Postgres is unavailable.
 */
import type { Response } from 'express';

export function isDatabaseUnavailableError(err: unknown): boolean {
  const anyErr = err as { code?: string; message?: string } | null;
  const code = String(anyErr?.code || '');
  const msg = err instanceof Error ? err.message : String(err ?? '');
  if (
    code === 'EAUTHTIMEOUT' ||
    code === 'ETIMEDOUT' ||
    code === 'ECONNRESET' ||
    code === 'ECONNREFUSED' ||
    code === 'ENOTFOUND' ||
    code === '08006' ||
    code === '57P01'
  ) {
    return true;
  }
  return (
    /DATABASE_URL|SUPABASE_DATABASE_URL|connection|ECONNREFUSED|ENOTFOUND|EAUTHTIMEOUT|ETIMEDOUT|ECONNRESET|08006|password authentication|timeout while waiting for message|circuit open|Connection terminated/i.test(
      msg
    )
  );
}

/** Missing FutureCast tables (migration not applied yet). */
export function isFutureCastSchemaError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return /relation .* does not exist|42P01|undefined_table/i.test(msg);
}

export function isFutureCastDataError(err: unknown): boolean {
  return isDatabaseUnavailableError(err) || isFutureCastSchemaError(err);
}

export function respondDatabaseUnavailable(
  res: Response,
  payload: Record<string, unknown>,
  err?: unknown
): void {
  const schema = err != null && isFutureCastSchemaError(err);
  res.status(200).json({
    ...payload,
    unavailable: !schema,
    schemaPending: schema || undefined,
    error: schema
      ? 'FutureCast alerts table is not migrated yet. Run migrations/015_create_alerts.sql on the database.'
      : 'FutureCast database is not configured or unreachable. Check DATABASE_URL on the API server.',
  });
}
