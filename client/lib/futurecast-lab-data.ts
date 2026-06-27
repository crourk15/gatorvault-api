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
  type FlipWatchRow,
  type HighPriorityPlayer,
  type HighPriorityResponse,
  type MovementNarrativeRow,
  type VisitRecapRow,
} from './futurecast-high-priority-api';
import {
  fetchFutureCastUnderclassmen,
  type UnderclassmenPlayer,
} from './futurecast-underclassmen-api';
import { fetchWithWarmPoll } from './api-warm-poll';
import { snapshotLiveFetch, DEFAULT_SNAPSHOT_FETCH_OPTS } from './snapshot-fetch';
import { primaryRecruitingClassYear } from './recruiting-cycle';
import { overlayDiscoverySeasonLabState } from '@/components/futurecast/lab/fc-lab-types';

const EMPTY_STOCK: StockBoardResponse = { stockUp: [], stockDown: [], windowDays: 7 };
const EMPTY_HIGH_PRIORITY: HighPriorityResponse = {
  players: [],
  classYear: 2027,
  count: 0,
  updatedAt: new Date().toISOString(),
  visitIntel: [],
  visitRecap: [],
  flipWatch: [],
  movementNarratives: [],
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
  flipWatch: FlipWatchRow[];
  movementNarratives: MovementNarrativeRow[];
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

function countUpcomingVisitIntel(visitIntel: HighPriorityPlayer[]): number {
  const today = new Date().toISOString().slice(0, 10);
  return visitIntel.filter((p) => {
    if (p.visitVerified === false) return false;
    if (String(p.ufOvStatus || '').toLowerCase() === 'completed') return false;
    if (p.visitStart && String(p.visitStart).slice(0, 10) < today) return false;
    return Boolean(p.visitStart) || p.visitVerified === true;
  }).length;
}

export function enrichHeroMetrics(
  base: FutureCastHeroMetrics,
  visitIntel: HighPriorityPlayer[],
  visitRecap: VisitRecapRow[],
  flipWatch: FlipWatchRow[],
  movementNarratives: MovementNarrativeRow[] = []
): FutureCastHeroMetrics {
  return {
    ...base,
    visitIntelCount: countUpcomingVisitIntel(visitIntel),
    visitRecapCount: visitRecap.length,
    flipWatchCount: flipWatch.length,
    movementNarrativesCount: movementNarratives.length,
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
  const focusYear = primaryRecruitingClassYear();
  const [trendingR, movementR, staffR, homeR, stockR, highPriorityR, underclassmenR] =
    await Promise.allSettled([
      warmFetch<TrendingBoardResponse>('/api/futurecast/trending'),
      warmFetch<MovementIntelResponse>('/api/futurecast/movement-intel'),
      warmFetch<StaffNotesResponse>(`/api/futurecast/staff-notes?year=${focusYear}`),
      warmFetch<FutureCastHomeResponse>('/api/futurecast/home'),
      fetchStockBoard().catch(() => EMPTY_STOCK),
      fetchHighPriorityTargets(focusYear).catch(() => ({
        ...EMPTY_HIGH_PRIORITY,
        classYear: focusYear,
      })),
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
  const staffNotes = settled(staffR, { classYear: focusYear, updatedAt: '', totalNotes: 0, count: 0, notes: [] });
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
    flipWatch: highPriority.flipWatch ?? [],
    movementNarratives: highPriority.movementNarratives ?? [],
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

export function applyDiscoverySeasonOverlay(
  primary: Pick<FutureCastLabDataMap, 'masterBoard' | 'summary' | 'metrics' | 'lastUpdated'>,
  secondaryRaw: Omit<
    FutureCastLabDataMap,
    'masterBoard' | 'summary' | 'metrics' | 'heatLevel' | 'lastUpdated'
  >
): Pick<FutureCastLabDataMap, 'summary' | 'metrics'> {
  const enriched = enrichHeroMetrics(
    primary.metrics,
    secondaryRaw.visitIntel,
    secondaryRaw.visitRecap,
    secondaryRaw.flipWatch,
    secondaryRaw.movementNarratives
  );
  return overlayDiscoverySeasonLabState(primary.summary, enriched, secondaryRaw.highPriority);
}

export async function loadFutureCastLabData(): Promise<FutureCastLabDataMap> {
  const [primary, secondaryRaw] = await Promise.all([
    loadFutureCastLabPrimary(),
    loadFutureCastLabSecondaryRaw(),
  ]);
  const discoveryOverlay = applyDiscoverySeasonOverlay(primary, secondaryRaw);
  return {
    ...primary,
    ...secondaryRaw,
    ...discoveryOverlay,
    heatLevel: deriveHeatLevel(secondaryRaw.home, secondaryRaw.stock),
    lastUpdated: primary.lastUpdated ?? secondaryRaw.movementIntel.updatedAt ?? null,
  };
}
