/**
 * Recruiting Hub Elite API — /api/recruiting/hub/*
 */
import { apiFetch } from './api-fetch';

export type RhHubClassOverview = {
  classRank: string;
  blueChip: string;
  commits: string;
  avgRating: string;
  trendRank: string;
  trendBlueChip: string;
  trendCommits: string;
  trendRating: string;
  sparklines?: {
    classRank: number[];
    blueChip: number[];
    commits: number[];
    avgRating: number[];
  };
};

export type RhHubClassOverviewByYear = Record<number, RhHubClassOverview>;

export type RhHubCommit = {
  id: string;
  name: string;
  position: string;
  rating: string;
  rankNote: string;
  commitDate: string;
  statusBadge?: string;
  profileUrl: string;
  stabilityMeter?: string;
  ufPercent?: string;
  movement?: string;
  enrolled?: boolean;
  jerseyNumber?: string | number | null;
  positionRoomFit?: string;
  earlyImpactProjection?: string;
  strengths?: string | null;
  weaknesses?: string | null;
  playerComp?: string | null;
  gvGrade?: string;
  nilEstimate?: string | null;
  projection?: string | null;
  insiderIntel?: string | null;
};

export type RhHubBattle = {
  id: string;
  name: string;
  position: string;
  ufPercent: string;
  tag: string;
  note: string;
  movement: string;
};

export type RhHubPositionRoom = {
  id: string;
  label: string;
  commits: number;
  targets: number;
  note: string;
};

export type RhHubHeatTarget = {
  id: string;
  name: string;
  position: string;
  heat: number;
  movement: 'up' | 'down' | 'flat';
  ufPercent: number | null;
  battle: {
    uf: number | null;
    competitor: number | null;
    competitorName: string | null;
  };
  nextVisit: string | null;
  insiderNote?: string | null;
  profileUrl: string;
};

export type RhHubMovementFeedItem = {
  id: string;
  timestamp: string;
  name: string;
  position: string;
  class: number;
  event: 'up' | 'down' | 'visit' | 'offer' | 'intel';
  summary: string;
  profileUrl: string;
};

export type RhHubBattleBoardItem = {
  id: string;
  name: string;
  position: string;
  class: number;
  battleDifficulty: 'easy' | 'moderate' | 'hard' | 'flip' | 'longshot' | 'unknown';
  battleColor?: 'blue' | 'orange' | 'red' | null;
  trend: 'up' | 'down' | 'flat';
  competitors: Array<{
    school: string;
    logo: string;
    score: number | null;
    trend: 'up' | 'down' | 'flat';
  }>;
  ufScore: number | null;
  nextVisit: string | null;
  intel: string | null;
};

export type RhHubFootprintPlayer = {
  id: string;
  name: string;
  position: string;
  class: number;
  status: 'commit' | 'target';
  ufScore: number | null;
  competitorScore: number | null;
  pinLat?: number | null;
  pinLng?: number | null;
};

export type RhHubFootprintStaff = {
  staffId: string;
  name: string;
  role: string;
  assignedPlayers: number;
  wins: number;
  losses: number;
};

export type RhHubFootprintState = {
  state: string;
  targets: number;
  commits: number;
  offers: number;
  visits: number;
  ufScore: number | null;
  pipelineScore: number;
  momentum: 'up' | 'down' | 'flat';
  competitorPressure?: number;
  topPlayers: RhHubFootprintPlayer[];
  staffActivity: RhHubFootprintStaff[];
};

export type RhHubFootprintPin = {
  id: string;
  name: string;
  state: string;
  lat: number;
  lng: number;
  status: 'commit' | 'target';
  ufScore: number | null;
  pinType: 'commit' | 'target' | 'portal' | 'battle';
};

export type RhHubFootprintResponse = {
  ok?: boolean;
  meta?: Record<string, unknown>;
  states: RhHubFootprintState[];
  pins?: RhHubFootprintPin[];
};

const HUB_YEAR = 2027;
const HUB_FETCH_OPTS = { retries: 3, retryDelayMs: 2000, timeoutMs: 12_000 } as const;

function hubSnapshotPath(apiPath: string): string | null {
  if (typeof window === 'undefined') return null;
  const normalized = apiPath.startsWith('/') ? apiPath : `/${apiPath}`;
  if (normalized === '/api/recruiting/hub/class-overview/all') {
    return '/hub-snapshot/class-overview-all.json';
  }
  const match = normalized.match(/^\/api\/recruiting\/hub\/([^/?]+)(?:\?year=(\d+))?/);
  if (!match) return null;
  const [, endpoint, yearParam] = match;
  const year = yearParam || String(HUB_YEAR);
  return `/hub-snapshot/${year}/${endpoint}.json`;
}

