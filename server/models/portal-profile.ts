/**
 * PortalProfile — portal status, likelihood, reason tags.
 * @see server/docs/futurecast-platform-spec.md §1.4
 */

export type PortalStatus = 'none' | 'watchlist' | 'in_portal' | 'committed';
export type UfInterestLevel = 'none' | 'light' | 'moderate' | 'strong';

export interface PortalProfile {
  id: string;
  player_id: string;
  portal_status: PortalStatus;
  entry_date: string | null;
  exit_date: string | null;
  destination_school: string | null;
  reason_tags: string[];
  portal_likelihood_score: number;
  uf_interest_level: UfInterestLevel;
}

export async function getPortalProfileByPlayerId(_playerId: string): Promise<PortalProfile | null> {
  throw new Error('TODO: implement getPortalProfileByPlayerId — spec §1.4');
}

export async function upsertPortalProfile(_profile: Partial<PortalProfile> & Pick<PortalProfile, 'player_id'>): Promise<PortalProfile> {
  throw new Error('TODO: implement upsertPortalProfile — spec §2.2');
}

export async function listPortalWatchlist(_filters: Record<string, unknown>): Promise<PortalProfile[]> {
  throw new Error('TODO: implement listPortalWatchlist — spec §3.3');
}
