/**
 * FutureCast Predictions API client.
 */
import { getApiBase } from './big-board-api';

export type PredictionSourceType = 'MODEL' | 'STAFF' | 'FAN' | 'BLENDED';
export type PredictionStatus = 'ACTIVE' | 'HIT' | 'MISS' | 'WITHDRAWN';

export interface FeedPrediction {
  id: string;
  playerId: string;
  playerSlug: string;
  fullName: string;
  classYear: number;
  position: string;
  lifecycle: string | null;
  school: string;
  confidence: number;
  delta?: number;
  sourceType: PredictionSourceType;
  predictorId: string;
  status: PredictionStatus;
  createdAt: string;
  updatedAt: string;
  committedTo?: string | null;
  ufStatus?: string | null;
  ufFitScore?: number | null;
  ufProbability?: number | null;
  stabilityScore?: number;
  volatilityScore?: number;
}

export interface PlayerPrediction {
  id: string;
  school: string;
  confidence: number;
  delta?: number;
  sourceType: PredictionSourceType;
  predictorId: string;
  status: PredictionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PredictorLeaderboardEntry {
  predictorId: string;
  name: string;
  picks: number;
  hits: number;
  misses: number;
  hitRate: number;
}

export interface PredictionsFeedQuery {
  class_year?: number;
  position?: string;
  status?: PredictionStatus;
  limit?: number;
  refresh?: boolean;
  hsOnly?: boolean;
  portalOnly?: boolean;
  floridaOnly?: boolean;
  trendingUp?: boolean;
}

export interface StockBoardResponse {
  stockUp: FeedPrediction[];
  stockDown: FeedPrediction[];
  windowDays: number;
}

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${getApiBase()}${path}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || `API ${res.status}`);
  }
  return res.json() as Promise<T>;
}

function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
  const q = new URLSearchParams();
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== '') q.set(key, String(val));
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}

export async function fetchPredictionsFeed(
  query: PredictionsFeedQuery = {}
): Promise<FeedPrediction[]> {
  const data = await apiFetch<{ predictions: FeedPrediction[] }>(
    `/api/predictions${buildQuery({
      class_year: query.class_year,
      position: query.position,
      status: query.status,
      limit: query.limit,
      refresh: query.refresh ? 'true' : undefined,
      hsOnly: query.hsOnly ? 'true' : undefined,
      portalOnly: query.portalOnly ? 'true' : undefined,
      floridaOnly: query.floridaOnly ? 'true' : undefined,
      trendingUp: query.trendingUp ? 'true' : undefined,
    })}`
  );
  return data.predictions;
}

export async function fetchStockBoard(): Promise<StockBoardResponse> {
  return apiFetch<StockBoardResponse>('/api/futurecast/stock');
}

export interface MovementSnapshotsResponse {
  dailyUp: FeedPrediction[];
  dailyDown: FeedPrediction[];
  weeklyUp: FeedPrediction[];
  weeklyDown: FeedPrediction[];
  dailyWindowDays: number;
  weeklyWindowDays: number;
}

export async function fetchMovementSnapshots(): Promise<MovementSnapshotsResponse> {
  return apiFetch<MovementSnapshotsResponse>('/api/futurecast/snapshots');
}

export interface MovementHeatmapBucket {
  label: string;
  count: number;
}

export interface MovementHeatmapResponse {
  buckets: MovementHeatmapBucket[];
  windowDays: number;
}

export async function fetchMovementHeatmap(): Promise<MovementHeatmapResponse> {
  return apiFetch<MovementHeatmapResponse>('/api/futurecast/heatmap');
}

export async function fetchPlayerPredictions(playerId: string): Promise<PlayerPrediction[]> {
  const data = await apiFetch<{ playerId: string; predictions: PlayerPrediction[] }>(
    `/api/predictions/player/${encodeURIComponent(playerId)}`
  );
  return data.predictions;
}

export async function fetchPredictorLeaderboard(): Promise<PredictorLeaderboardEntry[]> {
  const data = await apiFetch<{ predictors: PredictorLeaderboardEntry[] }>(
    '/api/predictors/leaderboard'
  );
  return data.predictors;
}

export function sourceTypeLabel(source: PredictionSourceType): string {
  switch (source) {
    case 'MODEL':
      return 'Model';
    case 'STAFF':
      return 'Staff';
    case 'FAN':
      return 'Fan';
    case 'BLENDED':
      return 'Blended';
    default:
      return source;
  }
}

export function statusLabel(status: PredictionStatus): string {
  switch (status) {
    case 'ACTIVE':
      return 'Active';
    case 'HIT':
      return 'Hit';
    case 'MISS':
      return 'Miss';
    case 'WITHDRAWN':
      return 'Withdrawn';
    default:
      return status;
  }
}
