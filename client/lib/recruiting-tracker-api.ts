import {
  fetchRecruitingBoard as fetchTrackerBoardApi,
  mapBoardPlayerToTracker,
  type TrackerPlayer,
  type RecruitingTrackerResponse,
} from './tracker-api';
import type { RecruitingBoardPlayer } from './recruiting-board-api';

export type { TrackerPlayer, RecruitingTrackerResponse as TrackerBoardData };

export async function fetchTrackerBoard(
  classYear = 2027,
  staffMode = false
): Promise<RecruitingTrackerResponse> {
  return fetchTrackerBoardApi(classYear, staffMode);
}

export function trackerPlayersFromBoard(players: RecruitingBoardPlayer[]): TrackerPlayer[] {
  return players.map(mapBoardPlayerToTracker);
}

export type TrackerStatusFilter = 'all' | TrackerPlayer['status'];

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
  if (sort === 'status') return copy.sort((a, b) => a.status.localeCompare(b.status));
  if (sort === 'ranking') {
    return copy.sort((a, b) => (a.ranking || 9999) - (b.ranking || 9999));
  }
  return copy.sort((a, b) => b.rating - a.rating);
}
