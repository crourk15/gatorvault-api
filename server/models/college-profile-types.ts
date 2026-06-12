/**
 * CollegeProfile types and row mappers (FutureCast).
 * @see server/docs/futurecast-platform-spec.md §1.3
 * @see server/migrations/003_create_college_profiles_table.sql
 */

export const FUTURECAST_COLLEGE_PROFILES_TABLE = 'futurecast.college_profiles';

export interface CollegeProfile {
  id: string;
  player_id: string;
  college: string;
  years_played: number | null;
  games_played: number | null;
  snaps: Record<string, unknown>;
  stats: Record<string, unknown>;
  depth_history: unknown[];
  created_at: string;
  updated_at: string;
}

export type CollegeProfileInsert = Omit<CollegeProfile, 'id' | 'created_at' | 'updated_at'>;

export type CollegeProfileUpdate = Partial<Omit<CollegeProfile, 'id' | 'player_id' | 'created_at' | 'updated_at'>>;

export type CollegeProfileRow = {
  id: string;
  player_id: string;
  college: string;
  years_played: number | null;
  games_played: number | null;
  snaps: Record<string, unknown> | null;
  stats: Record<string, unknown> | null;
  depth_history: unknown[] | null;
  created_at: string;
  updated_at: string;
};

export function collegeProfileFromRow(row: CollegeProfileRow): CollegeProfile {
  return {
    id: row.id,
    player_id: row.player_id,
    college: row.college,
    years_played: row.years_played,
    games_played: row.games_played,
    snaps: row.snaps ?? {},
    stats: row.stats ?? {},
    depth_history: row.depth_history ?? [],
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function collegeProfileToRow(
  profile: CollegeProfileInsert | CollegeProfileUpdate
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if ('player_id' in profile && profile.player_id !== undefined) out.player_id = profile.player_id;
  if ('college' in profile && profile.college !== undefined) out.college = profile.college;
  if ('years_played' in profile) out.years_played = profile.years_played ?? null;
  if ('games_played' in profile) out.games_played = profile.games_played ?? null;
  if ('snaps' in profile) out.snaps = profile.snaps ?? {};
  if ('stats' in profile) out.stats = profile.stats ?? {};
  if ('depth_history' in profile) out.depth_history = profile.depth_history ?? [];
  return out;
}
