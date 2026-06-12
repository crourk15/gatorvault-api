/**
 * UF Fit Intelligence API client.
 */
import { getApiBase } from './big-board-api';

export type FitTier = 'elite' | 'strong' | 'moderate' | 'low';
export type UfFitWatchlistSort = 'ufFitScore' | 'fitDelta' | 'fitVolatility';

export interface UfFitWatchlistPlayer {
  id: string;
  fullName: string;
  slug: string;
  position: string;
  classYear: number;
  ufFitScore: number;
  fitTier: FitTier;
  fitDelta: number;
  fitVolatility: number;
  rank: number;
}

export interface UfFitHistoryPoint {
  date: string;
  score: number;
}

export interface UfFitIntelResponse {
  playerId: string;
  ufFitScore: number;
  fitTier: FitTier;
  schemeFit: number;
  cultureFit: number;
  positionalNeed: number;
  staffInterest: number;
  fitDelta: number;
  fitVolatility: number;
  history: UfFitHistoryPoint[];
}

export interface UfFitWatchlistQuery {
  class_year?: number;
  position?: string;
  tier?: FitTier;
  minScore?: number;
  maxScore?: number;
  sort?: UfFitWatchlistSort;
  limit?: number;
}

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${getApiBase()}${path}`);
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export async function fetchUfFitWatchlist(
  query: UfFitWatchlistQuery = {}
): Promise<{ players: UfFitWatchlistPlayer[] }> {
  const params = new URLSearchParams();
  if (query.class_year != null) params.set('class_year', String(query.class_year));
  if (query.position) params.set('position', query.position);
  if (query.tier) params.set('tier', query.tier);
  if (query.minScore != null) params.set('minScore', String(query.minScore));
  if (query.maxScore != null) params.set('maxScore', String(query.maxScore));
  if (query.sort) params.set('sort', query.sort);
  if (query.limit != null) params.set('limit', String(query.limit));
  const qs = params.toString();
  return apiFetch(`/api/uf-fit/watchlist${qs ? `?${qs}` : ''}`);
}

export async function fetchUfFitIntel(playerId: string): Promise<UfFitIntelResponse> {
  return apiFetch(`/api/uf-fit/${playerId}`);
}

export function fitTierLabel(tier: FitTier): string {
  const labels: Record<FitTier, string> = {
    elite: 'Elite',
    strong: 'Strong',
    moderate: 'Moderate',
    low: 'Low',
  };
  return labels[tier];
}

export function fitTierFromScore(score: number): FitTier {
  if (score >= 85) return 'elite';
  if (score >= 70) return 'strong';
  if (score >= 50) return 'moderate';
  return 'low';
}

export function formatFitDelta(delta: number): string {
  if (delta > 0) return `+${delta}`;
  return String(delta);
}
