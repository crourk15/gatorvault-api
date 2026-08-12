/**
 * Recruiting UI endpoints — direct Postgres-backed fetches for hub modules.
 */
import {
  DEFAULT_SNAPSHOT_FETCH_OPTS,
  snapshotLiveFetch,
} from './snapshot-fetch';
import { fetchWithWarmPoll } from './api-warm-poll';
import type {
  RhHubBattle,
  RhHubBattleBoardItem,
  RhHubClassOverview,
  RhHubFootprintResponse,
  RhHubHeatTarget,
  RhHubMovementFeedItem,
  RhHubPositionRoom,
} from './recruiting-hub-elite-api';
import type { MovementIntelResponse } from './movement-intel-types';
import type { PodcastCardProps } from './gatornation-live-types';
import { ACTIVE_RECRUITING_CLASS_YEAR } from './recruiting-cycle';
import { normalizePodcasts } from './gatornation-live-api';
import { normalizePodcastShow, type PodcastShow } from './live-api';

export type ClassMetricsResponse = RhHubClassOverview & {
  ok?: boolean;
  status?: string;
  meta?: { lastUpdated?: string; generatedAt?: string };
};

export type ClassYearResponse = {
  ok?: boolean;
  year: number;
  commits: number;
  classScore: number;
  nationalRank: number;
  secRank: number;
  blueChipRatio: number;
  inStateRatio: number;
  yoyMovement: number;
  players: unknown[];
  meta?: { lastUpdated?: string };
};

export type HighPriorityIntelItem = {
  id: string;
  playerId?: string;
  playerSlug?: string | null;
  timestamp: string;
  text: string;
  ufProbability: number;
};

export type BeatIntelItem = {
  id: string;
  text: string;
  writerName: string;
  handle?: string | null;
  source: string;
  url?: string | null;
  timestamp: string;
  embedHtml?: string | null;
};

export type BattlesAndMovementResponse = {
  ok?: boolean;
  status?: string;
  battles: RhHubBattle[];
  movement: RhHubMovementFeedItem[];
  meta?: { lastUpdated?: string };
};

export type BattlesResponse = {
  ok?: boolean;
  status?: string;
  items: RhHubBattleBoardItem[];
  meta?: { lastUpdated?: string };
};

export type HeatIndexResponse = {
  ok?: boolean;
  status?: string;
  items: RhHubHeatTarget[];
  meta?: { lastUpdated?: string };
};

export type PositionsResponse = {
  ok?: boolean;
  status?: string;
  items: RhHubPositionRoom[];
  meta?: { lastUpdated?: string };
};

export type FootprintResponse = RhHubFootprintResponse & {
  ok?: boolean;
  status?: string;
  meta?: { lastUpdated?: string };
};

export type PodcastsResponse = {
  ok?: boolean;
  shows: PodcastShow[];
  fetchedAt?: string | null;
  cacheKey?: string;
};

function yearQuery(year = ACTIVE_RECRUITING_CLASS_YEAR): string {
  return `?year=${year}`;
}

const CLASS_METRICS_CACHE_PREFIX = 'gv_class_metrics_v1';
const CLASS_METRICS_CACHE_TTL_MS = 5 * 60_000;

function readClassMetricsCache(year: number): ClassMetricsResponse | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(`${CLASS_METRICS_CACHE_PREFIX}:${year}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; data: ClassMetricsResponse };
    if (!parsed?.data || Date.now() - parsed.at > CLASS_METRICS_CACHE_TTL_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeClassMetricsCache(year: number, data: ClassMetricsResponse): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(
      `${CLASS_METRICS_CACHE_PREFIX}:${year}`,
      JSON.stringify({ at: Date.now(), data })
    );
  } catch {
    /* quota */
  }
}

function warmFetch<T>(path: string): Promise<T> {
  return fetchWithWarmPoll(() => snapshotLiveFetch<T>(path, DEFAULT_SNAPSHOT_FETCH_OPTS));
}

export function fetchClassMetrics(
  year = ACTIVE_RECRUITING_CLASS_YEAR
): Promise<ClassMetricsResponse> {
  const cached = readClassMetricsCache(year);
  const path = `/api/recruiting/class-metrics${yearQuery(year)}`;
  const live = warmFetch<ClassMetricsResponse>(path).then((data) => {
    writeClassMetricsCache(year, data);
    return data;
  });
  if (cached && cached.status !== 'building') {
    void live.catch(() => {});
    return Promise.resolve(cached);
  }
  return live;
}

export function fetchRecruitingClassYear(year: number): Promise<ClassYearResponse> {
  const path = `/api/recruiting/class/${year}`;
  return warmFetch<ClassYearResponse>(path);
}

export function fetchMovementIntel(): Promise<MovementIntelResponse> {
  return warmFetch<MovementIntelResponse>('/api/recruiting/movement-intel');
}

export function fetchRecruitingBattles(
  year = ACTIVE_RECRUITING_CLASS_YEAR
): Promise<BattlesResponse> {
  const path = `/api/recruiting/battles${yearQuery(year)}`;
  return warmFetch<BattlesResponse>(path);
}

export function fetchHeatIndex(
  year = ACTIVE_RECRUITING_CLASS_YEAR
): Promise<HeatIndexResponse> {
  const path = `/api/recruiting/heat-index${yearQuery(year)}`;
  return warmFetch<HeatIndexResponse>(path);
}

export function fetchPositionSnapshot(
  year = ACTIVE_RECRUITING_CLASS_YEAR
): Promise<PositionsResponse> {
  const path = `/api/recruiting/positions${yearQuery(year)}`;
  return warmFetch<PositionsResponse>(path);
}

export function fetchRecruitingFootprint(
  year = ACTIVE_RECRUITING_CLASS_YEAR
): Promise<FootprintResponse> {
  const path = `/api/recruiting/footprint${yearQuery(year)}`;
  return warmFetch<FootprintResponse>(path);
}

export function fetchBattlesAndMovement(
  year = ACTIVE_RECRUITING_CLASS_YEAR
): Promise<BattlesAndMovementResponse> {
  const path = `/api/recruiting/battles-and-movement${yearQuery(year)}`;
  return warmFetch<BattlesAndMovementResponse>(path);
}

export function fetchHighPriorityIntel(): Promise<HighPriorityIntelItem[]> {
  return warmFetch<{ items: HighPriorityIntelItem[] }>('/api/recruiting/intel/high-priority').then(
    (res) => res.items ?? []
  );
}

export function fetchBeatIntel(): Promise<BeatIntelItem[]> {
  return warmFetch<{ items: BeatIntelItem[] }>('/api/recruiting/intel/beat').then(
    (res) => res.items ?? []
  );
}

export function fetchLivePodcasts(): Promise<PodcastCardProps[]> {
  return warmFetch<PodcastsResponse>('/api/live/podcasts').then((res) => {
    const shows = (res.shows ?? []).map((show) =>
      normalizePodcastShow(show as unknown as Record<string, unknown>)
    );
    return shows.length > 0 ? normalizePodcasts(shows) : [];
  });
}
