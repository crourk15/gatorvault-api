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
  delta7d?: number;
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
  lastUpdated?: string;
  unavailable?: boolean;
}

export async function fetchStaffDashboard(): Promise<StaffDashboardResponse> {
  const { snapshotFirstFetch, snapshotLiveFetch } = await import('./snapshot-fetch');
  return snapshotFirstFetch('/api/staff/dashboard', () =>
    snapshotLiveFetch<StaffDashboardResponse>('/api/staff/dashboard')
  );
}
