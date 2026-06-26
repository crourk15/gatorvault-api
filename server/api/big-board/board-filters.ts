/**
 * Drop stub rows from Big Board feeds — names scraped into Postgres without intel.
 */
export interface BoardIntelFields {
  compositeScore?: number | null;
  signalCount?: number;
  ufFitScore?: number | null;
}

export function hasBoardIntel(player: BoardIntelFields): boolean {
  return (
    (Number(player.compositeScore) || 0) > 0 ||
    (Number(player.signalCount) || 0) > 0 ||
    (Number(player.ufFitScore) || 0) > 0
  );
}

export function filterBoardEligiblePlayers<T extends BoardIntelFields>(players: T[]): T[] {
  return players.filter(hasBoardIntel);
}

export function rerankBoardPlayers<T>(players: T[]): Array<T & { rank: number }> {
  return players.map((player, index) => ({ ...player, rank: index + 1 }));
}

export function boardFetchMultiplier(limit: number): number {
  return Math.min(Math.max(limit * 4, limit), 2000);
}