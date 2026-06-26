/**
 * Attach recruiting composite + rank fields to FutureCast API payloads.
 */
import {
  loadRecruitingRankings,
  type PlayerRankingEntry,
  type RecruitingRatingSource,
} from '../../lib/load-recruiting-rankings';

export interface RankingFields {
  compositeScore: number;
  nationalRank: number | null;
  positionRank: number | null;
  stateRank: number | null;
  ratingSource: RecruitingRatingSource | null;
  school: string | null;
  inState: boolean;
  rating?: number | null;
  natlRank?: number | null;
  posRank?: number | null;
  stars?: number | null;
}

function lookupRanking(player: Record<string, unknown>): PlayerRankingEntry | undefined {
  const index = loadRecruitingRankings();
  const keys = [
    player.playerSlug,
    player.slug,
    player.playerId,
    player.id,
  ];

  for (const raw of keys) {
    if (raw == null || raw === '') continue;
    const hit = index.get(String(raw).toLowerCase().trim());
    if (hit) return hit;
  }

  return undefined;
}

export function enrichWithRankings<T extends Record<string, unknown>>(
  player: T
): T & RankingFields {
  const r = lookupRanking(player);
  const compositeScore = r?.compositeScore ?? 0;
  const { applyEditorialPositionToPlayer } = require('../../lib/recruiting-editorial-positions') as {
    applyEditorialPositionToPlayer: (p: Record<string, unknown>) => Record<string, unknown>;
  };

  const merged = {
    ...player,
    compositeScore,
    nationalRank: r?.nationalRank ?? null,
    positionRank: r?.positionRank ?? null,
    stateRank: r?.stateRank ?? null,
    ratingSource: r?.ratingSource ?? null,
    school: r?.school ?? null,
    inState: r?.inState ?? false,
    rating: r?.compositeScore ?? (player.rating as number | null | undefined) ?? null,
    natlRank: r?.nationalRank ?? (player.natlRank as number | null | undefined) ?? null,
    posRank: r?.positionRank ?? (player.posRank as number | null | undefined) ?? null,
    stars: r?.stars ?? (player.stars as number | null | undefined) ?? null,
    position:
      r?.position ??
      (player.position as string | null | undefined) ??
      (player.pos as string | null | undefined) ??
      null,
    pos:
      r?.position ??
      (player.pos as string | null | undefined) ??
      (player.position as string | null | undefined) ??
      null,
    state: (player.state as string | null | undefined) ?? null,
  };

  return applyEditorialPositionToPlayer(merged) as T & RankingFields;
}

export function enrichFeedPlayers<T extends Record<string, unknown>>(
  players: T[]
): Array<T & RankingFields> {
  return players.map(enrichWithRankings);
}
