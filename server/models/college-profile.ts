/**
 * CollegeProfile — college stats, snaps, depth chart history.
 * @see server/docs/futurecast-platform-spec.md §1.3
 */

export interface CollegeProfile {
  id: string;
  player_id: string;
  school_name: string;
  conference: string;
  jersey_number: string | null;
  years_at_school: number[];
  stats_json: Record<string, unknown>;
  snap_counts_json: Record<string, unknown> | null;
  depth_chart_history: Array<{ date: string; position: string; team_level?: string }>;
  scheme_notes: string | null;
}

export async function getCollegeProfileByPlayerId(_playerId: string): Promise<CollegeProfile | null> {
  throw new Error('TODO: implement getCollegeProfileByPlayerId — spec §1.3');
}

export async function upsertCollegeProfile(_profile: Partial<CollegeProfile> & Pick<CollegeProfile, 'player_id'>): Promise<CollegeProfile> {
  throw new Error('TODO: implement upsertCollegeProfile — spec §2.2');
}
