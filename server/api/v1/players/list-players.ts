/**
 * GET /api/players — list with filters
 * @see server/docs/futurecast-platform-spec.md §3.1
 */
import type { Request, Response } from 'express';

export interface ListPlayersQuery {
  class_year?: number;
  uf_status?: string;
  primary_position?: string;
  min_uf_fit_score?: number;
  min_discovery_score?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export async function listPlayers(_query: ListPlayersQuery): Promise<{ data: unknown[]; total: number }> {
  throw new Error('TODO: listPlayers — spec §3.1');
}

export async function handleListPlayers(req: Request, res: Response): Promise<void> {
  void req;
  res.status(501).json({ ok: false, error: 'TODO: handleListPlayers — spec §3.1' });
}
