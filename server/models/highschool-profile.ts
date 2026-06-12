/**
 * HighSchoolProfile — HS phase data + discovery_score.
 * @see server/docs/futurecast-platform-spec.md §1.2
 */

export interface HighSchoolProfile {
  id: string;
  player_id: string;
  school_name: string;
  school_city: string;
  school_state: string;
  jersey_number: string | null;
  varsity_years: number[];
  stats_json: Record<string, unknown>;
  film_links: string[];
  awards: string[];
  camp_history: Array<{ name: string; date: string; notes?: string }>;
  combine_results: Record<string, unknown>;
  offer_list_public: string[];
  discovery_score: number;
}

export async function getHighSchoolProfileByPlayerId(_playerId: string): Promise<HighSchoolProfile | null> {
  throw new Error('TODO: implement getHighSchoolProfileByPlayerId — spec §1.2');
}

export async function upsertHighSchoolProfile(_profile: Partial<HighSchoolProfile> & Pick<HighSchoolProfile, 'player_id'>): Promise<HighSchoolProfile> {
  throw new Error('TODO: implement upsertHighSchoolProfile — spec §2.1');
}

export async function updateDiscoveryScore(_playerId: string, _score: number): Promise<void> {
  throw new Error('TODO: implement updateDiscoveryScore — spec §2.1 step 3');
}
