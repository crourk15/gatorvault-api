/**
 * High Priority Targets API — /api/futurecast/high-priority
 */
import { apiFetch } from './api-fetch';

export const HIGH_PRIORITY_YEAR = 2027;
export const HIGH_PRIORITY_CACHE_KEY = 'gv:futurecast:high-priority:v1';
export const HIGH_PRIORITY_CACHE_TTL_MS = 5 * 60_000;

export type VisitBadgeType = 'OV' | 'UV' | 'Game Day' | 'Junior Day' | 'Spring Visit';

export interface VisitBadge {
  type: VisitBadgeType;
  label: string;
}

export interface HighPriorityPredictor {
  name: string;
  score: number;
}

export interface HighPriorityPlayer {
  id: string;
  slug: string;
  name: string;
  position: string;
  school: string | null;
  htWt: string | null;
  stars: number | null;
  headliner: boolean;
  committedTo: string | null;
  compositeScore: number;
  nationalRank: number | null;
  positionRank: number | null;
  stateRank: number | null;
  rating: number | null;
  natlRank: number | null;
  posRank: number | null;
  ufProbability: number;
  movementDelta: number;
  fitScore: number;
  staffConfidence: number;
  priorityScore: number;
  insiderNotes: string | null;
  notePreview: string | null;
  skinny: string | null;
  visitHistory: VisitBadge[];
  ufOvStatus: string | null;
  visitStart: string | null;
  visitEnd: string | null;
  trendHistory: Array<{ date: string; confidence: number }>;
  predictors: HighPriorityPredictor[];
}

export interface HighPriorityResponse {
  classYear: number;
  count: number;
  updatedAt: string;
  players: HighPriorityPlayer[];
}

export function readHighPriorityCache(): HighPriorityResponse | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(HIGH_PRIORITY_CACHE_KEY);
    if (!raw) return null;
    const { savedAt, payload } = JSON.parse(raw) as {
      savedAt: number;
      payload: HighPriorityResponse;
    };
    if (Date.now() - savedAt > HIGH_PRIORITY_CACHE_TTL_MS) return null;
    return payload;
  } catch {
    return null;
  }
}

export function writeHighPriorityCache(payload: HighPriorityResponse): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      HIGH_PRIORITY_CACHE_KEY,
      JSON.stringify({ savedAt: Date.now(), payload })
    );
  } catch {
    /* quota */
  }
}

export async function fetchHighPriorityTargets(
  year = HIGH_PRIORITY_YEAR
): Promise<HighPriorityResponse> {
  return apiFetch<HighPriorityResponse>(`/api/futurecast/high-priority?year=${year}`);
}
