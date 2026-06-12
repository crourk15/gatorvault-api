/**
 * UFSpecificProfile — UF Fit Score + sub-scores + war room notes.
 * @see server/docs/futurecast-platform-spec.md §1.5
 */

export type UfStatus = 'none' | 'watchlist' | 'target' | 'commit' | 'former_target';

export interface UFSpecificProfile {
  id: string;
  player_id: string;
  uf_fit_score: number;
  scheme_fit_score: number;
  positional_need_score: number;
  athletic_profile_score: number;
  geographic_ties_score: number;
  timeline_fit_score: number;
  culture_fit_score: number;
  recruiting_momentum_score: number;
  uf_status: UfStatus;
  war_room_notes: string;
  uf_commit_probability: number | null;
  score_computed_at: string | null;
}

export async function getUFProfileByPlayerId(_playerId: string): Promise<UFSpecificProfile | null> {
  throw new Error('TODO: implement getUFProfileByPlayerId — spec §1.5');
}

export async function upsertUFProfile(_profile: Partial<UFSpecificProfile> & Pick<UFSpecificProfile, 'player_id'>): Promise<UFSpecificProfile> {
  throw new Error('TODO: implement upsertUFProfile — spec §2.3');
}

export async function updateUfStatus(_playerId: string, _status: UfStatus): Promise<void> {
  throw new Error('TODO: implement updateUfStatus — spec §2.1 step 4');
}
