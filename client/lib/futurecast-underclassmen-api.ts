import { apiFetch } from './api-fetch';
import { snapshotFirstFetch, snapshotLiveFetch, DEFAULT_SNAPSHOT_FETCH_OPTS } from './snapshot-fetch';
import type { FutureCastPlayer } from './futurecast-board-types';

export type UnderclassmenTier = 'target' | 'watchlist';

export type UnderclassmenPlayer = FutureCastPlayer & {
  classYear: number;
  tier: UnderclassmenTier;
  discoveryScore?: number | null;
  earlyMovement?: number | null;
  allowlistTarget?: boolean;
};

export type UnderclassmenClassBucket = {
  classYear: number;
  targets: UnderclassmenPlayer[];
  watchlist: UnderclassmenPlayer[];
  earlyMovement: UnderclassmenPlayer[];
  count: number;
};

export type UnderclassmenResponse = {
  ok: boolean;
  updatedAt: string;
  years: number[];
  classes: Record<string, UnderclassmenClassBucket>;
  players: UnderclassmenPlayer[];
  empty?: boolean;
  message?: string;
};

const EMPTY: UnderclassmenResponse = {
  ok: true,
  updatedAt: new Date().toISOString(),
  years: [2028, 2029, 2030],
  classes: {},
  players: [],
  empty: true,
};

export async function fetchFutureCastUnderclassmen(
  years: number[] = [2028, 2029, 2030]
): Promise<UnderclassmenResponse> {
  const qs = years.length ? `?years=${years.join(',')}` : '';
  const path = `/api/futurecast/underclassmen${qs}`;
  return snapshotFirstFetch(path, () =>
    snapshotLiveFetch<UnderclassmenResponse>(path, DEFAULT_SNAPSHOT_FETCH_OPTS)
  ).catch(() => EMPTY);
}

export async function fetchFutureCastEarlyWatchlist(minYear = 2028): Promise<UnderclassmenResponse> {
  return apiFetch<UnderclassmenResponse>(
    `/api/futurecast/early-watchlist?class_year_gte=${minYear}`
  ).catch(() => EMPTY);
}

export type UnderclassmenIntelPick = {
  id: string;
  school: string;
  confidence: number;
  delta?: number;
  sourceType: 'MODEL' | 'STAFF' | 'FAN' | 'BLENDED';
  predictorId: string;
  status: 'ACTIVE' | 'HIT' | 'MISS' | 'WITHDRAWN';
  createdAt: string;
  updatedAt: string;
};

export type UnderclassmenIntelResponse = {
  ok: boolean;
  intelUuid: string;
  slug: string;
  classYear: number;
  earlyFutureCastPicks: UnderclassmenIntelPick[];
  error?: string;
};

export async function fetchUnderclassmenIntel(slug: string): Promise<UnderclassmenIntelResponse | null> {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return null;
  try {
    return await apiFetch<UnderclassmenIntelResponse>(
      `/api/futurecast/underclassmen/intel/${encodeURIComponent(normalized)}`
    );
  } catch {
    return null;
  }
}
