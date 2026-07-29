import { ApiFetchError } from './api-fetch';

/** True when the API is cold/waking and another attempt may succeed. */
export function isWarmRetryError(err: unknown): boolean {
  const msg = String(
    err instanceof Error ? err.message : err != null ? err : ''
  );
  // WebKit/Capacitor often surfaces proxy 502/504 as bare "Load failed".
  if (/load failed|fetch failed|Failed to fetch|network/i.test(msg)) return true;
  if (!(err instanceof ApiFetchError)) {
    return /warming|building|unavailable|timed out|Hub warming/i.test(msg);
  }
  if (err.timedOut || err.unavailable) return true;
  if (err.status === 503 || err.status === 502 || err.status === 504) return true;
  return /warming|building|unavailable|timed out|Hub warming/i.test(err.message);
}

export function isTransientLoadError(err: unknown): boolean {
  return isWarmRetryError(err);
}

export function userFacingLoadError(err: unknown, fallback = 'Could not load data. Please try again.'): string {
  if (err instanceof ApiFetchError) {
    if (err.timedOut || err.unavailable || err.status === 503) {
      return 'Loading live data — almost ready.';
    }
    if (/load failed/i.test(err.message)) {
      return 'Loading live data — almost ready.';
    }
    return err.message || fallback;
  }
  if (err instanceof Error && /load failed/i.test(err.message)) {
    return 'Loading live data — almost ready.';
  }
  return err instanceof Error ? err.message : fallback;
}

/** Poll while Render cold-starts — premium tier waits longer before showing errors. */
export async function fetchWithWarmPoll<T>(
  fn: () => Promise<T>,
  opts?: { maxAttempts?: number; delayMs?: number }
): Promise<T> {
  const maxAttempts = opts?.maxAttempts ?? 10;
  const delayMs = opts?.delayMs ?? 2_500;
  let lastErr: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt >= maxAttempts - 1 || !isWarmRetryError(err)) break;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastErr;
}
