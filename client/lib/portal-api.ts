/**
 * Portal Intelligence API client.
 */
import { getApiBase } from './big-board-api';

export type PortalWatchlistSort = 'likelihood' | 'volatility' | 'depthChartRisk';

export interface PortalWatchlistPlayer {
  id: string;
  fullName: string;
  slug: string;
  position: string;
  classYear: number;
  portalLikelihood: number;
  depthChartRisk: number;
  snapShare: number | null;
  volatility: number;
  rank: number;
}

export interface TransferPrediction {
  school: string;
  score: number;
}

export interface PortalIntelPayload {
  portalLikelihood: number;
  depthChartRisk: number;
  snapShareScore: number;
  snapShare: number | null;
  volatility: number;
  likelihoodTrend: Array<{ date: string; likelihood: number }>;
}

export interface PortalPredictionsResponse {
  playerId: string;
  predictions: TransferPrediction[];
  intel: PortalIntelPayload;
}

export interface PortalWatchlistQuery {
  class_year?: number;
  position?: string;
  limit?: number;
  sort?: PortalWatchlistSort;
  likelihood_min?: number;
  likelihood_max?: number;
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

export function buildPortalWatchlistUrl(query: PortalWatchlistQuery = {}): string {
  const params = new URLSearchParams();
  if (query.class_year != null) params.set('class_year', String(query.class_year));
  if (query.position) params.set('position', query.position);
  if (query.limit != null) params.set('limit', String(query.limit));
  if (query.sort) params.set('sort', query.sort);
  if (query.likelihood_min != null) params.set('likelihood_min', String(query.likelihood_min));
  if (query.likelihood_max != null) params.set('likelihood_max', String(query.likelihood_max));
  const qs = params.toString();
  return `${getApiBase()}/api/portal/watchlist${qs ? `?${qs}` : ''}`;
}

export async function fetchPortalWatchlist(
  query: PortalWatchlistQuery = {}
): Promise<{ players: PortalWatchlistPlayer[] }> {
  const params = new URLSearchParams();
  if (query.class_year != null) params.set('class_year', String(query.class_year));
  if (query.position) params.set('position', query.position);
  if (query.limit != null) params.set('limit', String(query.limit));
  if (query.sort) params.set('sort', query.sort);
  if (query.likelihood_min != null) params.set('likelihood_min', String(query.likelihood_min));
  if (query.likelihood_max != null) params.set('likelihood_max', String(query.likelihood_max));
  const qs = params.toString();
  return apiFetch(`/api/portal/watchlist${qs ? `?${qs}` : ''}`);
}

export async function fetchPortalPredictions(
  playerId: string
): Promise<PortalPredictionsResponse> {
  return apiFetch(`/api/portal/predictions/${playerId}`);
}

export function portalLikelihoodBand(pct: number): 'high' | 'medium' | 'low' {
  if (pct >= 70) return 'high';
  if (pct >= 40) return 'medium';
  return 'low';
}

export function portalLikelihoodPct(value: number): number {
  return Math.round((value <= 1 ? value * 100 : value));
}
