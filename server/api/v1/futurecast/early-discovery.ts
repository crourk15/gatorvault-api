/**
 * GET /api/futurecast/early-discovery
 * @see server/docs/futurecast-platform-spec.md §3.4, §4.1 Early Discovery tab
 */
import type { Request, Response } from 'express';

export interface EarlyDiscoveryQuery {
  class_year_gte?: number;
  min_discovery_score?: number;
  min_uf_fit_score?: number;
  page?: number;
  limit?: number;
}

export async function getEarlyDiscovery(_query: EarlyDiscoveryQuery): Promise<unknown[]> {
  throw new Error('TODO: getEarlyDiscovery — spec §3.4');
}

export async function handleEarlyDiscovery(req: Request, res: Response): Promise<void> {
  void req;
  res.status(501).json({ ok: false, error: 'TODO: handleEarlyDiscovery — spec §3.4' });
}
