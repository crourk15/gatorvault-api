/**
 * FutureCast Lab hero "Updated" stamp.
 *
 * Master-board disk/seed can sit at Aug 7 while HP / movement keep moving.
 * Never advertise a plate older than the chase freshness window.
 */

export const LAB_UPDATED_MAX_AGE_MS = 36 * 60 * 60 * 1000; // 36h — same as HP_DISK_MAX_AGE_MS

export function newestIsoTimestamp(...stamps: Array<string | null | undefined>): string | null {
  let max = Number.NaN;
  for (const stamp of stamps) {
    const t = Date.parse(String(stamp || ''));
    if (!Number.isFinite(t)) continue;
    if (!Number.isFinite(max) || t > max) max = t;
  }
  return Number.isFinite(max) ? new Date(max).toISOString() : null;
}

export function liveLabTimestamp(
  stamp: string | null | undefined,
  nowMs = Date.now(),
  maxAgeMs = LAB_UPDATED_MAX_AGE_MS
): string | null {
  const t = Date.parse(String(stamp || ''));
  if (!Number.isFinite(t)) return null;
  if (nowMs - t > maxAgeMs) return null;
  return String(stamp);
}

export function resolveLabLastUpdated(input: {
  masterUpdatedAt?: string | null;
  movementUpdatedAt?: string | null;
  highPriorityUpdatedAt?: string | null;
  nowMs?: number;
}): string | null {
  const nowMs = input.nowMs ?? Date.now();
  return newestIsoTimestamp(
    liveLabTimestamp(input.highPriorityUpdatedAt, nowMs),
    liveLabTimestamp(input.movementUpdatedAt, nowMs),
    liveLabTimestamp(input.masterUpdatedAt, nowMs)
  );
}
