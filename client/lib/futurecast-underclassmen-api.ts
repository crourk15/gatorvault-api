import { apiFetch } from './api-fetch';
import type { FutureCastPlayer } from './futurecast-board-types';

export type UnderclassmenTier = 'target' | 'watchlist';

export type UnderclassmenPlayer = FutureCastPlayer & {
  classYear: number;
  tier: UnderclassmenTier;
  discoveryScore?: number | null;
  earlyMovement?: number;
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
  return apiFetch<UnderclassmenResponse>(`/api/futurecast/underclassmen${qs}`).catch(() => EMPTY);
}

export async function fetchFutureCastEarlyWatchlist(minYear = 2028): Promise<UnderclassmenResponse> {
  return apiFetch<UnderclassmenResponse>(
    `/api/futurecast/early-watchlist?class_year_gte=${minYear}`
  ).catch(() => EMPTY);
}
