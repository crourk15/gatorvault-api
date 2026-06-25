/**
 * FutureCast page API — unified client layer for /vault/futurecast.
 */
import { ApiFetchError } from '@/lib/api-fetch';
import { snapshotFirstFetch, snapshotLiveFetch } from '@/lib/snapshot-fetch';
import { fetchFutureCastMasterBoard } from '@/lib/futurecast-board-api';
import type { FutureCastPlayer } from '@/lib/futurecast-board-types';
import {
  fetchFutureCastClass,
  fetchFutureCastHome,
  fetchFutureCastPredictions,
  loadFutureCastWidgetBundle,
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
  visitIntelCount?: number;
  visitRecapCount?: number;
  flipWatchCount?: number;
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
  highPriorityLastUpdated: string | null;
  stock: StockBoardResponse;
  snapshots: MovementSnapshotsResponse;
  summary: FutureCastPageSummary;
  metrics: FutureCastHeroMetrics;
  heatLevel: FutureCastHeatLevel;
  loadWarnings: string[];
};

export {
  fetchFutureCastHome,
  fetchFutureCastClass,
  fetchFutureCastPredictions,
  fetchStockBoard as fetchFutureCastStock,
  fetchMovementSnapshots as fetchFutureCastSnapshots,
};

const EMPTY_HOME: FutureCastHomeResponse = {
  classYear: FUTURECAST_WIDGET_YEAR,
  commitSort: 'fit',
  heatmap: { buckets: [], windowDays: 7 },
  commits: [],
  topTargets: [],
  trendingUp: [],
  trendingDown: [],
  portalWatchlist: [],
};

const EMPTY_CLASS: FutureCastClassResponse = {
  classYear: FUTURECAST_WIDGET_YEAR,
  commitCount: 0,
  targetCount: 0,
  blueChips: 0,
  inStatePct: 0,
  rankings: null,
  classImpactScore: null,
  teamImpactScore: null,
};

const EMPTY_PREDICTIONS: FutureCastPredictionsResponse = {
  classYear: FUTURECAST_WIDGET_YEAR,
  predictions: [],
  predictors: [],
  windowDays: 7,
};

const EMPTY_STOCK: StockBoardResponse = { stockUp: [], stockDown: [], windowDays: 7 };

const EMPTY_SNAPSHOTS: MovementSnapshotsResponse = {
  dailyUp: [],
  dailyDown: [],
  weeklyUp: [],
  weeklyDown: [],
  dailyWindowDays: 1,
  weeklyWindowDays: 7,
};

export async function fetchFutureCastTargets(
  year = FUTURECAST_WIDGET_YEAR,
  limit = 50
): Promise<FutureCastTargetsResponse> {
  const path = `/api/futurecast/targets?class_year=${year}&limit=${limit}`;
  return snapshotFirstFetch(path, () => snapshotLiveFetch<FutureCastTargetsResponse>(path));
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

function boardPlayerToHighPriority(p: FutureCastPlayer): HighPriorityPlayer {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    position: p.position,
    school: p.school ?? null,
    htWt: null,
    stars: p.stars,
    headliner: false,
    committedTo: null,
    compositeScore: p.composite,
    nationalRank: p.natlRank ?? null,
    positionRank: p.posRank ?? null,
    stateRank: p.stateRank ?? null,
    rating: p.composite,
    natlRank: p.natlRank ?? null,
    posRank: p.posRank ?? null,
    movementDelta: p.trendDelta7d ?? 0,
    delta7d: p.trendDelta7d ?? 0,
    insiderNotes: null,
    notePreview: null,
    skinny: null,
    visitHistory: [],
    ufOvStatus: null,
    visitStart: null,
    visitEnd: null,
    trendHistory: [],
    predictors: [],
    ufProbability: p.ufConfidence ?? 0,
    staffConfidence: 0,
    fitScore: p.fitScore ?? 0,
    priorityScore: 0,
  };
}

function boardPlayerToFeedPrediction(p: FutureCastPlayer): FeedPrediction {
  return {
    id: p.id,
    playerId: p.id,
    playerSlug: p.slug,
    fullName: p.name,
    classYear: p.classYear,
    position: p.position,
    lifecycle: 'HS',
    school: p.school ?? '—',
    confidence: p.ufConfidence ?? 0,
    delta: p.trendDelta7d ?? undefined,
    sourceType: 'MODEL',
    predictorId: 'futurecast',
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ufProbability: p.ufConfidence,
    ufFitScore: p.fitScore,
    volatilityScore: p.volatility7d,
    compositeScore: p.composite,
    nationalRank: p.natlRank ?? null,
    positionRank: p.posRank ?? null,
    stateRank: p.stateRank ?? null,
    rating: p.composite,
    natlRank: p.natlRank ?? null,
    posRank: p.posRank ?? null,
    stars: p.stars,
  };
}

