/**
 * HighSchoolProfile types and row mappers (FutureCast).
 * @see server/docs/futurecast-platform-spec.md §1.2
 * @see server/migrations/002_create_high_school_profiles_table.sql
 */

export const FUTURECAST_HS_PROFILES_TABLE = 'futurecast.high_school_profiles';

export interface HighSchoolProfile {
  id: string;
  player_id: string;
  offers: unknown[];
  stats: Record<string, unknown>;
  recruiting_notes: string | null;
  discovery_score: number | null;
  created_at: string;
  updated_at: string;
}

export type HighSchoolProfileInsert = Omit<HighSchoolProfile, 'id' | 'created_at' | 'updated_at'>;

export type HighSchoolProfileUpdate = Partial<Omit<HighSchoolProfile, 'id' | 'player_id' | 'created_at' | 'updated_at'>>;

export type HighSchoolProfileRow = {
  id: string;
  player_id: string;
  offers: unknown[] | null;
  stats: Record<string, unknown> | null;
  recruiting_notes: string | null;
  discovery_score: number | null;
  created_at: string;
  updated_at: string;
};

export function hsProfileFromRow(row: HighSchoolProfileRow): HighSchoolProfile {
  return {
    id: row.id,
    player_id: row.player_id,
    offers: row.offers ?? [],
    stats: row.stats ?? {},
    recruiting_notes: row.recruiting_notes,
    discovery_score: row.discovery_score,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function hsProfileToRow(
  profile: HighSchoolProfileInsert | HighSchoolProfileUpdate
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if ('player_id' in profile && profile.player_id !== undefined) out.player_id = profile.player_id;
  if ('offers' in profile) out.offers = profile.offers ?? [];
  if ('stats' in profile) out.stats = profile.stats ?? {};
  if ('recruiting_notes' in profile) out.recruiting_notes = profile.recruiting_notes ?? null;
  if ('discovery_score' in profile) out.discovery_score = profile.discovery_score ?? null;
  return out;
}
