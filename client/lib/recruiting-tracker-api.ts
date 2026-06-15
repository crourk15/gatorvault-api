import { fetchRecruitingBoard, type RecruitingBoardPlayer } from './recruiting-board-api';
import { normalizeTrackerPlayer, type TrackerPlayer } from './recruiting-tracker-types';

export type TrackerBoardData = {
  players: TrackerPlayer[];
  updatedAt: string;
  classYear: number;
};

export async function fetchTrackerBoard(
  classYear = 2027,
  staffMode = false
): Promise<TrackerBoardData> {
  const data = await fetchRecruitingBoard(classYear, staffMode);
  const pool = data.players?.length
    ? data.players
    : [...(data.commits ?? []), ...(data.targets ?? [])];

  return {
    classYear,
    updatedAt: new Date().toISOString(),
    players: pool.map(normalizeTrackerPlayer),
  };
}

export function trackerPlayersFromBoard(players: RecruitingBoardPlayer[]): TrackerPlayer[] {
  return players.map(normalizeTrackerPlayer);
}
