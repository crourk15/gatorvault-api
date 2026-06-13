/**
 * FutureCast homepage API — grouped 2027 sections.
 */
import { getApiBase } from './big-board-api';
import type { FeedPrediction } from './predictions-api';
import type { MovementHeatmapBucket } from './predictions-api';

export type CommitSort = 'fit' | 'stability';

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
