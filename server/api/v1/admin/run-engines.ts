/**
 * Admin engine triggers.
 * @see server/docs/futurecast-platform-spec.md §3.5
 */
import type { Request, Response } from 'express';
import { runEarlyDiscovery } from '../../../engines/futurecast/early-discovery';
import { runPortalIntelligence } from '../../../engines/futurecast/portal-intel';
import { runUfFitRecompute } from '../../../engines/futurecast/uf-fit';

export async function handleRunEarlyDiscovery(req: Request, res: Response): Promise<void> {
  // TODO(Phase 2): verify admin pin
  void req;
  const result = await runEarlyDiscovery();
  res.json({ ok: true, result });
}

export async function handleRunPortalIntel(req: Request, res: Response): Promise<void> {
  void req;
  const result = await runPortalIntelligence();
  res.json({ ok: true, result });
}

export async function handleRunUfFitRecompute(req: Request, res: Response): Promise<void> {
  // TODO(Phase 2): accept { player_id } in body — spec §3.5
  void req;
  const result = await runUfFitRecompute();
  res.json({ ok: true, result });
}

export function mountAdminEngineRoutes(_app: unknown): void {
  // TODO(Phase 3): app.post('/api/admin/engines/...', ...)
  throw new Error('TODO: mountAdminEngineRoutes — spec §3.5');
}
