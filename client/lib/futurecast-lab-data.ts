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
  readStaleHighPriorityCache,
  writeHighPriorityCache,
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
import { ACTIVE_RECRUITING_CLASS_YEAR, primaryRecruitingClassYear } from './recruiting-cycle';
import { HIGH_PRIORITY_YEAR } from './futurecast-high-priority-api';
import { overlayDiscoverySeasonLabState } from '@/components/futurecast/lab/fc-lab-types';
import { fetchRosterPlayers, type RosterPlayer } from './roster-api';
import { fetchRecruitingBoard, type RecruitingBoardPlayer } from './recruiting-board-api';
import { isFloridaSchool } from './recruiting-target-filters';

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
/**
 * Lab must fail fast when Render is hard-down (paid/routing 502), otherwise seed paint
 * sits behind stacked apiFetch retries × warm-poll and feels like a multi-minute hang.
 * Cold-start wake still gets one short retry; hard outages fall back to seed/stale.
 */
const LAB_FETCH_OPTS = {
  ...DEFAULT_SNAPSHOT_FETCH_OPTS,
  retries: 0,
  timeoutMs: 8_000,
  retryDelayMs: 400,
} as const;
const LAB_WARM_POLL = { maxAttempts: 2, delayMs: 600 } as const;

function warmFetch<T>(path: string): Promise<T> {
  return fetchWithWarmPoll(() => snapshotLiveFetch<T>(path, LAB_FETCH_OPTS), LAB_WARM_POLL);
}

/** Hero commit-likelihood meter depends on HP — warm-poll + stale cache, same as other Lab boards. */
async function warmFetchHighPriority(year: number): Promise<HighPriorityResponse> {
  const path = `/api/futurecast/high-priority?year=${year}`;
  try {
    const live = await warmFetch<HighPriorityResponse>(path);
    if ((live.players?.length ?? 0) > 0) writeHighPriorityCache(live);
    return live;
  } catch {
    const stale = readStaleHighPriorityCache(year);
    if (stale) return stale;
    try {
      return await fetchHighPriorityTargets(year);
    } catch {
      return { ...EMPTY_HIGH_PRIORITY, classYear: year };
    }
  }
}

function settled<T>(result: PromiseSettledResult<T>, fallback: T): T {
  return result.status === 'fulfilled' ? result.value : fallback;
}

/** Guard Lab paint/SSG when Tier B returns building stubs missing array fields. */
function normalizeTrendingBoard(raw: TrendingBoardResponse | null | undefined): TrendingBoardResponse {
  return {
    classYear: Number(raw?.classYear) || 2027,
    updatedAt: String(raw?.updatedAt || ''),
    trendingUp: Array.isArray(raw?.trendingUp) ? raw!.trendingUp : [],
    trendingDown: Array.isArray(raw?.trendingDown) ? raw!.trendingDown : [],
  };
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
  /** High-priority targets for the active discovery class (2028 in portal dormancy). */
  highPriority: HighPriorityPlayer[];
  /** High-priority targets for the closing class (2027). */
  highPriorityClosing: HighPriorityPlayer[];
  visitIntel: HighPriorityPlayer[];
  visitRecap: VisitRecapRow[];
  flipWatch: FlipWatchRow[];
  movementNarratives: MovementNarrativeRow[];
  underclassmen: UnderclassmenPlayer[];
  /** Current UF roster — used for Board-by-need ranking. */
  roster: RosterPlayer[];
  /** Locked 2027 UF commits — used for Board-by-need ranking. */
  commits2027: RecruitingBoardPlayer[];
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
  const discoveryYear = primaryRecruitingClassYear();
  const closingYear = HIGH_PRIORITY_YEAR;
  const [
    trendingR,
    movementR,
    staffR,
    homeR,
    stockR,
    discoveryHpR,
    closingHpR,
    underclassmenR,
    rosterR,
    board2027R,
  ] = await Promise.allSettled([
      warmFetch<TrendingBoardResponse>('/api/futurecast/trending'),
      warmFetch<MovementIntelResponse>(
        `/api/futurecast/movement-intel?year=${discoveryYear}`
      ),
      warmFetch<StaffNotesResponse>(
        `/api/futurecast/staff-notes?year=${ACTIVE_RECRUITING_CLASS_YEAR}`
      ),
      warmFetch<FutureCastHomeResponse>('/api/futurecast/home'),
      fetchStockBoard().catch(() => EMPTY_STOCK),
      warmFetchHighPriority(discoveryYear),
      warmFetchHighPriority(closingYear),
      warmFetch<Awaited<ReturnType<typeof fetchFutureCastUnderclassmen>>>(
        '/api/futurecast/underclassmen?years=2028,2029,2030'
      ).catch(() => ({
        ok: true,
        updatedAt: new Date().toISOString(),
        years: [2028, 2029, 2030],
        classes: {},
        players: [],
        empty: true,
      })),
      fetchRosterPlayers().catch((): RosterPlayer[] => []),
      fetchRecruitingBoard(2027).catch(() => ({
        ok: false,
        classYear: 2027,
        commits: [] as RecruitingBoardPlayer[],
        targets: [] as RecruitingBoardPlayer[],
      })),
    ]);

  const trending = normalizeTrendingBoard(
    settled(trendingR, { classYear: 2027, updatedAt: '', trendingUp: [], trendingDown: [] })
  );
  const movement = settled(movementR, {
    classYear: discoveryYear,
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
  const staffNotes = settled(staffR, {
    classYear: ACTIVE_RECRUITING_CLASS_YEAR,
    updatedAt: '',
    totalNotes: 0,
    count: 0,
    notes: [],
  });
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
  const discoveryHighPriority: HighPriorityResponse = settled(discoveryHpR, {
    ...EMPTY_HIGH_PRIORITY,
    classYear: discoveryYear,
  });
  const closingHighPriority: HighPriorityResponse = settled(closingHpR, {
    ...EMPTY_HIGH_PRIORITY,
    classYear: closingYear,
  });
  const underclassmenPayload = settled(underclassmenR, {
    ok: true,
    updatedAt: new Date().toISOString(),
    years: [2028, 2029, 2030],
    classes: {},
    players: [],
    empty: true,
  });
  const roster = settled(rosterR, [] as RosterPlayer[]);
  const board2027 = settled(board2027R, {
    ok: false,
    classYear: 2027,
    commits: [] as RecruitingBoardPlayer[],
    targets: [] as RecruitingBoardPlayer[],
  });
  const commits2027 = (board2027.commits ?? []).filter(
    (p) => p.isCommittedToUF === true || isFloridaSchool(p.committedTo)
  );

  return {
    trendingBoard: trending,
    movementIntel: movement,
    staffNotes,
    home,
    stock,
    highPriority: discoveryHighPriority.players ?? [],
    highPriorityClosing: closingHighPriority.players ?? [],
    visitIntel: closingHighPriority.visitIntel ?? [],
    visitRecap: closingHighPriority.visitRecap ?? [],
    flipWatch: closingHighPriority.flipWatch ?? [],
    movementNarratives: closingHighPriority.movementNarratives ?? [],
    underclassmen: underclassmenPayload.players ?? [],
    roster,
    commits2027,
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
