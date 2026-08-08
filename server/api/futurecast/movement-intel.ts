/**
 * GET /api/futurecast/movement-intel?year=2028 — risers, fallers, volatility, fit scores.
 * Defaults to the closing class (2027). Pass year=2028 for discovery-season movement.
 */
import type { Request, Response } from 'express';
import { asyncHandler, handlePredictionsApiError } from '../predictions/utils-api';
import { FUTURECAST_CLASS_YEAR } from './feed-filters';
import { buildMovementIntelPayload } from './allowlist-board';
import {
  movementIntelCacheKey,
  sendCachedJson,
  softMovementIntelFromMaster,
} from './response-cache';

function parseMovementYear(raw: unknown): number {
  const n = parseInt(String(raw ?? ''), 10);
  if (Number.isFinite(n) && n >= 2027 && n <= 2030) return n;
  return FUTURECAST_CLASS_YEAR;
}

export const handleGetFutureCastMovementIntel = asyncHandler(async (req: Request, res: Response) => {
  try {
    const classYear = parseMovementYear(req.query.year ?? req.query.class_year);
    const cacheKey = movementIntelCacheKey(classYear);
    await sendCachedJson(res, cacheKey, () => buildMovementIntelPayload(classYear), {
      softOnDeferred: () => softMovementIntelFromMaster(classYear),
      backgroundBuildOnSoft: true,
    });
  } catch (err) {
    handlePredictionsApiError(res, err);
  }
});
