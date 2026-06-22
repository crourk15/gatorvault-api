/**
 * Recruiting UI endpoints — direct Postgres-backed fetches for hub modules.
 */
import {
  DEFAULT_SNAPSHOT_FETCH_OPTS,
  snapshotFirstFetch,
  snapshotLiveFetch,
} from './snapshot-fetch';
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

export function fetchClassMetrics(
  year = ACTIVE_RECRUITING_CLASS_YEAR
): Promise<ClassMetricsResponse> {
  const path = `/api/recruiting/class-metrics${yearQuery(year)}`;
  return snapshotFirstFetch(path, () =>
    snapshotLiveFetch<ClassMetricsResponse>(path, DEFAULT_SNAPSHOT_FETCH_OPTS)
  );
}

export function fetchRecruitingClassYear(year: number): Promise<ClassYearResponse> {
  const path = `/api/recruiting/class/${year}`;
  return snapshotFirstFetch(path, () =>
    snapshotLiveFetch<ClassYearResponse>(path, DEFAULT_SNAPSHOT_FETCH_OPTS)
  );
}

export function fetchMovementIntel(): Promise<MovementIntelResponse> {
  const path = '/api/recruiting/movement-intel';
  return snapshotFirstFetch(path, () =>
    snapshotLiveFetch<MovementIntelResponse>(path, DEFAULT_SNAPSHOT_FETCH_OPTS)
  );
}

export function fetchRecruitingBattles(
  year = ACTIVE_RECRUITING_CLASS_YEAR
): Promise<BattlesResponse> {
  const path = `/api/recruiting/battles${yearQuery(year)}`;
  return snapshotFirstFetch(path, () =>
    snapshotLiveFetch<BattlesResponse>(path, DEFAULT_SNAPSHOT_FETCH_OPTS)
  );
}

export function fetchHeatIndex(
  year = ACTIVE_RECRUITING_CLASS_YEAR
): Promise<HeatIndexResponse> {
  const path = `/api/recruiting/heat-index${yearQuery(year)}`;
  return snapshotFirstFetch(path, () =>
    snapshotLiveFetch<HeatIndexResponse>(path, DEFAULT_SNAPSHOT_FETCH_OPTS)
  );
}

export function fetchPositionSnapshot(
  year = ACTIVE_RECRUITING_CLASS_YEAR
): Promise<PositionsResponse> {
  const path = `/api/recruiting/positions${yearQuery(year)}`;
  return snapshotFirstFetch(path, () =>
    snapshotLiveFetch<PositionsResponse>(path, DEFAULT_SNAPSHOT_FETCH_OPTS)
  );
}

export function fetchRecruitingFootprint(
  year = ACTIVE_RECRUITING_CLASS_YEAR
): Promise<FootprintResponse> {
  const path = `/api/recruiting/footprint${yearQuery(year)}`;
  return snapshotFirstFetch(path, () =>
    snapshotLiveFetch<FootprintResponse>(path, DEFAULT_SNAPSHOT_FETCH_OPTS)
  );
}

export function fetchBattlesAndMovement(
  year = ACTIVE_RECRUITING_CLASS_YEAR
): Promise<BattlesAndMovementResponse> {
  const path = `/api/recruiting/battles-and-movement${yearQuery(year)}`;
  return snapshotFirstFetch(path, () =>
    snapshotLiveFetch<BattlesAndMovementResponse>(path, DEFAULT_SNAPSHOT_FETCH_OPTS)
  );
}

export function fetchHighPriorityIntel(): Promise<HighPriorityIntelItem[]> {
  const path = '/api/recruiting/intel/high-priority';
  return snapshotFirstFetch(path, async () => {
    const res = await snapshotLiveFetch<{ items: HighPriorityIntelItem[] }>(
      path,
      DEFAULT_SNAPSHOT_FETCH_OPTS
    );
    return res.items ?? [];
  });
}

export function fetchBeatIntel(): Promise<BeatIntelItem[]> {
  const path = '/api/recruiting/intel/beat';
  return snapshotFirstFetch(path, async () => {
    const res = await snapshotLiveFetch<{ items: BeatIntelItem[] }>(
      path,
      DEFAULT_SNAPSHOT_FETCH_OPTS
    );
    return res.items ?? [];
  });
}

export function fetchLivePodcasts(): Promise<PodcastCardProps[]> {
  const path = '/api/live/podcasts';
  return snapshotFirstFetch(path, async () => {
    const res = await snapshotLiveFetch<PodcastsResponse>(path, DEFAULT_SNAPSHOT_FETCH_OPTS);
    const shows = (res.shows ?? []).map((show) =>
      normalizePodcastShow(show as unknown as Record<string, unknown>)
    );
    return shows.length > 0 ? normalizePodcasts(shows) : [];
  });
}
