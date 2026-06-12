/**
 * UFSpecificProfile types and row mappers (FutureCast).
 * @see server/docs/futurecast-platform-spec.md §1.5
 * @see server/migrations/005_create_uf_specific_profiles_table.sql
 */

import { UF_STATUS, type UFStatus } from '../shared/enums';

export type { UFStatus };
export const UF_STATUSES = UF_STATUS;

export const FUTURECAST_UF_PROFILES_TABLE = 'futurecast.uf_specific_profiles';

export interface UFSpecificProfile {
  id: string;
  player_id: string;
  uf_fit_score: number | null;
  athletic_score: number | null;
  scheme_score: number | null;
  character_score: number | null;
  timeline_score: number | null;
  uf_status: UFStatus | null;
  uf_commit_probability: number | null;
  score_computed_at: string | null;
  depth_chart_path: string | null;
  evaluation_notes: string | null;
  tags: string[];
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type UFSpecificProfileInsert = Omit<UFSpecificProfile, 'id' | 'created_at' | 'updated_at'>;

export type UFSpecificProfileUpdate = Partial<Omit<UFSpecificProfile, 'id' | 'player_id' | 'created_at' | 'updated_at'>>;

export type UFSpecificProfileRow = {
  id: string;
  player_id: string;
  uf_fit_score: number | null;
  athletic_score: number | null;
  scheme_score: number | null;
  character_score: number | null;
  timeline_score: number | null;
  uf_status: string | null;
  uf_commit_probability: number | null;
  score_computed_at: string | null;
  depth_chart_path: string | null;
  evaluation_notes: string | null;
  tags: string[] | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

function assertUFStatus(value: string): UFStatus {
  if ((UF_STATUSES as readonly string[]).includes(value)) {
    return value as UFStatus;
  }
  throw new Error(`Invalid UF status: ${value}`);
}

export function ufSpecificProfileFromRow(row: UFSpecificProfileRow): UFSpecificProfile {
  return {
    id: row.id,
    player_id: row.player_id,
    uf_fit_score: row.uf_fit_score,
    athletic_score: row.athletic_score,
    scheme_score: row.scheme_score,
    character_score: row.character_score,
    timeline_score: row.timeline_score,
    uf_status: row.uf_status ? assertUFStatus(row.uf_status) : null,
    uf_commit_probability: row.uf_commit_probability,
    score_computed_at: row.score_computed_at,
    depth_chart_path: row.depth_chart_path,
    evaluation_notes: row.evaluation_notes,
    tags: row.tags ?? [],
    metadata: row.metadata ?? {},
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function ufSpecificProfileToRow(
  profile: UFSpecificProfileInsert | UFSpecificProfileUpdate
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if ('player_id' in profile && profile.player_id !== undefined) out.player_id = profile.player_id;
  if ('uf_fit_score' in profile) out.uf_fit_score = profile.uf_fit_score ?? null;
  if ('athletic_score' in profile) out.athletic_score = profile.athletic_score ?? null;
  if ('scheme_score' in profile) out.scheme_score = profile.scheme_score ?? null;
  if ('character_score' in profile) out.character_score = profile.character_score ?? null;
  if ('timeline_score' in profile) out.timeline_score = profile.timeline_score ?? null;
  if ('uf_status' in profile) out.uf_status = profile.uf_status ?? null;
  if ('uf_commit_probability' in profile) out.uf_commit_probability = profile.uf_commit_probability ?? null;
  if ('score_computed_at' in profile) out.score_computed_at = profile.score_computed_at ?? null;
  if ('depth_chart_path' in profile) out.depth_chart_path = profile.depth_chart_path ?? null;
  if ('evaluation_notes' in profile) out.evaluation_notes = profile.evaluation_notes ?? null;
  if ('tags' in profile) out.tags = profile.tags ?? [];
  if ('metadata' in profile) out.metadata = profile.metadata ?? {};
  return out;
}
