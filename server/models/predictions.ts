/**
 * Predictions repository — FutureCast Picks storage + queries.
 */
import { db } from './db';
import {
  FUTURECAST_PREDICTIONS_TABLE,
  type Prediction,
  type PredictionFeedRow,
  type PredictionInsert,
  type PredictionRow,
  type PredictorStatsRow,
  predictionFromRow,
} from './prediction-types';
import type { SignalType } from '../shared/enums';
import { FUTURECAST_PLAYERS_TABLE } from './player-types';

export interface ListPredictionsFilters {
  class_year?: number;
  position?: string;
  status?: string;
  limit?: number;
}

export interface PredictionCandidateRow {
  id: string;
  slug: string;
  full_name: string;
  class_year: number;
  position: string;
  status: string;
  committed_to: string | null;
  stars: number | null;
  composite_rating: number | null;
  hometown: string | null;
  state: string | null;
  uf_fit_score: number | null;
  scheme_score: number | null;
  character_score: number | null;
  athletic_score: number | null;
  timeline_score: number | null;
  uf_status: string | null;
  portal_likelihood_stored: number | null;
  previous_school: string | null;
  college: string | null;
  hs_offers: unknown[] | null;
  signal_types: string[] | null;
}

export async function listPredictions(
  filters: ListPredictionsFilters = {}
): Promise<PredictionFeedRow[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (filters.status) {
    conditions.push(`pr.status = $${idx++}`);
    params.push(String(filters.status).toUpperCase());
  }
  if (filters.class_year != null) {
    conditions.push(`p.class_year = $${idx++}`);
    params.push(filters.class_year);
  }
  if (filters.position) {
    conditions.push(`p.position = $${idx++}`);
    params.push(filters.position);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = Math.min(Math.max(filters.limit ?? 100, 1), 500);
  params.push(limit);

  const { rows } = await db.query<PredictionFeedRow>(
    `
    SELECT
      pr.*,
      p.slug,
      p.full_name,
      p.class_year,
      p.position,
      p.status AS lifecycle
    FROM ${FUTURECAST_PREDICTIONS_TABLE} pr
    JOIN ${FUTURECAST_PLAYERS_TABLE} p ON p.id = pr.player_id
    ${where}
    ORDER BY pr.confidence DESC, pr.updated_at DESC
    LIMIT $${idx}
    `,
    params
  );

  return rows;
}

export async function listPredictionsByPlayerId(playerId: string): Promise<Prediction[]> {
  const { rows } = await db.query<PredictionRow>(
    `
    SELECT * FROM ${FUTURECAST_PREDICTIONS_TABLE}
    WHERE player_id = $1
    ORDER BY
      CASE status WHEN 'ACTIVE' THEN 0 WHEN 'HIT' THEN 1 WHEN 'MISS' THEN 2 ELSE 3 END,
      confidence DESC,
      updated_at DESC
    `,
    [playerId]
  );
  return rows.map(predictionFromRow);
}

export async function upsertActiveModelPrediction(
  data: PredictionInsert
): Promise<Prediction> {
  const predictorId = data.predictor_id ?? 'system';
  const { rows: existing } = await db.query<PredictionRow>(
    `
    SELECT * FROM ${FUTURECAST_PREDICTIONS_TABLE}
    WHERE player_id = $1 AND source_type = 'MODEL' AND predictor_id = $2 AND status = 'ACTIVE'
    LIMIT 1
    `,
    [data.player_id, predictorId]
  );

  if (existing.length) {
    const current = existing[0];
    if (current.school === data.school && current.confidence === data.confidence) {
      return predictionFromRow(current);
    }
    const delta = data.confidence - current.confidence;
    const { rows } = await db.query<PredictionRow>(
      `
      UPDATE ${FUTURECAST_PREDICTIONS_TABLE}
      SET school = $3, confidence = $4, delta = $5, updated_at = now()
      WHERE id = $1 AND player_id = $2
      RETURNING *
      `,
      [current.id, data.player_id, data.school, data.confidence, delta]
    );
    return predictionFromRow(rows[0]);
  }

  const { rows } = await db.query<PredictionRow>(
    `
    INSERT INTO ${FUTURECAST_PREDICTIONS_TABLE}
      (player_id, school, confidence, delta, source_type, predictor_id, status)
    VALUES ($1, $2, $3, 0, 'MODEL', $4, 'ACTIVE')
    RETURNING *
    `,
    [data.player_id, data.school, data.confidence, predictorId]
  );
  return predictionFromRow(rows[0]);
}

export async function listPredictorStats(): Promise<PredictorStatsRow[]> {
  const { rows } = await db.query<PredictorStatsRow>(
    `
    SELECT
      predictor_id,
      COUNT(*)::int AS picks,
      COUNT(*) FILTER (WHERE status = 'HIT')::int AS hits,
      COUNT(*) FILTER (WHERE status = 'MISS')::int AS misses
    FROM ${FUTURECAST_PREDICTIONS_TABLE}
    GROUP BY predictor_id
    ORDER BY hits DESC, picks DESC
    `
  );
  return rows;
}

export async function listPredictionCandidates(
  filters: { class_year?: number; position?: string } = {}
): Promise<PredictionCandidateRow[]> {
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

  const { rows } = await db.query<PredictionCandidateRow>(
    `
    SELECT
      p.id,
      p.slug,
      p.full_name,
      p.class_year,
      p.position,
      p.status,
      p.committed_to,
      p.stars,
      p.composite_rating,
      p.hometown,
      p.state,
      uf.uf_fit_score,
      uf.scheme_score,
      uf.character_score,
      uf.athletic_score,
      uf.timeline_score,
      uf.uf_status,
      pp.portal_likelihood AS portal_likelihood_stored,
      pp.previous_school,
      cp.college,
      hs.offers AS hs_offers,
      sig.signal_types
    FROM ${FUTURECAST_PLAYERS_TABLE} p
    LEFT JOIN futurecast.uf_specific_profiles uf ON uf.player_id = p.id
    LEFT JOIN futurecast.portal_profiles pp ON pp.player_id = p.id
    LEFT JOIN futurecast.college_profiles cp ON cp.player_id = p.id
    LEFT JOIN futurecast.high_school_profiles hs ON hs.player_id = p.id
    LEFT JOIN (
      SELECT player_id, array_agg(signal_type::text) AS signal_types
      FROM futurecast.discovery_signals
      GROUP BY player_id
    ) sig ON sig.player_id = p.id
    ${where}
    ORDER BY p.class_year DESC, p.full_name ASC
    LIMIT 500
    `,
    params
  );

  return rows;
}

export function mapSignalTypes(raw: string[] | null): SignalType[] {
  return (raw ?? []).filter(Boolean) as SignalType[];
}
