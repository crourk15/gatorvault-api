/**
 * Early Discovery API — 2028+ underclassmen ranked by discovery_score.
 */
import { getApiBase } from './api-base';

export type RecruitingRatingSource = 'on3' | 'seed';

export interface EarlyDiscoveryPlayer {
  id: string;
  slug: string;
  fullName: string;
  classYear: number;
  position: string | null;
  state: string | null;
  stars: number | null;
  discoveryScore: number;
  ufFitScore: number | null;
  ufStatus: string | null;
  signalCount: number;
  rank: number;
  compositeScore?: number;
  nationalRank?: number | null;
  positionRank?: number | null;
  stateRank?: number | null;
  ratingSource?: RecruitingRatingSource | null;
  school?: string | null;
  inState?: boolean;
  /** Locked 2028 UF allowlist target (pinned in discovery feed). */
  allowlistTarget?: boolean;
  /** UF likelihood 0–1 for allowlist targets. */
  ufProbability?: number | null;
}

export interface EarlyDiscoveryQuery {
  class_year_gte?: number;
  min_discovery_score?: number;
  limit?: number;
  position?: string;
}

export interface EarlyDiscoveryResponse {
  ok: boolean;
  classYearGte: number;
  position?: string | null;
  count: number;
  players: EarlyDiscoveryPlayer[];
  updatedAt: string;
}

function buildParams(query: EarlyDiscoveryQuery): string {
  const params = new URLSearchParams();
  if (query.class_year_gte != null) params.set('class_year_gte', String(query.class_year_gte));
  if (query.min_discovery_score != null) params.set('min_discovery_score', String(query.min_discovery_score));
  if (query.limit != null) params.set('limit', String(query.limit));
  if (query.position) params.set('position', query.position);
  const qs = params.toString();
  return qs ? '?' + qs : '';
}

export function buildEarlyDiscoveryUrl(query: EarlyDiscoveryQuery = {}): string {
  return getApiBase() + '/api/futurecast/early-discovery' + buildParams(query);
}

export async function fetchEarlyDiscovery(query: EarlyDiscoveryQuery = {}): Promise<EarlyDiscoveryResponse> {
  const { apiFetch } = await import('./api-fetch');
  return apiFetch<EarlyDiscoveryResponse>('/api/futurecast/early-discovery' + buildParams(query));
}
