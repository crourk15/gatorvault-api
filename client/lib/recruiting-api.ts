import { apiFetch } from './api-fetch';

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

export async function fetchRecruitingHeatCheck(): Promise<HeatCheckResponse> {
  return apiFetch<HeatCheckResponse>('/api/recruiting/heat-check');
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

export async function fetchPortalIncoming(limit = 48): Promise<PortalIncomingPlayer[]> {
  const data = await apiFetch<{ players?: PortalIncomingPlayer[] }>(
    `/api/portal/players?limit=${limit}`
  );
  return data.players ?? [];
}
