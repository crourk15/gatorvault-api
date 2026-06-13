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
import { checkAndCreateMovementAlerts } from './alerts';

export interface FitScoreBreakdown {
  scheme: number;
  culture: number;
  staff: number;
  need: number;
  geo: number;
}

export function fitScoreBreakdownFromRow(row: {
  fit_scheme?: number | null;
  fit_culture?: number | null;
  fit_staff?: number | null;
  fit_need?: number | null;
  fit_geo?: number | null;
}): FitScoreBreakdown {
  return {
    scheme: row.fit_scheme ?? 0,
    culture: row.fit_culture ?? 0,
    staff: row.fit_staff ?? 0,
    need: row.fit_need ?? 0,
    geo: row.fit_geo ?? 0,
  };
}

export interface MovementHistoryRow {
  date: string;
  confidence: number;
}

export interface MovementHistoryPoint {
  date: string;
  confidence: number;
}

export function movementHistoryFromRows(rows: MovementHistoryRow[]): MovementHistoryPoint[] {
  return rows.map((row) => ({
    date: row.date,
    confidence: row.confidence,
  }));
}

export const VOLATILITY_WINDOW_DAYS = 14;

export function calculateVolatility(history: MovementHistoryRow[]): number {
  if (!history || history.length < 2) return 0;

  const values = history.map((entry) => entry.confidence);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  return Math.min(100, Math.round((stdDev / 25) * 100));
}

export function recentMovementHistory(
  rows: MovementHistoryRow[],
  windowDays = VOLATILITY_WINDOW_DAYS
): MovementHistoryRow[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - Math.max(1, Math.floor(windowDays)));
  const cutoffTime = cutoff.getTime();
  return rows.filter((row) => new Date(row.date).getTime() >= cutoffTime);
}

export async function listMovementHistoryByPlayerIds(
  playerIds: string[],
  windowDays = VOLATILITY_WINDOW_DAYS
): Promise<Map<string, MovementHistoryRow[]>> {
  if (!playerIds.length) return new Map();

  const days = Math.max(1, Math.floor(windowDays));
  const { rows } = await db.query<{ player_id: string; date: string; confidence: number }>(
    `
    SELECT player_id, date::text AS date, confidence
    FROM futurecast.prediction_history
    WHERE player_id = ANY($1::uuid[])
      AND date >= CURRENT_DATE - $2::int
    ORDER BY player_id, date ASC
    `,
    [playerIds, days]
  );

  const grouped = new Map<string, MovementHistoryRow[]>();
  for (const row of rows) {
    const list = grouped.get(row.player_id) ?? [];
    list.push({ date: row.date, confidence: row.confidence });
    grouped.set(row.player_id, list);
  }
  return grouped;
}

export async function listMovementHistoryByPlayerId(
  playerId: string
): Promise<MovementHistoryRow[]> {
  const { rows } = await db.query<{ date: string; confidence: number }>(
    `
    SELECT date::text AS date, confidence
    FROM futurecast.prediction_history
    WHERE player_id = $1
    ORDER BY date ASC
    `,
    [playerId]
  );
  return rows;
}

export async function insertPredictionHistory(
  playerId: string,
  confidence: number
): Promise<void> {
  await db.query(
    `
    INSERT INTO futurecast.prediction_history (player_id, date, confidence)
    VALUES ($1, CURRENT_DATE, $2)
    ON CONFLICT (player_id, date) DO UPDATE
      SET confidence = EXCLUDED.confidence
    `,
    [playerId, confidence]
  );
}

export interface StockBoardRow extends PredictionFeedRow {
  prev_confidence: number;
  window_delta: number;
}

export async function listStockBoardRows(windowDays = 7): Promise<StockBoardRow[]> {
  const days = Math.max(1, Math.floor(windowDays));
  const { rows } = await db.query<StockBoardRow>(
    `
    SELECT
      pr.*,
      p.slug,
      p.full_name,
      p.class_year,
      p.position,
      p.status AS lifecycle,
      p.state,
      p.fit_scheme,
      p.fit_culture,
      p.fit_staff,
      p.fit_need,
      p.fit_geo,
      h.confidence AS prev_confidence,
      (pr.confidence - h.confidence) AS window_delta
    FROM ${FUTURECAST_PREDICTIONS_TABLE} pr
    JOIN ${FUTURECAST_PLAYERS_TABLE} p ON p.id = pr.player_id
    JOIN LATERAL (
      SELECT confidence
      FROM futurecast.prediction_history ph
      WHERE ph.player_id = pr.player_id
        AND ph.date < CURRENT_DATE
      ORDER BY
        CASE WHEN ph.date <= CURRENT_DATE - $1::int THEN 0 ELSE 1 END,
        ph.date DESC
      LIMIT 1
    ) h ON TRUE
    WHERE pr.status = 'ACTIVE'
      AND pr.source_type = 'MODEL'
    ORDER BY window_delta DESC
    `,
    [days]
  );
  return rows;
}

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
      p.status AS lifecycle,
      p.state,
      p.fit_scheme,
      p.fit_culture,
      p.fit_staff,
      p.fit_need,
      p.fit_geo
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

    const historyBefore = await listMovementHistoryByPlayerId(data.player_id);
    const oldVolatility = calculateVolatility(recentMovementHistory(historyBefore));
    const oldConfidence = current.confidence;

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
    await insertPredictionHistory(data.player_id, data.confidence);

    const historyAfter = await listMovementHistoryByPlayerId(data.player_id);
    const newVolatility = calculateVolatility(recentMovementHistory(historyAfter));
    await checkAndCreateMovementAlerts({
      playerId: data.player_id,
      oldConfidence,
      newConfidence: data.confidence,
      oldVolatility,
      newVolatility,
    });

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
  await insertPredictionHistory(data.player_id, data.confidence);
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