async function fetchHubSnapshot<T>(apiPath: string): Promise<T> {
  const snapPath = hubSnapshotPath(apiPath);
  if (!snapPath) {
    throw new Error('No hub snapshot for this endpoint');
  }
  const res = await fetch(snapPath, { headers: { Accept: 'application/json' }, cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Hub snapshot unavailable (${res.status})`);
  }
  return (await res.json()) as T;
}

async function fetchHubLive<T>(path: string): Promise<T> {
  return apiFetch<T>(path, HUB_FETCH_OPTS);
}

/** Snapshot-first for instant paint; live API revalidates in background when available. */
function fetchHub<T>(path: string): Promise<T> {
  const snapPath = hubSnapshotPath(path);
  if (snapPath) {
    return fetchHubSnapshot<T>(path)
      .then((snapshot) => {
        void fetchHubLive<T>(path).catch(() => {});
        return snapshot;
      })
      .catch(() => fetchHubLive<T>(path));
  }
  return fetchHubLive<T>(path);
}

export async function fetchRecruitingHubTicker(year = HUB_YEAR): Promise<string[]> {
  const data = await fetchHub<{ ok?: boolean; items?: string[] }>(
    `/api/recruiting/hub/ticker?year=${year}`
  );
  return data.items ?? [];
}

export async function fetchRecruitingHubClassOverview(year = HUB_YEAR): Promise<RhHubClassOverview> {
  return fetchHub<RhHubClassOverview>(`/api/recruiting/hub/class-overview?year=${year}`);
}

export async function fetchRecruitingHubClassOverviewAll(): Promise<RhHubClassOverviewByYear> {
  const data = await fetchHub<Record<string, RhHubClassOverview> & { ok?: boolean }>(
    '/api/recruiting/hub/class-overview/all'
  );
  return {
    2026: data['2026'],
    2027: data['2027'],
    2028: data['2028'],
  };
}

export async function fetchRecruitingHubCommits(year = HUB_YEAR): Promise<RhHubCommit[]> {
  const data = await fetchHub<{ ok?: boolean; items?: RhHubCommit[] }>(
    `/api/recruiting/hub/commits?year=${year}`
  );
  return data.items ?? [];
}

export async function fetchRecruitingHubBattles(year = HUB_YEAR): Promise<RhHubBattle[]> {
  const data = await fetchHub<{ ok?: boolean; items?: RhHubBattle[] }>(
    `/api/recruiting/hub/battles?year=${year}`
  );
  return data.items ?? [];
}

export async function fetchRecruitingHubPositions(year = HUB_YEAR): Promise<RhHubPositionRoom[]> {
  const data = await fetchHub<{ ok?: boolean; items?: RhHubPositionRoom[] }>(
    `/api/recruiting/hub/positions?year=${year}`
  );
  return data.items ?? [];
}

export async function fetchRecruitingHubHeatIndex(year = HUB_YEAR): Promise<RhHubHeatTarget[]> {
  const data = await fetchHub<{ ok?: boolean; items?: RhHubHeatTarget[] }>(
    `/api/recruiting/hub/heat-index?year=${year}`
  );
  return data.items ?? [];
}

export async function fetchRecruitingHubMovementFeed(year = HUB_YEAR): Promise<RhHubMovementFeedItem[]> {
  const data = await fetchHub<{ ok?: boolean; items?: RhHubMovementFeedItem[] }>(
    `/api/recruiting/hub/movement-feed?year=${year}`
  );
  return data.items ?? [];
}

export async function fetchRecruitingHubBattleBoard(year = HUB_YEAR): Promise<RhHubBattleBoardItem[]> {
  const data = await fetchHub<{ ok?: boolean; items?: RhHubBattleBoardItem[] }>(
    `/api/recruiting/hub/battle-board?year=${year}`
  );
  return data.items ?? [];
}

export async function fetchRecruitingHubFootprint(year = HUB_YEAR): Promise<RhHubFootprintResponse> {
  return fetchHub<RhHubFootprintResponse>(`/api/recruiting/hub/footprint?year=${year}`);
}

export const RECRUITING_HUB_ELITE_YEAR = HUB_YEAR;
