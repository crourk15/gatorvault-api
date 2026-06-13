/**
 * Staff dashboard API client.
 */
import { getApiBase } from './big-board-api';
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
  const res = await fetch(`${getApiBase()}/api/staff/dashboard`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || `API ${res.status}`);
  }
  return res.json() as Promise<StaffDashboardResponse>;
}
