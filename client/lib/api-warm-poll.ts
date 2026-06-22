import { ApiFetchError } from './api-fetch';

/** True when the API is cold/waking and another attempt may succeed. */
export function isWarmRetryError(err: unknown): boolean {
  if (!(err instanceof ApiFetchError)) return false;
  if (err.timedOut || err.unavailable) return true;
  if (err.status === 503 || err.status === 502 || err.status === 504) return true;
  return /warming|building|unavailable|timed out/i.test(err.message);
}

export function isTransientLoadError(err: unknown): boolean {
  return isWarmRetryError(err);
}

export function userFacingLoadError(err: unknown, fallback = 'Could not load data. Please try again.'): string {
  if (err instanceof ApiFetchError) {
    if (err.timedOut || err.unavailable || err.status === 503) {
      return 'GatorVault servers are waking up — this usually takes a few seconds.';
    }
    return err.message || fallback;
  }
  return err instanceof Error ? err.message : fallback;
}

/** Poll while Render cold-starts — avoids hard error on first vault visit after idle. */
export async function fetchWithWarmPoll<T>(
  fn: () => Promise<T>,
  opts?: { maxAttempts?: number; delayMs?: number }
): Promise<T> {
  const maxAttempts = opts?.maxAttempts ?? 6;
  const delayMs = opts?.delayMs ?? 2_000;
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
