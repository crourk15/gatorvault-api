/**
 * Recruiting movement APIs — rolling window, summary, competing deltas.
 */
import { apiFetch } from './api-fetch';

export interface RollingMovement {
  playerId: string;
  slug: string;
  fullName: string;
  position: string;
  classYear: number;
  ufProbNow: number;
  ufProb7dAgo: number;
  delta7d: number;
  volatilityScore: number;
}

export interface MovementWindowResponse {
  items: RollingMovement[];
  lastUpdated: string;
  windowDays: number;
}

export interface MovementSummaryResponse {
  rising: number;
  falling: number;
  volatile: number;
  lastUpdated: string;
}

export interface CompetingSchoolDelta {
  playerId: string;
  slug: string;
  name: string;
  school: string;
  rankNow: number;
  rankPrior: number | null;
  delta: number;
  volatilityBoost: number;
}

export interface CompetingDeltasResponse {
  items: CompetingSchoolDelta[];
  lastUpdated: string;
}

export async function fetchMovementWindow(): Promise<MovementWindowResponse> {
  return apiFetch<MovementWindowResponse>('/api/recruiting/movement-window');
}

export async function fetchCompetingDeltas(): Promise<CompetingDeltasResponse> {
  return apiFetch<CompetingDeltasResponse>('/api/recruiting/competing-deltas');
}
