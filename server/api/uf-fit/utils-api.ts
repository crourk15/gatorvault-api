/**
 * UF Fit API shared helpers.
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
import type { FitTier } from './engine';

export { asyncHandler, handleApiError, isUuid, parseLimit, parseOptionalInt, parsePosition, sendError };

export type UfFitWatchlistSort = 'ufFitScore' | 'fitDelta' | 'fitVolatility';

export function parseUfFitSort(raw: unknown): UfFitWatchlistSort {
  const value = String(raw || 'ufFitScore').toLowerCase();
  if (value === 'fitdelta' || value === 'fit_delta') return 'fitDelta';
  if (value === 'fitvolatility' || value === 'fit_volatility') return 'fitVolatility';
  return 'ufFitScore';
}

export function parseFitTier(raw: unknown): FitTier | undefined {
  if (raw == null || raw === '') return undefined;
  const value = String(raw).toLowerCase();
  if (['elite', 'strong', 'moderate', 'low'].includes(value)) {
    return value as FitTier;
  }
  throw new Error('tier must be one of: elite, strong, moderate, low');
}

export function parseScoreBound(raw: unknown, field: string): number | undefined {
  if (raw == null || raw === '') return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 100) {
    throw new Error(`${field} must be between 0 and 100`);
  }
  return n;
}

export function handleUfFitApiError(res: Response, err: unknown): void {
  handleApiError(res, err);
}
