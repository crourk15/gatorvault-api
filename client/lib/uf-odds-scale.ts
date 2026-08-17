/**
 * Shared Florida-odds scale rules (mirrors server/lib/uf-probability-utils.js).
 * Keep in sync — residual unit-interval values must never become 69%/99%.
 */

export const MAX_WEEK_DELTA_WITHOUT_RPM = 15;
export const MAX_WEEK_DELTA_HARD = 35;

export function normalizeOddsPct(
  value: unknown,
  opts: { allowUnitInterval?: boolean } = {}
): number | null {
  if (value == null || !Number.isFinite(Number(value))) return null;
  const n = Number(value);
  if (n <= 0) return null;
  if (n > 100) return 100;
  if (n > 1) return Math.round(n);
  if (!opts.allowUnitInterval) return null;
  return Math.round(n * 100);
}

/** On3 RPM — percentage points only. Accepts 1 as one percent (never ×100). */
export function sanitizeRpmPct(value: unknown): number | null {
  if (value == null || !Number.isFinite(Number(value))) return null;
  const n = Number(value);
  if (n <= 0) return null;
  if (n > 100) return 100;
  // (0, 1): residual fraction on percent-scale boards — not 36%/99%.
  if (n < 1) return null;
  return Math.round(n);
}

export function sanitizeStoreOddsPct(
  value: unknown,
  opts: { rpmPct?: number | null } = {}
): number | null {
  if (value == null || !Number.isFinite(Number(value))) return null;
  const raw = Number(value);
  const rpm = sanitizeRpmPct(opts.rpmPct);
  const n = normalizeOddsPct(raw, { allowUnitInterval: true });
  if (n == null) return null;
  if (raw > 0 && raw <= 1 && n >= 85 && !(rpm != null && rpm >= 50)) return null;
  return n;
}

/** Display helper for Lab / Discovery bars. */
export function ufPctFromRaw(raw: number | null | undefined): number {
  if (raw == null) return 0;
  // Prefer percentage points. Reject residual unit-interval leftovers.
  if (raw > 1) return Math.min(100, Math.round(raw));
  if (raw <= 0) return 0;
  // Exact 1 is one percent (Industry Consensus micro) — never discard or ×100.
  if (raw === 1) return 1;
  // Unit interval only when it looks like a real store fraction (< 0.85).
  if (raw < 0.85) return Math.round(raw * 100);
  return 0;
}

export function canExposeWeekDelta(opts: {
  delta?: number | null;
  rpmPct?: number | null;
  lowConfidence?: boolean;
}): boolean {
  const delta = opts.delta;
  if (delta == null || !Number.isFinite(Number(delta))) return false;
  const abs = Math.abs(Number(delta));
  if (abs < 1) return false;
  if (abs > MAX_WEEK_DELTA_HARD) return false;
  const rpm = sanitizeRpmPct(opts.rpmPct);
  const thin = Boolean(opts.lowConfidence) || rpm == null;
  if (thin && abs > MAX_WEEK_DELTA_WITHOUT_RPM) return false;
  if (thin && abs === 4) return false;
  return true;
}
