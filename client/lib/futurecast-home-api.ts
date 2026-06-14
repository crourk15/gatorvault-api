/**
 * FutureCast homepage API — grouped 2027 sections + class + predictions.
 */
import { getApiBase } from './big-board-api';
import type { FeedPrediction, PredictorLeaderboardEntry } from './predictions-api';
import type { MovementHeatmapBucket } from './predictions-api';

export type CommitSort = 'fit' | 'stability';

export interface TrendHistoryPoint {
  date: string;
  confidence: number;
}

export interface FeedPredictionWithHistory extends FeedPrediction {
  trendHistory?: TrendHistoryPoint[];
}

export interface FutureCastClassResponse {
  classYear: number;
  commitCount: number;
  targetCount: number;
  blueChips: number;
  inStatePct: number;
  rankings: {
    nationalRank: number | null;
    secRank: number | null;
    classScore: number | null;
    source: string | null;
    updatedAt: string | null;
  } | null;
  classImpactScore: number | null;
  teamImpactScore: number | null;
}

export interface FutureCastPredictionsResponse {
  classYear: number;
  predictions: FeedPredictionWithHistory[];
  predictors: PredictorLeaderboardEntry[];
  windowDays: number;
}

export interface PortalWatchlistHomePlayer {
  id: string;
  fullName: string;
  slug: string;
  position: string;
  classYear: number;
  portalLikelihood: number;
  depthChartRisk: number;
  volatility: number;
  rank: number;
}

export interface FutureCastHomeResponse {
  classYear: number;
  commitSort: CommitSort;
  heatmap: {
    buckets: MovementHeatmapBucket[];
    windowDays: number;
  };
  commits: FeedPrediction[];
  commitTotal?: number;
  topTargets: FeedPrediction[];
  trendingUp: FeedPrediction[];
  trendingDown: FeedPrediction[];
  portalWatchlist: PortalWatchlistHomePlayer[];
}

export async function fetchFutureCastHome(
  commitSort: CommitSort = 'fit'
): Promise<FutureCastHomeResponse> {
  const params = new URLSearchParams();
  if (commitSort === 'stability') params.set('commitSort', 'stability');
  const qs = params.toString();
  const res = await fetch(`${getApiBase()}/api/futurecast/home${qs ? `?${qs}` : ''}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || `API ${res.status}`);
  }
  return res.json() as Promise<FutureCastHomeResponse>;
}

export async function fetchFutureCastClass(
  year = 2027
): Promise<FutureCastClassResponse> {
  const res = await fetch(`${getApiBase()}/api/futurecast/class?year=${year}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || `API ${res.status}`);
  }
  return res.json() as Promise<FutureCastClassResponse>;
}

export async function fetchFutureCastPredictions(
  year = 2027,
  limit = 6
): Promise<FutureCastPredictionsResponse> {
  const params = new URLSearchParams({ year: String(year), limit: String(limit) });
  const res = await fetch(`${getApiBase()}/api/futurecast/predictions?${params}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || `API ${res.status}`);
  }
  return res.json() as Promise<FutureCastPredictionsResponse>;
}
