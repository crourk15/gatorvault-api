/**
 * GET /api/futurecast/heatmap — Up / Down / Flat movement bucket counts (allow-list only).
 */
import type { Request, Response } from 'express';
import { asyncHandler, handlePredictionsApiError } from '../predictions/utils-api';
import { buildAllowlistHeatmapPayload } from './allowlist-board';
import { sendCachedJson, softMovementIntelFromMaster } from './response-cache';

export const handleGetMovementHeatmap = asyncHandler(async (_req: Request, res: Response) => {
  try {
    await sendCachedJson(res, 'futurecast:heatmap:allowlist', buildAllowlistHeatmapPayload, {
      softOnDeferred: () => {
        const soft = softMovementIntelFromMaster(2028);
        return {
          buckets: soft.heatmap?.buckets || [],
          windowDays: soft.heatmap?.windowDays || 7,
          movementHeatmap: soft.movementHeatmap,
          updatedAt: soft.updatedAt,
          classYear: 2028,
          degraded: 'hp_soft_seed',
        };
      },
    });
  } catch (err) {
    handlePredictionsApiError(res, err);
  }
});
