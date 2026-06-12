/**
 * Portal API shared helpers.
 */
import type { Request, Response } from 'express';
import {
  asyncHandler,
  handleApiError,
  isUuid,
  parseLimit,
  parseOptionalInt,
  parsePosition,
  sendError,
} from '../players/utils';

export { asyncHandler, handleApiError, isUuid, parseLimit, parseOptionalInt, parsePosition, sendError };

export type PortalWatchlistSort = 'likelihood' | 'volatility' | 'depthChartRisk';

export function parseWatchlistSort(raw: unknown): PortalWatchlistSort {
  const value = String(raw || 'likelihood').toLowerCase();
  if (value === 'volatility' || value === 'depthchartrisk' || value === 'depth_chart_risk') {
    return value === 'volatility' ? 'volatility' : 'depthChartRisk';
  }
  return 'likelihood';
}

export function parseLikelihoodMin(raw: unknown): number {
  if (raw == null || raw === '') return 0.25;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 1) {
    throw new Error('likelihood_min must be between 0 and 1');
  }
  return n;
}

export function parseLikelihoodMax(raw: unknown): number {
  if (raw == null || raw === '') return 1;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 1) {
    throw new Error('likelihood_max must be between 0 and 1');
  }
  return n;
}

export function handlePortalApiError(res: Response, err: unknown): void {
  handleApiError(res, err);
}
