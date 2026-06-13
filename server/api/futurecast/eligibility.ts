/**
 * FutureCast cycle eligibility — 2027 class only; exclude enrolled Gators.
 */
export const FUTURECAST_CLASS_YEAR = 2027;

export function isFloridaSchool(value: string | null | undefined): boolean {
  if (!value) return false;
  return /\bflorida\b/i.test(String(value).replace(/\s+/g, ' ').trim());
}

/** Player already on the UF roster (2026 enrollees, portal arrivals, etc.). */
export function isEnrolledAtFlorida(row: {
  lifecycle?: string | null;
  committed_to?: string | null;
}): boolean {
  if (!isFloridaSchool(row.committed_to)) return false;
  const lifecycle = String(row.lifecycle ?? '').toUpperCase();
  return lifecycle === 'COLLEGE' || lifecycle === 'PORTAL';
}

export function isFutureCastEligible(row: {
  class_year: number;
  lifecycle?: string | null;
  committed_to?: string | null;
}): boolean {
  if (row.class_year !== FUTURECAST_CLASS_YEAR) return false;
  if (isEnrolledAtFlorida(row)) return false;
  return true;
}

export function isUfCommitRow(row: {
  lifecycle?: string | null;
  committed_to?: string | null;
  committedTo?: string | null;
  uf_status?: string | null;
  ufStatus?: string | null;
}): boolean {
  if (String(row.lifecycle ?? '').toUpperCase() !== 'HS') return false;
  const status = String(row.uf_status ?? row.ufStatus ?? '').toUpperCase();
  const committed = row.committed_to ?? row.committedTo ?? null;
  if (status === 'COMMITTED') return true;
  if (!isFloridaSchool(committed)) return false;
  if (status === 'TARGET' || status === 'OFFERED' || status === 'WATCH') return false;
  return true;
}

export function isTopTargetRow(row: {
  lifecycle?: string | null;
  committed_to?: string | null;
  uf_status?: string | null;
  school?: string | null;
}): boolean {
  if (String(row.lifecycle ?? '').toUpperCase() !== 'HS') return false;
  if (isUfCommitRow(row)) return false;
  return isFloridaSchool(row.school);
}

/** HS-only rows for FutureCast homepage sections (no portal/college leak). */
export function isHsLifecycle(row: { lifecycle?: string | null }): boolean {
  return String(row.lifecycle ?? '').toUpperCase() === 'HS';
}

/** Trending Up/Down — uncommitted HS prospects only (commits live in UF Commits section). */
export function isTrendingEligibleRow(row: {
  lifecycle?: string | null;
  committed_to?: string | null;
  uf_status?: string | null;
}): boolean {
  if (!isHsLifecycle(row)) return false;
  return !isUfCommitRow(row);
}

export function dedupeByPlayerId<T extends { playerId: string; confidence?: number }>(
  rows: T[]
): T[] {
  const best = new Map<string, T>();
  for (const row of rows) {
    const existing = best.get(row.playerId);
    if (!existing || (row.confidence ?? 0) > (existing.confidence ?? 0)) {
      best.set(row.playerId, row);
    }
  }
  return [...best.values()];
}

export function stabilityScore(volatilityScore: number): number {
  return Math.max(0, Math.min(100, 100 - volatilityScore));
}
