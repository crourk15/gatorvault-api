/**
 * Vault dashboard data layer — cached fetches for GameDay homepage.
 */
import { getApiBase } from './big-board-api';
import { fetchStaffDashboard, type StaffDashboardResponse } from './staff-api';
import {
  fetchMovementHeatmap,
  fetchMovementSnapshots,
  fetchStockBoard,
} from './predictions-api';
import { fetchRecruitingBoard } from './recruiting-board-api';
import { fetchFutureCastHome, fetchFutureCastClass } from './futurecast-home-api';
import { fetchNilDashboard } from './nil-api';
import { SCHEDULE_GAMES } from './schedule-data';
import { loadAlertPrefs, loadLocalRecentAlerts } from './alert-prefs';

export const DASHBOARD_REFRESH = {
  hero: 5 * 60_000,
  ticker: 30_000,
  movement: 5 * 60_000,
  recruiting: 2 * 60_000,
  content: 2 * 60_000,
} as const;

export type TickerItem = {
  id: string;
  text: string;
  category: string;
  url: string;
  source: string;
};

export type HotCarouselItem = {
  id: string;
  title: string;
  category: string;
  url: string;
};

export type TickerResponse = {
  ok?: boolean;
  items: TickerItem[];
  storyline: string;
  hotToday: HotCarouselItem[];
  updatedAt?: string;
};

export type ContentLatestItem = {
  id: string;
  title: string;
  timestamp?: string | null;
  icon?: string;
  source?: string;
  href: string;
  replyCount?: number;
};

export type ContentLatestResponse = {
  ok?: boolean;
  articles: ContentLatestItem[];
  podcasts: ContentLatestItem[];
  filmRoom: ContentLatestItem[];
  community: ContentLatestItem[];
  updatedAt?: string;
};

export type PersonalizedAlert = {
  id: string;
  title: string;
  category?: string;
  url?: string;
  isNew?: boolean;
};

export type PersonalizedResponse = {
  ok?: boolean;
  alerts: PersonalizedAlert[];
  savedPlayers: { name: string; slug?: string | null }[];
  watchlist: { label: string; href?: string; count?: number }[];
  favoriteThreads: { id: string; title: string; href: string }[];
  updatedAt?: string;
};

export type RecruitingSnapshot = {
  commits: number;
  targets: number;
  portalActive: number;
  classRank: number | null;
  nilSecRank: number | null;
  winProbability: number;
  nextGameLabel: string;
  nextGameDays: number;
};

export type DashboardBundle = {
  ticker: TickerResponse | null;
  movement: StaffDashboardResponse | null;
  content: ContentLatestResponse | null;
  recruiting: RecruitingSnapshot | null;
  momentumPct: number;
  personalized: PersonalizedResponse | null;
};

type CacheSlot<T> = { at: number; data: T | null };

const memoryCache: {
  ticker: CacheSlot<TickerResponse>;
  content: CacheSlot<ContentLatestResponse>;
  movement: CacheSlot<StaffDashboardResponse>;
  recruiting: CacheSlot<RecruitingSnapshot>;
} = {
  ticker: { at: 0, data: null },
  content: { at: 0, data: null },
  movement: { at: 0, data: null },
  recruiting: { at: 0, data: null },
};

function readCache<T>(slot: CacheSlot<T>, ttlMs: number): T | null {
  if (!slot.data || Date.now() - slot.at > ttlMs) return null;
  return slot.data;
}

