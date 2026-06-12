/**
 * GET /api/players/:id — Player Profiles 2.0
 * @see server/docs/futurecast-platform-spec.md §3.1, §4.2
 */
import type { Request, Response } from 'express';
import type { Player } from '../../../models/player';
import type { HighSchoolProfile } from '../../../models/highschool-profile';
import type { CollegeProfile } from '../../../models/college-profile';
import type { PortalProfile } from '../../../models/portal-profile';
import type { UFSpecificProfile } from '../../../models/uf-specific-profile';
import type { DiscoverySignal } from '../../../models/discovery-signal';

export interface PlayerProfileResponse {
  ok: true;
  player: Player;
  high_school: HighSchoolProfile | null;
  college: CollegeProfile | null;
  portal: PortalProfile | null;
  uf: UFSpecificProfile | null;
  signals: DiscoverySignal[];
}

export async function getPlayerProfile(_idOrSlug: string): Promise<PlayerProfileResponse | null> {
  throw new Error('TODO: getPlayerProfile — spec §3.1');
}

export async function handleGetPlayer(req: Request, res: Response): Promise<void> {
  void req;
  res.status(501).json({ ok: false, error: 'TODO: handleGetPlayer — spec §3.1' });
}
