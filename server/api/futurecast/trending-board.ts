/**
 * GET /api/futurecast/trending — trending up / down (allow-list only).
 *
 * Soft plate on Tier B defer so Netlify SSG / iOS Lab never receive a building
 * body without trendingUp/trendingDown arrays.
 */
import type { Request, Response } from 'express';
import { asyncHandler, handlePredictionsApiError } from '../predictions/utils-api';
import { buildTrendingBoardPayload } from './allowlist-board';
import {
  sendCachedJson,
  softTrendingBoardFromMaster,
  trendingBoardCacheKey,
} from './response-cache';

export const handleGetFutureCastTrendingBoard = asyncHandler(async (_req: Request, res: Response) => {
  try {
    await sendCachedJson(res, trendingBoardCacheKey(), buildTrendingBoardPayload, {
      softOnDeferred: () => softTrendingBoardFromMaster(),
      backgroundBuildOnSoft: true,
    });
  } catch (err) {
    handlePredictionsApiError(res, err);
  }
});
