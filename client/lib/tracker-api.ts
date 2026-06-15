/**
 * Recruiting Tracker API mapping — normalizes /api/recruiting/board for Tracker UI.
 */
import { apiFetch } from './api-fetch';
import type { RecruitingBoardPlayer, RecruitingBoardResponse } from './recruiting-board-api';
import { playerPos, playerRating } from './recruiting-board-utils';

export type TrackerStatus = 'Committed' | 'Trending' | 'Offered' | 'Warm' | 'Cold';

export interface TrackerPlayer {
  id: string;
  name: string;
  position: string;
  rating: number;
  ranking: number;
  status: TrackerStatus;
  school: string;
  photoUrl: string;
  offerStatus: string;
  prediction?: string;
  slug: string;
}

export interface RecruitingTrackerResponse {
  players: TrackerPlayer[];
  updatedAt: string;
  classYear: number;
}

function resolveStatus(player: RecruitingBoardPlayer): TrackerStatus {
  if (player.isCommittedToUF) return 'Committed';

  const uf = Number(player.ufProbability) || 0;
  const statusText = `${player.status ?? ''} ${player.ufOvStatus ?? ''}`.toLowerCase();

  if (player.movementDirection === 'up' || uf >= 0.65) return 'Trending';
  if (statusText.includes('offer') || player.ufOvStatus === 'scheduled') return 'Offered';
  if (uf >= 0.35) return 'Warm';
  return 'Cold';
}

export function mapBoardPlayerToTracker(player: RecruitingBoardPlayer): TrackerPlayer {
  const status = resolveStatus(player);
  const ufPct = Math.round((Number(player.ufProbability) || 0) * 100);
  const prediction =
    player.predictionSchools?.[0] != null
      ? `${player.predictionSchools[0].school} ${player.predictionSchools[0].pct}%`
      : ufPct > 0
        ? `Florida ${ufPct}%`
        : undefined;

  return {
    id: player.slug,
    slug: player.slug,
    name: player.name,
    position: playerPos(player),
    rating: playerRating(player),
    ranking: player.natlRank ?? player.natl ?? 0,
    status,
    school: player.school ?? '—',
    photoUrl: '',
    offerStatus: player.status ?? status,
    prediction,
  };
}

export async function fetchRecruitingBoard(
  classYear = 2027,
  staffMode = false
): Promise<RecruitingTrackerResponse> {
  const staff = staffMode ? '&mode=staff' : '';
  const data = await apiFetch<RecruitingBoardResponse>(
    `/api/recruiting/board?class=${classYear}${staff}`
  );
  const pool = data.players?.length
    ? data.players
    : [...(data.commits ?? []), ...(data.targets ?? [])];

  return {
    classYear,
    updatedAt: new Date().toISOString(),
    players: pool.map(mapBoardPlayerToTracker),
  };
}

/** CSS status slug (lowercase) for tracker-card.status-* classes */
export function trackerStatusClass(status: TrackerStatus): string {
  return status.toLowerCase();
}