function writeCache<T>(slot: CacheSlot<T>, data: T): T {
  slot.data = data;
  slot.at = Date.now();
  return data;
}

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${getApiBase()}${path}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${path} ${res.status}`);
  return (await res.json()) as T;
}

export async function fetchLiveTicker(force = false): Promise<TickerResponse> {
  if (!force) {
    const cached = readCache(memoryCache.ticker, DASHBOARD_REFRESH.ticker);
    if (cached) return cached;
  }
  const data = await fetchJson<TickerResponse>('/api/live/ticker');
  return writeCache(memoryCache.ticker, data);
}

export async function fetchContentLatest(force = false): Promise<ContentLatestResponse> {
  if (!force) {
    const cached = readCache(memoryCache.content, DASHBOARD_REFRESH.content);
    if (cached) return cached;
  }
  const data = await fetchJson<ContentLatestResponse>('/api/content/latest');
  return writeCache(memoryCache.content, data);
}

export async function fetchMovementPreview(force = false): Promise<StaffDashboardResponse> {
  if (!force) {
    const cached = readCache(memoryCache.movement, DASHBOARD_REFRESH.movement);
    if (cached) return cached;
  }

  const [staff, heatmap, stock, snapshots] = await Promise.all([
    fetchStaffDashboard().catch(() => null),
    fetchMovementHeatmap().catch(() => null),
    fetchStockBoard().catch(() => null),
    fetchMovementSnapshots().catch(() => null),
  ]);

  let data = staff;
  if (!data) {
    data = {
      topRisers: [],
      topFallers: [],
      highVolatility: [],
      lowVolatility: [],
      fitLeaders: [],
      fitRisks: [],
      heatmap: { buckets: heatmap?.buckets ?? [], windowDays: heatmap?.windowDays ?? 7 },
      alerts: [],
      movementWindowDays: stock?.windowDays ?? 7,
      volatilityWindowDays: snapshots?.weeklyWindowDays ?? 7,
    };
  } else if (heatmap?.buckets?.length && !data.heatmap?.buckets?.length) {
    data = {
      ...data,
      heatmap: { buckets: heatmap.buckets, windowDays: heatmap.windowDays ?? data.heatmap.windowDays },
    };
  }

  if (data.topRisers.length === 0 && stock?.stockUp?.length) {
    data = {
      ...data,
      topRisers: stock.stockUp.slice(0, 10).map((row) => ({
        id: row.playerId,
        slug: row.playerSlug,
        name: row.fullName,
        delta: row.delta,
      })),
    };
  }

  if (data.topFallers.length === 0 && stock?.stockDown?.length) {
    data = {
      ...data,
      topFallers: stock.stockDown.slice(0, 10).map((row) => ({
        id: row.playerId,
        slug: row.playerSlug,
        name: row.fullName,
        delta: row.delta,
      })),
    };
  }

  return writeCache(memoryCache.movement, data);
}

const NEXT_GAME_ISO = '2026-09-05T19:45:00-04:00';

export function daysUntilNextGame(): number {
  const ms = new Date(NEXT_GAME_ISO).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

export function computeMomentumPct(
  heatmap: StaffDashboardResponse['heatmap'] | null | undefined,
  classScore: number | null | undefined
): number {
  const buckets = heatmap?.buckets ?? [];
  const up = buckets.find((b) => b.label === 'Up')?.count ?? 0;
  const down = buckets.find((b) => b.label === 'Down')?.count ?? 0;
  const flat = buckets.find((b) => b.label === 'Flat')?.count ?? 0;
  const total = up + down + flat;
  if (total > 0) {
    const ratio = up / total;
    return Math.round(40 + ratio * 55);
  }
  if (classScore != null) return Math.min(99, Math.max(35, Math.round(classScore)));
  return 72;
}

export function buildWhyItMatters(movement: StaffDashboardResponse | null): string {
  const risers = movement?.topRisers?.length ?? 0;
  const fallers = movement?.topFallers?.length ?? 0;
  if (risers >= 3) {
    return `UF gained traction with ${Math.min(risers, 3)} priority targets this week.`;
  }
  if (fallers >= 3) {
    return `Several targets cooling — staff may need a push before key visits.`;
  }
  if (movement?.alerts?.length) {
    const first = movement.alerts[0];
    return first?.message || 'Movement intel is active this week.';
  }
  return 'Track risers and fallers to spot momentum shifts before they hit the feed.';
}

export async function fetchRecruitingSnapshot(force = false): Promise<RecruitingSnapshot> {
  if (!force) {
    const cached = readCache(memoryCache.recruiting, DASHBOARD_REFRESH.recruiting);
    if (cached) return cached;
  }

  const [board, fc, fcClass, nil] = await Promise.all([
    fetchRecruitingBoard(2027).catch(() => null),
    fetchFutureCastHome().catch(() => null),
    fetchFutureCastClass().catch(() => null),
    fetchNilDashboard().catch(() => null),
  ]);

  const nextGame = SCHEDULE_GAMES[0];
  const snapshot: RecruitingSnapshot = {
    commits: board?.commits?.length ?? fc?.commits?.length ?? fc?.commitTotal ?? 0,
    targets: board?.targets?.length ?? fc?.topTargets?.length ?? 0,
    portalActive: fc?.portalWatchlist?.length ?? 0,
    classRank:
      fcClass?.rankings?.nationalRank ??
      board?.rankings?.nationalRank ??
      null,
    nilSecRank: nil?.ufStanding?.secRank ?? null,
    winProbability: nextGame?.ufPct ?? 94,
    nextGameLabel: nextGame ? `FLORIDA vs ${nextGame.opp.split(' ')[0]?.toUpperCase() ?? 'FAU'}` : 'FLORIDA vs FAU',
    nextGameDays: daysUntilNextGame(),
  };

  return writeCache(memoryCache.recruiting, snapshot);
}

export async function fetchPersonalizedHints(): Promise<PersonalizedResponse> {
  const prefs = loadAlertPrefs();
  const follow = prefs.followPlayers.join(',');
  const qs = follow ? `?followPlayers=${encodeURIComponent(follow)}` : '';
  const server = await fetchJson<PersonalizedResponse>(`/api/user/personalized${qs}`).catch(
    () =>
      ({
        alerts: [],
        savedPlayers: [],
        watchlist: [],
        favoriteThreads: [],
      }) as PersonalizedResponse
  );

  const localAlerts = loadLocalRecentAlerts()
    .filter((a) => !a.read)
    .slice(0, 4)
    .map((a, idx) => ({
      id: `local_${idx}`,
      title: a.title || a.text || 'Alert',
      category: a.type,
      isNew: true,
    }));

  const savedPlayers =
    prefs.followPlayers.length > 0
      ? prefs.followPlayers.map((name) => ({ name }))
      : server.savedPlayers;

  return {
    ...server,
    alerts: localAlerts.length ? localAlerts : server.alerts,
    savedPlayers,
    watchlist:
      prefs.followPlayers.length > 0
        ? [{ label: 'Your Followed Players', count: prefs.followPlayers.length }]
        : server.watchlist,
  };
}

export function heatmapSparkPct(buckets: StaffDashboardResponse['heatmap']['buckets']): number {
  const up = buckets.find((b) => b.label === 'Up')?.count ?? 0;
  const down = buckets.find((b) => b.label === 'Down')?.count ?? 0;
  const flat = buckets.find((b) => b.label === 'Flat')?.count ?? 0;
  const total = up + down + flat;
  if (!total) return 0;
  return Math.round((up / total) * 100);
}
