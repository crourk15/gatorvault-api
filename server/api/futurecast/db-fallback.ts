/**
 * Graceful API responses when FutureCast Postgres is unavailable.
 */
import type { Response } from 'express';

export function isDatabaseUnavailableError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return (
    /DATABASE_URL|SUPABASE_DATABASE_URL|connection|ECONNREFUSED|ENOTFOUND|password authentication/i.test(
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
  payload: Record<string, unknown>
): void {
  res.status(503).json({
    ...payload,
    unavailable: true,
    error: 'FutureCast database is not configured or unreachable. Check DATABASE_URL on the API server.',
  });
}
