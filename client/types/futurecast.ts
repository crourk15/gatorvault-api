/**
 * Shared FutureCast player ranking fields from live recruiting store.
 */
export interface RankingFields {
  compositeScore: number;
  nationalRank: number | null;
  positionRank: number | null;
  stateRank: number | null;
  rating?: number | null;
  natlRank?: number | null;
  posRank?: number | null;
  stars?: number | null;
}
