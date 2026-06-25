/**
 * GET /api/futurecast/master-board — elite master board payload.
 */
import type { Request, Response } from 'express';
import { asyncHandler, handlePredictionsApiError } from '../predictions/utils-api';
import { buildMasterBoardPayload } from './allowlist-board';
import { sendCachedJson } from './response-cache';
import { masterBoardCacheKey } from './cache-keys';

export const handleGetFutureCastMasterBoard = asyncHandler(async (_req: Request, res: Response) => {
  try {
    await sendCachedJson(res, masterBoardCacheKey(), buildMasterBoardPayload);
  } catch (err) {
    handlePredictionsApiError(res, err);
  }
});
