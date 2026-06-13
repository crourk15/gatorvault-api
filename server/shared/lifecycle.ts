/**
 * Lifecycle normalization — API aliases → DB values.
 * HIGH_SCHOOL / HS → HS recruits
 * PORTAL / COLLEGE → portal/college athletes
 * ROSTER → roster (JSON store, not FutureCast Postgres)
 */
export type NormalizedLifecycle = 'HS' | 'PORTAL' | 'ROSTER';

const ALIAS_MAP: Record<string, NormalizedLifecycle> = {
  HS: 'HS',
  HIGH_SCHOOL: 'HS',
  'HIGH-SCHOOL': 'HS',
  RECRUIT: 'HS',
  PORTAL: 'PORTAL',
  COLLEGE: 'PORTAL',
  ROSTER: 'ROSTER',
};

/** Normalize external lifecycle query values. */
export function normalizeLifecycleInput(raw: unknown): NormalizedLifecycle | null {
  if (raw == null || raw === '') return null;
  const key = String(raw).trim().toUpperCase().replace(/[\s-]+/g, '_');
  return ALIAS_MAP[key] ?? null;
}

/** Postgres futurecast.players.status for HS-only queries. */
export function hsDbStatus(): 'HS' {
  return 'HS';
}

/** Postgres statuses for portal endpoints. */
export function portalDbStatuses(): readonly ('COLLEGE' | 'PORTAL')[] {
  return ['COLLEGE', 'PORTAL'];
}

export function isHsLifecycleValue(raw: unknown): boolean {
  const n = normalizeLifecycleInput(raw);
  return n === 'HS' || n === null;
}

export function lifecycleLabel(normalized: NormalizedLifecycle): string {
  if (normalized === 'HS') return 'HIGH_SCHOOL';
  return normalized;
}

/** API response lifecycle string (never null). */
export function toApiLifecycle(raw: unknown): 'HIGH_SCHOOL' | 'PORTAL' | 'ROSTER' {
  const n = normalizeLifecycleInput(raw);
  if (n === 'PORTAL') return 'PORTAL';
  if (n === 'ROSTER') return 'ROSTER';
  return 'HIGH_SCHOOL';
}

export function dbStatusFromApiLifecycle(api: string): 'HS' | 'PORTAL' | null {
  const n = normalizeLifecycleInput(api);
  if (n === 'HS') return 'HS';
  if (n === 'PORTAL') return 'PORTAL';
  return null;
}
