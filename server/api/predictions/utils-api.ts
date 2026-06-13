/**
 * Predictions API shared helpers.
 */
import type { Response } from 'express';
import {
  asyncHandler,
  handleApiError,
  isUuid,
  parseLimit,
  parseOptionalInt,
  parsePosition,
  sendError,
} from '../players/utils';
import { PREDICTION_STATUSES } from '../../models/prediction-types';

export { asyncHandler, handleApiError, isUuid, parseLimit, parseOptionalInt, parsePosition, sendError };

export function parsePredictionStatus(raw: unknown): string | undefined {
  if (raw == null || raw === '') return undefined;
  const value = String(raw).toUpperCase();
  if (!(PREDICTION_STATUSES as readonly string[]).includes(value)) {
    throw new Error(`status must be one of: ${PREDICTION_STATUSES.join(', ')}`);
  }
  return value;
}

export function handlePredictionsApiError(res: Response, err: unknown): void {
  handleApiError(res, err);
}

export function serializeFeedPrediction(row: {
  id: string;
  player_id: string;
  slug: string;
  full_name: string;
  class_year: number;
  position: string;
  school: string;
  confidence: number;
  delta?: number;
  source_type: string;
  predictor_id: string;
  status: string;
  created_at: string;
  updated_at: string;
}) {
  return {
    id: row.id,
    playerId: row.player_id,
    playerSlug: row.slug,
    fullName: row.full_name,
    classYear: row.class_year,
    position: row.position,
    school: row.school,
    confidence: row.confidence,
    ...(row.delta != null ? { delta: row.delta } : {}),
    sourceType: row.source_type,
    predictorId: row.predictor_id,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function serializePlayerPrediction(p: {
  id: string;
  school: string;
  confidence: number;
  delta?: number;
  source_type: string;
  predictor_id: string;
  status: string;
  created_at: string;
  updated_at: string;
}) {
  return {
    id: p.id,
    school: p.school,
    confidence: p.confidence,
    ...(p.delta != null ? { delta: p.delta } : {}),
    sourceType: p.source_type,
    predictorId: p.predictor_id,
    status: p.status,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  };
}

export const PREDICTOR_NAMES: Record<string, string> = {
  system: 'FutureCast Model',
};
