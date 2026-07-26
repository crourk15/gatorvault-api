/**
 * GET /api/futurecast/trending — trending up / down (allow-list only).
 */
import type { Request, Response } from 'express';
import { asyncHandler, handlePredictionsApiError } from '../predictions/utils-api';
import { buildTrendingBoardPayload } from './allowlist-board';
import { sendCachedJson, trendingBoardCacheKey } from './response-cache';

export const handleGetFutureCastTrendingBoard = asyncHandler(async (_req: Request, res: Response) => {
  try {
    await sendCachedJson(res, trendingBoardCacheKey(), buildTrendingBoardPayload);
  } catch (err) {
    handlePredictionsApiError(res, err);
  }
});
