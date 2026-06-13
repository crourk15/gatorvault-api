/**
 * Staff dashboard API client.
 */
import type { FutureCastAlert } from './alerts-api';

export interface MovementHeatmapBucket {
  label: string;
  count: number;
}

export interface StaffDashboardPlayer {
  id: string;
  slug: string;
  name: string;
  delta?: number;
  volatilityScore?: number;
  ufFitScore?: number | null;
  lifecycle?: string | null;
}

export interface StaffDashboardResponse {
  topRisers: StaffDashboardPlayer[];
  topFallers: StaffDashboardPlayer[];
  highVolatility: StaffDashboardPlayer[];
  lowVolatility: StaffDashboardPlayer[];
  fitLeaders: StaffDashboardPlayer[];
  fitRisks: StaffDashboardPlayer[];
  heatmap: {
    buckets: MovementHeatmapBucket[];
    windowDays: number;
  };
  alerts: FutureCastAlert[];
  movementWindowDays: number;
  volatilityWindowDays: number;
}

export async function fetchStaffDashboard(): Promise<StaffDashboardResponse> {
  const { apiFetch } = await import('./api-fetch');
  return apiFetch<StaffDashboardResponse>('/api/staff/dashboard');
}
