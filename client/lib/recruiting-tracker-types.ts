import type { RecruitingBoardPlayer } from './recruiting-board-api';
import { playerPos, playerRating } from './recruiting-board-utils';

export type TrackerStatus = 'committed' | 'trending' | 'offered' | 'warm' | 'cold';

export type TrackerPlayer = {
  id: string;
  name: string;
  position: string;
  rating: number;
  ranking: number | null;
  status: TrackerStatus;
  school: string;
  photoUrl: string | null;
  offerStatus: string;
  prediction: string;
  slug: string;
  raw: RecruitingBoardPlayer;
};

export type TrackerStatusFilter = 'all' | TrackerStatus;

export const TRACKER_STATUS_LABELS: Record<TrackerStatus, string> = {
  committed: 'Committed',
  trending: 'Trending',
  offered: 'Offered',
  warm: 'Warm',
  cold: 'Cold',
};

export function resolveTrackerStatus(player: RecruitingBoardPlayer): TrackerStatus {
  if (player.isCommittedToUF) return 'committed';

  const uf = Number(player.ufProbability) || 0;
  const statusText = `${player.status ?? ''} ${player.ufOvStatus ?? ''}`.toLowerCase();

  if (player.movementDirection === 'up' || uf >= 0.65) return 'trending';
  if (statusText.includes('offer') || player.ufOvStatus === 'scheduled') return 'offered';
  if (uf >= 0.35) return 'warm';
  return 'cold';
}

export function normalizeTrackerPlayer(player: RecruitingBoardPlayer): TrackerPlayer {
  const status = resolveTrackerStatus(player);
  const ufPct = Math.round((Number(player.ufProbability) || 0) * 100);
  const prediction =
    player.predictionSchools?.[0] != null
      ? `${player.predictionSchools[0].school} ${player.predictionSchools[0].pct}%`
      : ufPct > 0
        ? `Florida ${ufPct}%`
        : '—';

  return {
    id: player.slug,
    name: player.name,
    position: playerPos(player),
    rating: playerRating(player),
    ranking: player.natlRank ?? player.natl ?? null,
    status,
    school: player.school ?? '—',
    photoUrl: null,
    offerStatus: player.status ?? TRACKER_STATUS_LABELS[status],
    prediction,
    slug: player.slug,
    raw: player,
  };
}

export function filterTrackerPlayers(
  players: TrackerPlayer[],
  statusFilter: TrackerStatusFilter
): TrackerPlayer[] {
  if (statusFilter === 'all') return players;
  return players.filter((p) => p.status === statusFilter);
}

export function sortTrackerPlayers(
  players: TrackerPlayer[],
  sort: 'rating' | 'ranking' | 'name' | 'status'
): TrackerPlayer[] {
  const copy = [...players];
  if (sort === 'name') return copy.sort((a, b) => a.name.localeCompare(b.name));
  if (sort === 'status') {
    return copy.sort((a, b) => a.status.localeCompare(b.status));
  }
  if (sort === 'ranking') {
    return copy.sort((a, b) => (a.ranking ?? 9999) - (b.ranking ?? 9999));
  }
  return copy.sort((a, b) => b.rating - a.rating);
}
