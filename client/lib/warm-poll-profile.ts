/** Shorter warm-poll on mobile for most pages — cold API wake without endless spinners. */
export function warmPollProfile(): { maxAttempts: number; delayMs: number } {
  if (typeof window === 'undefined') {
    return { maxAttempts: 8, delayMs: 2_500 };
  }
  const mobile = window.matchMedia('(max-width: 767px)').matches;
  const slow =
    typeof navigator !== 'undefined' &&
    'connection' in navigator &&
    Boolean(
      (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection
        ?.saveData
    );
  if (mobile || slow) {
    return { maxAttempts: 10, delayMs: 2_000 };
  }
  return { maxAttempts: 8, delayMs: 2_500 };
}

/**
 * Recruiting hub bundle can take 45–70s to build on Starter when cache is cold.
 * Poll long enough that fans see data instead of a terminal error.
 */
export function hubBundleWarmPollProfile(): { maxAttempts: number; delayMs: number } {
  if (typeof window === 'undefined') {
    return { maxAttempts: 24, delayMs: 3_000 };
  }
  const mobile = window.matchMedia('(max-width: 767px)').matches;
  if (mobile) {
    return { maxAttempts: 28, delayMs: 2_500 };
  }
  return { maxAttempts: 24, delayMs: 3_000 };
}
