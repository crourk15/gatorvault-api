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

const HUB_YEAR = 2027;

export async function fetchRecruitingHubTicker(year = HUB_YEAR): Promise<string[]> {
  const data = await apiFetch<{ ok?: boolean; items?: string[] }>(
    `/api/recruiting/hub/ticker?year=${year}`
  );
  return data.items ?? [];
}

export async function fetchRecruitingHubClassOverview(year = HUB_YEAR): Promise<RhHubClassOverview> {
  return apiFetch<RhHubClassOverview>(`/api/recruiting/hub/class-overview?year=${year}`);
}

export async function fetchRecruitingHubClassOverviewAll(): Promise<RhHubClassOverviewByYear> {
  const data = await apiFetch<Record<string, RhHubClassOverview> & { ok?: boolean }>(
    '/api/recruiting/hub/class-overview/all'
  );
  return {
    2026: data['2026'],
    2027: data['2027'],
    2028: data['2028'],
  };
}

export async function fetchRecruitingHubCommits(year = HUB_YEAR): Promise<RhHubCommit[]> {
  const data = await apiFetch<{ ok?: boolean; items?: RhHubCommit[] }>(
    `/api/recruiting/hub/commits?year=${year}`
  );
  return data.items ?? [];
}

export async function fetchRecruitingHubBattles(year = HUB_YEAR): Promise<RhHubBattle[]> {
  const data = await apiFetch<{ ok?: boolean; items?: RhHubBattle[] }>(
    `/api/recruiting/hub/battles?year=${year}`
  );
  return data.items ?? [];
}

export async function fetchRecruitingHubPositions(year = HUB_YEAR): Promise<RhHubPositionRoom[]> {
  const data = await apiFetch<{ ok?: boolean; items?: RhHubPositionRoom[] }>(
    `/api/recruiting/hub/positions?year=${year}`
  );
  return data.items ?? [];
}

export const RECRUITING_HUB_ELITE_YEAR = HUB_YEAR;
