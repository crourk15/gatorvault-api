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
import { fitScoreBreakdownFromRow, insertPredictionHistory, calculateVolatility, listMovementHistoryByPlayerIds, VOLATILITY_WINDOW_DAYS } from '../../models/predictions';

export { asyncHandler, handleApiError, isUuid, parseLimit, parseOptionalInt, parsePosition, sendError };

export function parsePredictionStatus(raw: unknown): string | undefined {
  if (raw == null || raw === '') return undefined;
  const value = String(raw).toUpperCase();
  if (!(PREDICTION_STATUSES as readonly string[]).includes(value)) {
    throw new Error(`status must be one of: ${PREDICTION_STATUSES.join(', ')}`);
  }
  return value;
}

export function parseQueryFlag(raw: unknown): boolean {
  return raw === 'true' || raw === '1';
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
  lifecycle?: string;
  school: string;
  confidence: number;
  delta?: number;
  source_type: string;
  predictor_id: string;
  status: string;
  created_at: string;
  updated_at: string;
  committed_to?: string | null;
  uf_status?: string | null;
  uf_fit_score?: number | null;
  fit_scheme?: number | null;
  fit_culture?: number | null;
  fit_staff?: number | null;
  fit_need?: number | null;
  fit_geo?: number | null;
  volatilityScore?: number;
}) {
  const volatilityScore = row.volatilityScore ?? 0;
  return {
    id: row.id,
    playerId: row.player_id,
    playerSlug: row.slug,
    fullName: row.full_name,
    classYear: row.class_year,
    position: row.position,
    lifecycle: row.lifecycle ?? null,
    school: row.school,
    confidence: row.confidence,
    ...(row.delta != null ? { delta: row.delta } : {}),
    sourceType: row.source_type,
    predictorId: row.predictor_id,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    committedTo: row.committed_to ?? null,
    ufStatus: row.uf_status ?? null,
    ufFitScore: row.uf_fit_score ?? null,
    ufProbability: row.confidence,
    fitScoreBreakdown: fitScoreBreakdownFromRow(row),
    volatilityScore,
    stabilityScore: Math.max(0, Math.min(100, 100 - volatilityScore)),
  };
}

export type SerializedFeedPrediction = ReturnType<typeof serializeFeedPrediction>;

export function serializeStockPrediction(
  row: Parameters<typeof serializeFeedPrediction>[0] & { window_delta: number },
  volatilityScore = 0
): SerializedFeedPrediction {
  return serializeFeedPrediction({
    ...row,
    delta: row.window_delta,
    volatilityScore,
  });
}

export async function serializeFeedRowsWithVolatility(
  rows: Parameters<typeof serializeFeedPrediction>[0][]
): Promise<SerializedFeedPrediction[]> {
  const playerIds = [...new Set(rows.map((row) => row.player_id))];
  const historyMap = await listMovementHistoryByPlayerIds(playerIds, VOLATILITY_WINDOW_DAYS);

  return rows.map((row) =>
    serializeFeedPrediction({
      ...row,
      volatilityScore: calculateVolatility(historyMap.get(row.player_id) ?? []),
    })
  );
}

export async function serializeStockRowsWithVolatility(
  rows: (Parameters<typeof serializeFeedPrediction>[0] & { window_delta: number })[]
): Promise<SerializedFeedPrediction[]> {
  const playerIds = [...new Set(rows.map((row) => row.player_id))];
  const historyMap = await listMovementHistoryByPlayerIds(playerIds, VOLATILITY_WINDOW_DAYS);

  return rows.map((row) =>
    serializeStockPrediction(
      row,
      calculateVolatility(historyMap.get(row.player_id) ?? [])
    )
  );
}

export function applyFeedFilters(
  predictions: SerializedFeedPrediction[],
  filters: {
    hsOnly: boolean;
    portalOnly: boolean;
    floridaOnly: boolean;
    trendingUp: boolean;
  }
): SerializedFeedPrediction[] {
  let out = predictions;

  if (filters.hsOnly) {
    out = out.filter((p) => p.lifecycle === 'HS');
  }
  if (filters.portalOnly) {
    out = out.filter((p) => p.lifecycle === 'PORTAL');
  }
  if (filters.floridaOnly) {
    out = out.filter((p) => p.school.toLowerCase().includes('florida'));
  }
  if (filters.trendingUp) {
    out = out.filter((p) => (p.delta ?? 0) > 0);
  }

  return out;
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

/** Log daily MODEL confidence for movement history graph (one row per player per day). */
export async function recordMovementHistory(
  playerId: string,
  confidence: number
): Promise<void> {
  await insertPredictionHistory(playerId, confidence);
}
