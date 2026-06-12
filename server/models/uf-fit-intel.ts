/**
 * UF Fit Intelligence repository.
 */
import { db } from './db';
import type { SignalType, UFStatus } from '../shared/enums';
import type { UfFitSignalDetail } from './uf-fit-intel-types';
import { FUTURECAST_PLAYERS_TABLE, playerFromRow, type PlayerRow } from './player-types';

export interface UfFitCandidateFilters {
  class_year?: number;
  position?: string;
}

export interface UfFitIntelRow {
  id: string;
  slug: string;
  full_name: string;
  class_year: number;
  position: string;
  uf_fit_score: number | null;
  scheme_score: number | null;
  character_score: number | null;
  athletic_score: number | null;
  timeline_score: number | null;
  uf_status: UFStatus | null;
  evaluation_notes: string | null;
  score_computed_at: string | null;
  metadata: Record<string, unknown>;
  signals: UfFitSignalDetail[];
}

type UfFitIntelDbRow = PlayerRow & {
  uf_fit_score: number | null;
  scheme_score: number | null;
  character_score: number | null;
  athletic_score: number | null;
  timeline_score: number | null;
  uf_status: string | null;
  evaluation_notes: string | null;
  score_computed_at: string | null;
  metadata: Record<string, unknown> | null;
  signal_details: UfFitSignalDetail[] | null;
};

function mapSignals(raw: UfFitSignalDetail[] | null): UfFitSignalDetail[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((s) => ({
    signal_type: s.signal_type as SignalType,
    created_at: s.created_at,
    signal_value: s.signal_value ?? {},
  }));
}

function mapRow(row: UfFitIntelDbRow): UfFitIntelRow {
  const player = playerFromRow(row);
  return {
    id: player.id,
    slug: player.slug,
    full_name: player.full_name,
    class_year: player.class_year,
    position: player.position,
    uf_fit_score: row.uf_fit_score,
    scheme_score: row.scheme_score,
    character_score: row.character_score,
    athletic_score: row.athletic_score,
    timeline_score: row.timeline_score,
    uf_status: row.uf_status ? (row.uf_status as UFStatus) : null,
    evaluation_notes: row.evaluation_notes,
    score_computed_at: row.score_computed_at,
    metadata: row.metadata ?? {},
    signals: mapSignals(row.signal_details),
  };
}

const UF_FIT_INTEL_SELECT = `
  SELECT
    p.*,
    uf.uf_fit_score,
    uf.scheme_score,
    uf.character_score,
    uf.athletic_score,
    uf.timeline_score,
    uf.uf_status,
    uf.evaluation_notes,
    uf.score_computed_at,
    uf.metadata,
    sig.signal_details
  FROM ${FUTURECAST_PLAYERS_TABLE} p
  INNER JOIN futurecast.uf_specific_profiles uf ON uf.player_id = p.id
  LEFT JOIN (
    SELECT
      player_id,
      json_agg(
        json_build_object(
          'signal_type', signal_type::text,
          'created_at', created_at,
          'signal_value', COALESCE(signal_value, '{}'::jsonb)
        )
        ORDER BY created_at ASC
      ) AS signal_details
    FROM futurecast.discovery_signals
    GROUP BY player_id
  ) sig ON sig.player_id = p.id
`;

export async function listUfFitCandidates(
  filters: UfFitCandidateFilters = {}
): Promise<UfFitIntelRow[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (filters.class_year != null) {
    conditions.push(`p.class_year = $${idx++}`);
    params.push(filters.class_year);
  }
  if (filters.position) {
    conditions.push(`p.position = $${idx++}`);
    params.push(filters.position);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await db.query<UfFitIntelDbRow>(
    `
    ${UF_FIT_INTEL_SELECT}
    ${where}
    ORDER BY uf.uf_fit_score DESC NULLS LAST, p.full_name ASC
    `,
    params
  );

  return rows.map(mapRow);
}

export async function getUfFitIntelByPlayerId(playerId: string): Promise<UfFitIntelRow | null> {
  const { rows } = await db.query<UfFitIntelDbRow>(
    `
    ${UF_FIT_INTEL_SELECT}
    WHERE p.id = $1
    LIMIT 1
    `,
    [playerId]
  );
  if (!rows.length) return null;
  return mapRow(rows[0]);
}

export function ufFitRowToEngineInput(row: UfFitIntelRow) {
  return {
    id: row.id,
    uf_fit_score_stored: row.uf_fit_score,
    scheme_score: row.scheme_score,
    character_score: row.character_score,
    athletic_score: row.athletic_score,
    timeline_score: row.timeline_score,
    uf_status: row.uf_status,
    evaluation_notes: row.evaluation_notes,
    score_computed_at: row.score_computed_at,
    metadata: row.metadata,
    signals: row.signals,
  };
}
