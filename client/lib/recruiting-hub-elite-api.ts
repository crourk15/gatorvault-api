/**
 * Recruiting Hub Elite API — /api/recruiting/hub/*
 */
import {
  DEFAULT_SNAPSHOT_FETCH_OPTS,
  snapshotFirstFetch,
  snapshotLiveFetch,
} from './snapshot-fetch';
import { fetchWithWarmPoll } from './api-warm-poll';
import { ACTIVE_RECRUITING_CLASS_YEAR } from '@/lib/recruiting-cycle';

export type RhHubClassOverview = {
  classRank: string;
  blueChip: string;
  commits: string;
  /** "Signees" for signed/on-campus classes; "Commits" for active cycles. */
  commitLabel?: string;
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

export type RhHubHeroPayload = {
  year: number;
  title: string;
  subtitle: string;
  classYears: number[];
  ticker: string[];
  classOverview: RhHubClassOverview;
  classOverviewAll?: RhHubClassOverviewByYear;
};

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

/** Full Recruiting Hub elite landing payload — one request replaces ~10 hub calls. */
export type RhHubBundle = {
  year: number;
  ticker: string[];
  classOverview: RhHubClassOverview;
  classOverviewAll: RhHubClassOverviewByYear;
  commits: RhHubCommit[];
  battles: RhHubBattle[];
  positions: RhHubPositionRoom[];
  heatIndex: RhHubHeatTarget[];
  movementFeed: RhHubMovementFeedItem[];
  battleBoard: RhHubBattleBoardItem[];
  footprint: RhHubFootprintResponse;
};

const HUB_YEAR = ACTIVE_RECRUITING_CLASS_YEAR;
const HUB_FETCH_OPTS = DEFAULT_SNAPSHOT_FETCH_OPTS;
/** Bundle builds more on cold start — poll while hub warms. */
export const HUB_BUNDLE_FETCH_OPTS = { retries: 3, timeoutMs: 25_000, retryDelayMs: 2_500 } as const;

function fetchHubLive<T>(path: string): Promise<T> {
  return fetchWithWarmPoll(() => snapshotLiveFetch<T>(path, HUB_FETCH_OPTS));
}

/** Live recruiting hub API (no static snapshot fallback). */
function fetchHub<T>(path: string): Promise<T> {
  return snapshotFirstFetch(path, () => fetchHubLive<T>(path), HUB_FETCH_OPTS);
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

/** Lightweight hero payload — one round trip before bundle. */
export async function fetchRecruitingHubHero(year = HUB_YEAR): Promise<RhHubHeroPayload> {
  type RawHero = RhHubHeroPayload & { ok?: boolean };
  const raw = await snapshotFirstFetch(
    `/api/recruiting/hub/hero?year=${year}`,
    () => snapshotLiveFetch<RawHero>(`/api/recruiting/hub/hero?year=${year}`, HUB_FETCH_OPTS),
    HUB_FETCH_OPTS
  );
  return {
    year: raw.year ?? year,
    title: raw.title ?? 'Recruiting Command Center',
    subtitle: raw.subtitle ?? "UF's class, movement, and battles—one place.",
    classYears: raw.classYears ?? [2026, 2027, 2028],
    ticker: raw.ticker ?? [],
    classOverview: raw.classOverview,
    classOverviewAll: raw.classOverviewAll,
  };
}

/** Load all elite hub sections in one round trip. */
export async function fetchRecruitingHubBundle(year = HUB_YEAR): Promise<RhHubBundle> {
  type RawBundle = RhHubBundle & { ok?: boolean; status?: string; meta?: unknown };
  const raw = await snapshotFirstFetch(
    `/api/recruiting/hub/bundle?year=${year}`,
    () => snapshotLiveFetch<RawBundle>(`/api/recruiting/hub/bundle?year=${year}`, HUB_BUNDLE_FETCH_OPTS),
    HUB_BUNDLE_FETCH_OPTS
  );
  return {
    year: raw.year ?? year,
    ticker: raw.ticker ?? [],
    classOverview: raw.classOverview,
    classOverviewAll: raw.classOverviewAll ?? {},
    commits: raw.commits ?? [],
    battles: raw.battles ?? [],
    positions: raw.positions ?? [],
    heatIndex: raw.heatIndex ?? [],
    movementFeed: raw.movementFeed ?? [],
    battleBoard: raw.battleBoard ?? [],
    footprint: raw.footprint ?? { states: [], pins: [] },
  };
}

export const RECRUITING_HUB_ELITE_YEAR = HUB_YEAR;
