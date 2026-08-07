/**
 * High Priority Targets API — /api/futurecast/high-priority
 * Response types: server/types/futurecast-elite-api.ts
 */
import { snapshotFirstFetch, snapshotLiveFetch } from './snapshot-fetch';
import type { FutureCastEliteCoreMetrics } from './futurecast-elite-api-types';

/** Bump when high-priority payload shape changes (align with server FUTURECAST_API_CACHE_VERSION). */
export const FUTURECAST_CLIENT_CACHE_VERSION = 16;
export const HIGH_PRIORITY_CACHE_KEY = `gv:futurecast:high-priority:v${FUTURECAST_CLIENT_CACHE_VERSION}`;
export const HIGH_PRIORITY_YEAR = 2027;
export const HIGH_PRIORITY_UNDERCLASSMEN_YEARS = [2028] as const;
export const HIGH_PRIORITY_CACHE_TTL_MS = 5 * 60_000;
export const HIGH_PRIORITY_STALE_CACHE_MAX_MS = 24 * 60 * 60_000;

export type VisitBadgeType = 'OV' | 'UV' | 'Game Day' | 'Junior Day' | 'Spring Visit';

export interface VisitBadge {
  type: VisitBadgeType;
  label: string;
}

export interface HighPriorityPredictor {
  name: string;
  score: number;
}

export interface FlipWatchScoreStack {
  uf: number;
  visit: number;
  rival: number;
  beat: number;
}

export interface FlipWatchRow {
  slug: string;
  name: string;
  committedTo: string;
  committedShort: string;
  position?: string | null;
  stars?: number | null;
  ufProbability: number | null;
  ufProbabilityLabel?: string | null;
  ufProbabilityLowConfidence?: boolean;
  visitStart: string | null;
  visitEnd: string | null;
  visitSourceLabel?: string | null;
  /** Curated Closing Class Flip Watch rank (1–5). */
  flipRank?: number | null;
  flipScore?: number;
  flipScoreLabel?: string | null;
  flipScoreStack?: FlipWatchScoreStack;
  movementNarrative?: string | null;
}

export interface MovementNarrativeRow {
  slug: string;
  name: string;
  movementNarrative: string;
}

export interface HighPriorityPlayer extends FutureCastEliteCoreMetrics {
  id: string;
  slug: string;
  name: string;
  classYear?: number | null;
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
  movementDelta: number;
  delta7d: number;
  insiderNotes: string | null;
  notePreview: string | null;
  skinny: string | null;
  visitHistory: VisitBadge[];
  ufOvStatus: string | null;
  visitStart: string | null;
  visitEnd: string | null;
  visitVerified?: boolean;
  visitSource?: string | null;
  visitSourceLabel?: string | null;
  trendHistory: Array<{ date: string; confidence: number }>;
  predictors: HighPriorityPredictor[];
  /** Confirmed On3 / store RPM competitors only — never filler. */
  competingSchools?: Array<{ name: string; pct: number }>;
  /** Confirmed On3 UF RPM % when available. */
  ufRpmPct?: number | null;
  ufProbabilitySource?: string;
  ufProbabilityLabel?: string | null;
  ufProbabilityLowConfidence?: boolean;
  /** Hot-target lane breakdown when API returns chase scoring. */
  hotLanes?: {
    staffHeat?: number;
    mustGetFit?: number;
    positionalNeed?: number;
    geoPipeline?: number;
    marketPressure?: number;
  } | null;
  hotBadges?: {
    quietChase?: boolean;
    inState?: boolean;
    homeVisit?: boolean;
    staffAssigned?: boolean;
  } | null;
  hotScore?: number | null;
  chaseScore?: number | null;
  /** Structured UF process — Closest to commit must not be On3 % alone. */
  hasUFOffer?: boolean;
  closestCommitEligible?: boolean;
  processEvidence?: {
    allowlisted?: boolean;
    hasUFOffer?: boolean;
    flOfferCount?: number;
    floridaVisits?: number;
    ov?: number;
    uv?: number;
    home?: number;
    intel90?: number;
    pursuitHits?: number;
    scheduledOv?: boolean;
    recentVisit?: boolean;
    hasProcess?: boolean;
    stillWarm?: boolean;
    closestEligible?: boolean;
    reasons?: string[];
  } | null;
}

export interface VisitRecapRow {
  slug: string;
  name: string;
  visitStart: string;
  visitEnd: string;
  visitSource?: string | null;
  visitSourceLabel?: string | null;
  ufProbability?: number | null;
  ufProbabilityLabel?: string | null;
  movementNarrative?: string | null;
}

export interface VisitBoardSnapshot {
  upcomingCount: number;
  recapCount: number;
}

export interface HighPriorityResponse {
  classYear: number;
  count: number;
  visitIntelCount?: number;
  visitRecapCount?: number;
  visitBoardSnapshot?: VisitBoardSnapshot;
  updatedAt: string;
  lastUpdated?: string;
  players: HighPriorityPlayer[];
  visitIntel?: HighPriorityPlayer[];
  visitRecap?: VisitRecapRow[];
  flipWatch?: FlipWatchRow[];
  flipWatchCount?: number;
  movementNarratives?: MovementNarrativeRow[];
}

function readHighPriorityCacheEntry(maxAgeMs: number, year = HIGH_PRIORITY_YEAR): HighPriorityResponse | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`${HIGH_PRIORITY_CACHE_KEY}:${year}`);
    if (!raw) return null;
    const { savedAt, payload } = JSON.parse(raw) as {
      savedAt: number;
      payload: HighPriorityResponse;
    };
    if (Date.now() - savedAt > maxAgeMs) return null;
    return payload;
  } catch {
    return null;
  }
}

export function readHighPriorityCache(year = HIGH_PRIORITY_YEAR): HighPriorityResponse | null {
  return readHighPriorityCacheEntry(HIGH_PRIORITY_CACHE_TTL_MS, year);
}

export function readStaleHighPriorityCache(year = HIGH_PRIORITY_YEAR): HighPriorityResponse | null {
  return readHighPriorityCacheEntry(HIGH_PRIORITY_STALE_CACHE_MAX_MS, year);
}

export function writeHighPriorityCache(payload: HighPriorityResponse): void {
  if (typeof window === 'undefined') return;
  const year = payload.classYear ?? HIGH_PRIORITY_YEAR;
  try {
    localStorage.setItem(
      `${HIGH_PRIORITY_CACHE_KEY}:${year}`,
      JSON.stringify({ savedAt: Date.now(), payload })
    );
  } catch {
    /* quota */
  }
}

export async function fetchHighPriorityTargets(
  year = HIGH_PRIORITY_YEAR
): Promise<HighPriorityResponse> {
  const path = `/api/futurecast/high-priority?year=${year}`;
  try {
    return await snapshotFirstFetch(path, () => snapshotLiveFetch<HighPriorityResponse>(path));
  } catch (err) {
    const stale = readStaleHighPriorityCache(year);
    if (stale) return stale;
    throw err;
  }
}
