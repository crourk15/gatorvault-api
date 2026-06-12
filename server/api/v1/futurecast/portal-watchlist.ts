/**
 * Portal Watchlist — GET /api/portal/watchlist
 * @see server/docs/futurecast-platform-spec.md §3.3, §4.3
 */
import type { Request, Response } from 'express';

export interface PortalWatchlistQuery {
  min_portal_likelihood?: number;
  min_uf_fit_score?: number;
  primary_position?: string;
  portal_status?: string;
}

export async function getPortalWatchlist(_query: PortalWatchlistQuery): Promise<unknown[]> {
  throw new Error('TODO: getPortalWatchlist — spec §3.3');
}

export async function handlePortalWatchlist(req: Request, res: Response): Promise<void> {
  void req;
  res.status(501).json({ ok: false, error: 'TODO: handlePortalWatchlist — spec §3.3' });
}
