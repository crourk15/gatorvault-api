/**
 * FutureCast Player Profile API client.
 * @see server/api/players/
 */
import { getApiBase, type BigBoardPlayer } from './big-board-api';
import { playerProfilePath } from './player-routes';

export type PlayerLifecycle = 'HS' | 'COLLEGE' | 'PORTAL';

export interface FitScoreBreakdown {
  scheme: number;
  culture: number;
  staff: number;
  need: number;
  geo: number;
}

export interface MovementHistoryPoint {
  date: string;
  confidence: number;
}

export interface PlayerCore {
  id: string;
  fullName: string;
  slug: string;
  classYear: number;
  position: string;
  status: PlayerLifecycle;
  height: number | null;
  weight: number | null;
  hometown: string | null;
  state: string | null;
  highSchool: string | null;
  stars: number | null;
  compositeRating: number | null;
  rankingNational: number | null;
  rankingPosition: number | null;
  rankingState: number | null;
  committedTo: string | null;
  ufFitScore?: number | null;
  fitScoreBreakdown?: FitScoreBreakdown | null;
  movementHistory?: MovementHistoryPoint[];
  volatilityScore?: number;
}

export interface HighSchoolProfile {
  id: string;
  playerId: string;
  offers: Array<{ school?: string; date?: string; [key: string]: unknown }>;
  stats: Record<string, unknown>;
  recruitingNotes: string | null;
  discoveryScore: number | null;
}

export interface CollegeProfile {
  id: string;
  playerId: string;
  college: string;
  yearsPlayed: number | null;
  gamesPlayed: number | null;
  snaps: Record<string, unknown>;
  stats: Record<string, unknown>;
  depthHistory: unknown[];
}

export interface PortalProfile {
  id: string;
  playerId: string;
  previousSchool: string | null;
  enteredPortalAt: string | null;
  exitedPortalAt: string | null;
  portalStatus: string;
  destinationSchool: string | null;
  eligibilityRemaining: number | null;
  reasonTags: string[];
  portalLikelihood: number | null;
  likelihoodReason: string | null;
}

export interface UFSpecificProfile {
  id: string;
  playerId: string;
  ufFitScore: number | null;
  athleticScore: number | null;
  schemeScore: number | null;
  characterScore: number | null;
  timelineScore: number | null;
  ufStatus: string | null;
  ufCommitProbability: number | null;
  evaluationNotes: string | null;
  tags: string[];
  metadata: Record<string, unknown>;
}

export interface DiscoverySignal {
  id: string;
  playerId: string;
  signalType: string;
  signalValue: Record<string, unknown>;
  createdAt: string;
}

export interface PlayerProfilesResponse {
  highSchoolProfile: HighSchoolProfile | null;
  collegeProfile: CollegeProfile | null;
  portalProfile: PortalProfile | null;
  ufSpecificProfile: UFSpecificProfile | null;
}

export interface PlayerProfileBundle extends PlayerProfilesResponse {
  player: PlayerCore;
  signals: DiscoverySignal[];
  related: BigBoardPlayer[];
}

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${getApiBase()}${path}`);
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    if (res.status === 502 || res.status === 503) {
      message =
        'This profile is temporarily unavailable. The API may be waking up — try again in a moment.';
    }
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export async function fetchPlayerBySlug(slug: string): Promise<{ player: PlayerCore }> {
  return apiFetch(`/api/players/slug/${encodeURIComponent(slug)}`);
}

export async function fetchPlayerById(id: string): Promise<{ player: PlayerCore }> {
  return apiFetch(`/api/players/${encodeURIComponent(id)}`);
}

export async function fetchPlayerProfiles(id: string): Promise<PlayerProfilesResponse> {
  return apiFetch(`/api/players/${id}/profiles`);
}

export async function fetchPlayerSignals(
  id: string,
  limit = 100
): Promise<{ signals: DiscoverySignal[] }> {
  return apiFetch(`/api/players/${id}/signals?limit=${limit}`);
}

export async function fetchRelatedPlayers(
  id: string,
  limit = 6
): Promise<{ players: BigBoardPlayer[] }> {
  return apiFetch(`/api/players/${id}/related?limit=${limit}`);
}

/** Load full profile bundle in parallel (slug → id → profiles, signals, related). */
export async function fetchPlayerProfile(slug: string): Promise<PlayerProfileBundle> {
  const slugPath = `/api/players/slug/${encodeURIComponent(slug)}`;
  const res = await fetch(`${getApiBase()}${slugPath}`);
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    if (res.status === 502 || res.status === 503) {
      message =
        'This portal player profile is temporarily unavailable. Try again later.';
    }
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }

  const slugBody = (await res.json()) as PlayerProfileBundle & { source?: string };
  if (slugBody.source === 'recruiting-store') {
    return {
      player: slugBody.player,
      highSchoolProfile: slugBody.highSchoolProfile ?? null,
      collegeProfile: slugBody.collegeProfile ?? null,
      portalProfile: slugBody.portalProfile ?? null,
      ufSpecificProfile: slugBody.ufSpecificProfile ?? null,
      signals: slugBody.signals ?? [],
      related: slugBody.related ?? [],
    };
  }

  const { player } = slugBody;
  const [profiles, signalsRes, relatedRes] = await Promise.all([
    fetchPlayerProfiles(player.id),
    fetchPlayerSignals(player.id),
    fetchRelatedPlayers(player.id),
  ]);
  return {
    player,
    ...profiles,
    signals: signalsRes.signals,
    related: relatedRes.players,
  };
}

export function buildPlayerShareUrl(
  slug: string,
  lifecycle?: string | null,
  inVault = false,
  tab?: string
): string {
  const path = playerProfilePath(slug, lifecycle, inVault);
  if (typeof window === 'undefined') {
    return `${path}${tab ? `?tab=${tab}` : ''}`;
  }
  const url = new URL(window.location.href);
  url.pathname = path;
  url.search = '';
  if (tab) url.searchParams.set('tab', tab);
  return url.toString();
}
