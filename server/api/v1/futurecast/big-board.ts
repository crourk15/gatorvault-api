/**
 * GET /api/futurecast/big-board
 * @see server/docs/futurecast-platform-spec.md §3.2, §4.1
 */
import type { Request, Response } from 'express';

export type BigBoardTab =
  | 'top_targets'
  | 'early_discovery'
  | 'portal_watchlist'
  | 'predictions'
  | 'movement_tracker';

export interface BigBoardQuery {
  class_year: number;
  tab?: BigBoardTab;
  page?: number;
  limit?: number;
}

export interface BigBoardRow {
  player_id: string;
  slug: string;
  name: string;
  primary_position: string;
  class_year: number;
  photo_url: string | null;
  uf_fit_score: number;
  portal_likelihood_score: number;
  discovery_score: number;
  uf_status: string;
  reason_tags: string[];
  uf_commit_probability: number | null;
  rank: number;
}

/** TODO(Phase 3): implement tab filters — spec §3.2 table */
export async function getBigBoard(_query: BigBoardQuery): Promise<BigBoardRow[]> {
  throw new Error('TODO: getBigBoard');
}

export async function handleBigBoard(req: Request, res: Response): Promise<void> {
  // TODO(Phase 3): parse query, call getBigBoard, return { ok, data, meta }
  void req;
  res.status(501).json({ ok: false, error: 'TODO: handleBigBoard — spec §3.2' });
}
