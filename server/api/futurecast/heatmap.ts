/**
 * GET /api/futurecast/heatmap — Up / Down / Flat movement bucket counts (allow-list only).
 */
import type { Request, Response } from 'express';
import { asyncHandler, handlePredictionsApiError } from '../predictions/utils-api';
import { buildAllowlistHeatmapPayload } from './allowlist-board';
import { sendCachedJson } from './response-cache';

export const handleGetMovementHeatmap = asyncHandler(async (_req: Request, res: Response) => {
  try {
    await sendCachedJson(res, 'futurecast:heatmap:allowlist', buildAllowlistHeatmapPayload);
  } catch (err) {
    handlePredictionsApiError(res, err);
  }
});