function endpointErrorLabel(err: unknown): string {
  if (err instanceof ApiFetchError) {
    if (err.status === 502 || err.status === 503) return 'API temporarily unavailable (502/503)';
    if (err.timedOut) return 'Request timed out';
    return err.message;
  }
  return err instanceof Error ? err.message : 'Request failed';
}

async function settle<T>(
  label: string,
  fn: () => Promise<T>,
  warnings: string[]
): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    warnings.push(`${label}: ${endpointErrorLabel(err)}`);
    return null;
  }
}

function buildPageData(
  home: FutureCastHomeResponse,
  classData: FutureCastClassResponse,
  predictions: FutureCastPredictionsResponse,
  targets: FeedPrediction[],
  highPriority: HighPriorityPlayer[],
  stock: StockBoardResponse,
  snapshots: MovementSnapshotsResponse,
  warnings: string[],
  highPriorityLastUpdated: string | null = null
): FutureCastPageData {
  const resolvedTargets = targets.length ? targets : home.topTargets ?? [];

  return {
    home,
    classData,
    predictions,
    targets: resolvedTargets,
    highPriority,
    highPriorityLastUpdated,
    stock,
    snapshots,
    summary: {
      classYear: FUTURECAST_WIDGET_YEAR,
      commitCount: home.commits?.length ?? classData.commitCount ?? 0,
      targetCount: resolvedTargets.length || classData.targetCount || 0,
      nationalRank: classData.rankings?.nationalRank ?? null,
    },
    metrics: {
      avgUFProbability: avgUfProbability(resolvedTargets.length ? resolvedTargets : home.topTargets ?? []),
      highPriorityCount: highPriority.length,
      activePredictions: predictions.predictions?.length ?? 0,
    },
    heatLevel: deriveHeatLevel(home, stock),
    loadWarnings: warnings,
  };
}

/**
 * Resilient orchestrator — uses cached widget bundle + optional endpoints.
 * Never fails the whole page when a single endpoint returns 502.
 */
export async function loadFutureCastPageData(): Promise<FutureCastPageData> {
  const year = FUTURECAST_WIDGET_YEAR;
  const warnings: string[] = [];

  const { bundle, meta } = await loadFutureCastWidgetBundle({ predictionsLimit: 24, preferCache: true });
  if (meta.fromCache) {
    warnings.push('Showing cached FutureCast data — live API was unavailable.');
  }
  if (meta.errorCode === 'offline') {
    warnings.push('FutureCast API returned 502/503 — some sections may be stale or empty.');
  }
  if (meta.timedOut) {
    warnings.push('FutureCast API timed out — retrying in the background.');
  }

  let home = bundle?.home ?? null;
  let classData = bundle?.classData ?? null;
  let predictions = bundle?.predictions ?? null;

  if (!home || !classData || !predictions) {
    const master = await settle('master-board', () => fetchFutureCastMasterBoard(), warnings);
    if (master) {
      home = {
        ...EMPTY_HOME,
        commits: [],
        topTargets: master.players.map(boardPlayerToFeedPrediction),
        trendingUp: master.movementSummary.riserPlayers.map(boardPlayerToFeedPrediction),
        trendingDown: master.movementSummary.fallerPlayers.map(boardPlayerToFeedPrediction),
        heatmap: master.heatmap,
        portalWatchlist: [],
      };
      classData = {
        ...EMPTY_CLASS,
        commitCount: master.commitWatch.length,
        targetCount: master.players.length,
      };
      predictions = {
        ...EMPTY_PREDICTIONS,
        predictions: master.players.slice(0, 24).map(boardPlayerToFeedPrediction),
      };
      if (!warnings.some((w) => w.includes('master-board'))) {
        warnings.push('Loaded from /api/futurecast/master-board fallback.');
      }
    }
  }

  if (!home || !classData || !predictions) {
    throw new ApiFetchError(
      'FutureCast data is temporarily unavailable. The API returned 502 — please try again shortly.',
      { status: 502, unavailable: true }
    );
  }

  const [targetsRes, highPriorityRes, stock, snapshots] = await Promise.all([
    settle('targets', () => fetchFutureCastTargets(year, 50), warnings),
    settle('high-priority', () => fetchHighPriorityTargets(year), warnings),
    settle('stock', () => fetchStockBoard(), warnings),
    settle('snapshots', () => fetchMovementSnapshots(), warnings),
  ]);

  let targets = targetsRes?.targets ?? [];
  let highPriority = highPriorityRes?.players ?? [];

  if (!highPriority.length && home.topTargets?.length) {
    highPriority = (await settle('master-board-hp', () => fetchFutureCastMasterBoard(), warnings))
      ?.highPriority.players.map(boardPlayerToHighPriority) ?? [];
  }

  return buildPageData(
    home,
    classData,
    predictions,
    targets,
    highPriority,
    stock ?? EMPTY_STOCK,
    snapshots ?? EMPTY_SNAPSHOTS,
    warnings,
    highPriorityRes?.lastUpdated ?? highPriorityRes?.updatedAt ?? null
  );
}
