/**
 * GET /api/futurecast/movement-intel — risers, fallers, volatility, fit scores.
 */
import type { Request, Response } from 'express';
import { asyncHandler, handlePredictionsApiError } from '../predictions/utils-api';
import { buildMovementIntelPayload } from './allowlist-board';
import { sendCachedJson } from './response-cache';

export const handleGetFutureCastMovementIntel = asyncHandler(async (_req: Request, res: Response) => {
  try {
    await sendCachedJson(res, 'futurecast:movement-intel', buildMovementIntelPayload);
  } catch (err) {
    handlePredictionsApiError(res, err);
  }
});
