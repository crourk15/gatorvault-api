/**
 * FutureCast page API — unified client layer for /vault/futurecast.
 */
import { apiFetch } from '@/lib/api-fetch';
import {
  fetchFutureCastClass,
  fetchFutureCastHome,
  fetchFutureCastPredictions,
  type FutureCastClassResponse,
  type FutureCastHomeResponse,
  type FutureCastPredictionsResponse,
  FUTURECAST_WIDGET_YEAR,
} from '@/lib/futurecast-home-api';
import { fetchHighPriorityTargets, type HighPriorityPlayer } from '@/lib/futurecast-high-priority-api';
import {
  fetchMovementSnapshots,
  fetchStockBoard,
  type FeedPrediction,
  type MovementSnapshotsResponse,
  type StockBoardResponse,
} from '@/lib/predictions-api';

export type FutureCastHeatLevel = 'cold' | 'warm' | 'hot';

export type FutureCastHeroMetrics = {
  avgUFProbability: number;
  highPriorityCount: number;
  activePredictions: number;
};

export type FutureCastPageSummary = {
  classYear: number;
  commitCount: number;
  targetCount: number;
  nationalRank: number | null;
};

export type FutureCastTargetsResponse = {
  classYear: number;
  count: number;
  targets: FeedPrediction[];
};

export type FutureCastPageData = {
  home: FutureCastHomeResponse;
  classData: FutureCastClassResponse;
  predictions: FutureCastPredictionsResponse;
  targets: FeedPrediction[];
  highPriority: HighPriorityPlayer[];
  stock: StockBoardResponse;
  snapshots: MovementSnapshotsResponse;
  summary: FutureCastPageSummary;
  metrics: FutureCastHeroMetrics;
  heatLevel: FutureCastHeatLevel;
};

export {
  fetchFutureCastHome,
  fetchFutureCastClass,
  fetchFutureCastPredictions,
  fetchStockBoard as fetchFutureCastStock,
  fetchMovementSnapshots as fetchFutureCastSnapshots,
};

export async function fetchFutureCastTargets(
  year = FUTURECAST_WIDGET_YEAR,
  limit = 50
): Promise<FutureCastTargetsResponse> {
  return apiFetch<FutureCastTargetsResponse>(
    `/api/futurecast/targets?class_year=${year}&limit=${limit}`
  );
}

function avgUfProbability(players: Array<{ ufProbability?: number | null; confidence?: number }>): number {
  if (!players.length) return 0;
  const sum = players.reduce((acc, p) => {
    const raw = p.ufProbability ?? p.confidence ?? 0;
    const pct = raw <= 1 ? raw * 100 : raw;
    return acc + pct;
  }, 0);
  return Math.round(sum / players.length);
}

export function deriveHeatLevel(
  home: FutureCastHomeResponse,
  stock: StockBoardResponse
): FutureCastHeatLevel {
  const rising = (stock.stockUp?.length ?? 0) + (home.trendingUp?.length ?? 0);
  const falling = (stock.stockDown?.length ?? 0) + (home.trendingDown?.length ?? 0);
  if (rising >= falling + 4) return 'hot';
  if (falling >= rising + 4) return 'cold';
  return 'warm';
}

export async function loadFutureCastPageData(): Promise<FutureCastPageData> {
  const year = FUTURECAST_WIDGET_YEAR;
  const [home, classData, predictions, targetsRes, highPriorityRes, stock, snapshots] =
    await Promise.all([
      fetchFutureCastHome(),
      fetchFutureCastClass(year),
      fetchFutureCastPredictions(year, 24),
      fetchFutureCastTargets(year, 50),
      fetchHighPriorityTargets(year),
      fetchStockBoard(),
      fetchMovementSnapshots(),
    ]);

  const targets = targetsRes.targets?.length ? targetsRes.targets : home.topTargets ?? [];
  const highPriority = highPriorityRes.players ?? [];

  return {
    home,
    classData,
    predictions,
    targets,
    highPriority,
    stock,
    snapshots,
    summary: {
      classYear: year,
      commitCount: home.commits?.length ?? classData.commitCount ?? 0,
      targetCount: targets.length || classData.targetCount || 0,
      nationalRank: classData.rankings?.nationalRank ?? null,
    },
    metrics: {
      avgUFProbability: avgUfProbability(targets.length ? targets : home.topTargets ?? []),
      highPriorityCount: highPriority.length,
      activePredictions: predictions.predictions?.length ?? 0,
    },
    heatLevel: deriveHeatLevel(home, stock),
  };
}
