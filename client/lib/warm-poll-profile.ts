/** Shorter warm-poll on mobile — cold API wake without 15s+ loading spinners. */
export function warmPollProfile(): { maxAttempts: number; delayMs: number } {
  if (typeof window === 'undefined') {
    return { maxAttempts: 6, delayMs: 2_500 };
  }
  const mobile = window.matchMedia('(max-width: 767px)').matches;
  const slow =
    typeof navigator !== 'undefined' &&
    'connection' in navigator &&
    Boolean((navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection?.saveData);
  if (mobile || slow) {
    return { maxAttempts: 8, delayMs: 2_000 };
  }
  return { maxAttempts: 6, delayMs: 2_500 };
}
