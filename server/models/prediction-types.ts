/**
 * FutureCast Predictions types.
 */
export const PREDICTION_SOURCE_TYPES = ['MODEL', 'STAFF', 'FAN', 'BLENDED'] as const;
export type PredictionSourceType = (typeof PREDICTION_SOURCE_TYPES)[number];

export const PREDICTION_STATUSES = ['ACTIVE', 'HIT', 'MISS', 'WITHDRAWN'] as const;
export type PredictionStatus = (typeof PREDICTION_STATUSES)[number];

export const FUTURECAST_PREDICTIONS_TABLE = 'futurecast.predictions';

export interface Prediction {
  id: string;
  player_id: string;
  school: string;
  confidence: number;
  source_type: PredictionSourceType;
  predictor_id: string;
  status: PredictionStatus;
  created_at: string;
  updated_at: string;
}

export interface PredictionInsert {
  player_id: string;
  school: string;
  confidence: number;
  source_type: PredictionSourceType;
  predictor_id?: string;
  status?: PredictionStatus;
}

export interface PredictionRow {
  id: string;
  player_id: string;
  school: string;
  confidence: number;
  source_type: string;
  predictor_id: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface PredictionFeedRow extends PredictionRow {
  slug: string;
  full_name: string;
  class_year: number;
  position: string;
}

export interface PredictorStatsRow {
  predictor_id: string;
  picks: number;
  hits: number;
  misses: number;
}

function assertSourceType(value: string): PredictionSourceType {
  if ((PREDICTION_SOURCE_TYPES as readonly string[]).includes(value)) {
    return value as PredictionSourceType;
  }
  throw new Error(`Invalid prediction source type: ${value}`);
}

function assertStatus(value: string): PredictionStatus {
  if ((PREDICTION_STATUSES as readonly string[]).includes(value)) {
    return value as PredictionStatus;
  }
  throw new Error(`Invalid prediction status: ${value}`);
}

export function predictionFromRow(row: PredictionRow): Prediction {
  return {
    id: row.id,
    player_id: row.player_id,
    school: row.school,
    confidence: row.confidence,
    source_type: assertSourceType(row.source_type),
    predictor_id: row.predictor_id,
    status: assertStatus(row.status),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
