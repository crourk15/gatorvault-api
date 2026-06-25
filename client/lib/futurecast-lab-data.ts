/**
 * FutureCast Lab — prediction-engine data map (FutureCast APIs only).
 */
import { fetchFutureCastHome, type FutureCastHomeResponse } from './futurecast-home-api';
import type {
  MasterBoardResponse,
  MovementIntelResponse,
  StaffNotesResponse,
  TrendingBoardResponse,
} from './futurecast-board-types';
import type { FutureCastHeatLevel, FutureCastHeroMetrics, FutureCastPageSummary } from './api/futurecast';
import { deriveHeatLevel } from './api/futurecast';
import { fetchStockBoard, type StockBoardResponse } from './predictions-api';
import {
  fetchHighPriorityTargets,
  type HighPriorityPlayer,
  type HighPriorityResponse,
  type VisitRecapRow,
} from './futurecast-high-priority-api';
import {
  fetchFutureCastUnderclassmen,
  type UnderclassmenPlayer,
} from './futurecast-underclassmen-api';
import { fetchWithWarmPoll } from './api-warm-poll';
import { snapshotLiveFetch, DEFAULT_SNAPSHOT_FETCH_OPTS } from './snapshot-fetch';

const EMPTY_STOCK: StockBoardResponse = { stockUp: [], stockDown: [], windowDays: 7 };
const EMPTY_HIGH_PRIORITY: HighPriorityResponse = {
  players: [],
  classYear: 2027,
  count: 0,
  updatedAt: new Date().toISOString(),
  visitIntel: [],
  visitRecap: [],
};
const LAB_FETCH_OPTS = DEFAULT_SNAPSHOT_FETCH_OPTS;

function warmFetch<T>(path: string): Promise<T> {
  return fetchWithWarmPoll(() => snapshotLiveFetch<T>(path, LAB_FETCH_OPTS));
}

function settled<T>(result: PromiseSettledResult<T>, fallback: T): T {
  return result.status === 'fulfilled' ? result.value : fallback;
}

export type FutureCastLabDataMap = {
  masterBoard: MasterBoardResponse;
  trendingBoard: TrendingBoardResponse;
  movementIntel: MovementIntelResponse;
  staffNotes: StaffNotesResponse;
  home: FutureCastHomeResponse;
  stock: StockBoardResponse;
  summary: FutureCastPageSummary;
  metrics: FutureCastHeroMetrics;
  heatLevel: FutureCastHeatLevel;
  lastUpdated: string | null;
  highPriority: HighPriorityPlayer[];
  visitIntel: HighPriorityPlayer[];
  visitRecap: VisitRecapRow[];
  underclassmen: UnderclassmenPlayer[];
};

function buildSummary(master: MasterBoardResponse): FutureCastPageSummary {
  return {
    classYear: master.classYear,
    commitCount: master.commitWatch.length,
    targetCount: master.players.length,
    nationalRank: null,
  };
}

function buildMetrics(master: MasterBoardResponse): FutureCastHeroMetrics {
  return {
    avgUFProbability: Math.round(master.ufConfidenceAverage ?? 0),
    highPriorityCount: master.highPriority.players.length,
    activePredictions: master.players.length,
  };
}

export async function loadFutureCastLabSecondary(
  master: MasterBoardResponse
): Promise<Omit<FutureCastLabDataMap, 'masterBoard' | 'summary' | 'metrics'>> {
  const secondary = await loadFutureCastLabSecondaryRaw();
  return {
    ...secondary,
    heatLevel: deriveHeatLevel(secondary.home, secondary.stock),
    lastUpdated: master.updatedAt ?? secondary.movementIntel.updatedAt ?? null,
  };
}

async function loadFutureCastLabSecondaryRaw(): Promise<
  Omit<FutureCastLabDataMap, 'masterBoard' | 'summary' | 'metrics' | 'heatLevel' | 'lastUpdated'>
> {
  const [trendingR, movementR, staffR, homeR, stockR, highPriorityR, underclassmenR] =
    await Promise.allSettled([
      warmFetch<TrendingBoardResponse>('/api/futurecast/trending'),
      warmFetch<MovementIntelResponse>('/api/futurecast/movement-intel'),
      warmFetch<StaffNotesResponse>('/api/futurecast/staff-notes?year=2027'),
      warmFetch<FutureCastHomeResponse>('/api/futurecast/home'),
      fetchStockBoard().catch(() => EMPTY_STOCK),
      fetchHighPriorityTargets().catch(() => EMPTY_HIGH_PRIORITY),
      fetchFutureCastUnderclassmen([2028, 2029, 2030]).catch(() => ({
        ok: true,
        updatedAt: new Date().toISOString(),
        years: [2028, 2029, 2030],
        classes: {},
        players: [],
        empty: true,
      })),
    ]);

  const trending = settled(trendingR, { classYear: 2027, updatedAt: '', trendingUp: [], trendingDown: [] });
  const movement = settled(movementR, {
    classYear: 2027,
    updatedAt: '',
    movementHeatmap: { upCount: 0, downCount: 0, flatCount: 0 },
    heatmap: { buckets: [], windowDays: 7 },
    risers: [],
    fallers: [],
    highVolatility: [],
    stable: [],
    fitScoreLeaders: [],
    fitScoreRisks: [],
    alerts: [],
  });
  const staffNotes = settled(staffR, { classYear: 2027, updatedAt: '', totalNotes: 0, count: 0, notes: [] });
  const home = settled(homeR, {
    classYear: 2027,
    commitSort: 'fit',
    heatmap: { buckets: [], windowDays: 7 },
    commits: [],
    topTargets: [],
    trendingUp: [],
    trendingDown: [],
    portalWatchlist: [],
  });
  const stock = settled(stockR, EMPTY_STOCK);
  const highPriority = settled(highPriorityR, EMPTY_HIGH_PRIORITY);
  const underclassmenPayload = settled(underclassmenR, {
    ok: true,
    updatedAt: new Date().toISOString(),
    years: [2028, 2029, 2030],
    classes: {},
    players: [],
    empty: true,
  });

  return {
    trendingBoard: trending,
    movementIntel: movement,
    staffNotes,
    home,
    stock,
    highPriority: highPriority.players ?? [],
    visitIntel: highPriority.visitIntel ?? [],
    visitRecap: highPriority.visitRecap ?? [],
    underclassmen: underclassmenPayload.players ?? [],
  };
}

export async function loadFutureCastLabPrimary(): Promise<
  Pick<FutureCastLabDataMap, 'masterBoard' | 'summary' | 'metrics' | 'lastUpdated'>
> {
  const master = await warmFetch<MasterBoardResponse>('/api/futurecast/master-board');
  return {
    masterBoard: master,
    summary: buildSummary(master),
    metrics: buildMetrics(master),
    lastUpdated: master.updatedAt ?? null,
  };
}

export { loadFutureCastLabSecondaryRaw };

export async function loadFutureCastLabData(): Promise<FutureCastLabDataMap> {
  const [primary, secondaryRaw] = await Promise.all([
    loadFutureCastLabPrimary(),
    loadFutureCastLabSecondaryRaw(),
  ]);
  return {
    ...primary,
    ...secondaryRaw,
    heatLevel: deriveHeatLevel(secondaryRaw.home, secondaryRaw.stock),
    lastUpdated: primary.lastUpdated ?? secondaryRaw.movementIntel.updatedAt ?? null,
  };
}
