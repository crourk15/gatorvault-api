/**
 * Early Discovery API — 2028+ underclassmen ranked by discovery_score.
 */
import { getApiBase } from './api-base';

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
}

export interface EarlyDiscoveryQuery {
  class_year_gte?: number;
  min_discovery_score?: number;
  limit?: number;
  /** Client-side filter only (not sent to API until server supports ?position=). */
  position?: string;
}

export interface EarlyDiscoveryResponse {
  ok: boolean;
  classYearGte: number;
  count: number;
  players: EarlyDiscoveryPlayer[];
  updatedAt: string;
}

function buildParams(query: EarlyDiscoveryQuery): string {
  const params = new URLSearchParams();
  if (query.class_year_gte != null) params.set('class_year_gte', String(query.class_year_gte));
  if (query.min_discovery_score != null) params.set('min_discovery_score', String(query.min_discovery_score));
  if (query.limit != null) params.set('limit', String(query.limit));
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
