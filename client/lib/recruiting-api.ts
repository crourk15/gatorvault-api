import { apiFetch } from './api-fetch';
import type { RecruitingBoardPlayer } from './recruiting-board-api';

export interface HeatCheckItem {
  playerName: string;
  playerSlug?: string;
  direction: 'rising' | 'cooling';
  triggerLabel?: string;
  predictionSchool?: string;
  headline?: string;
  recordedAt?: string;
}

export interface HeatCheckResponse {
  ok?: boolean;
  rising?: HeatCheckItem[];
  cooling?: HeatCheckItem[];
  updatedAt?: string;
}

export async function fetchRecruitingHeatCheck(force = false): Promise<HeatCheckResponse> {
  const q = force ? '?force=1' : '';
  return apiFetch<HeatCheckResponse>(`/api/recruiting/heat-check${q}`);
}

export interface PortalIncomingPlayer {
  id: string;
  slug: string;
  fullName: string;
  position: string;
  classYear: number;
  previousSchool?: string | null;
  ufFitScore?: number | null;
}

export interface RecruitingPortalBoardResponse {
  ok?: boolean;
  incoming?: RecruitingBoardPlayer[];
}

export async function fetchRecruitingPortalBoard(): Promise<RecruitingBoardPlayer[]> {
  const data = await apiFetch<RecruitingPortalBoardResponse>('/api/recruiting/portal');
  return data.incoming ?? [];
}

export async function fetchAllRecruitingPlayers(): Promise<RecruitingBoardPlayer[]> {
  const data = await apiFetch<{ players?: RecruitingBoardPlayer[] }>('/api/players');
  return data.players ?? [];
}

export async function fetchPortalIncoming(limit = 48): Promise<PortalIncomingPlayer[]> {
  const data = await apiFetch<{ players?: PortalIncomingPlayer[] }>(
    `/api/portal/players?limit=${limit}`
  );
  return data.players ?? [];
}
