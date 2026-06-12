/**
 * GET /api/predictors/leaderboard — predictor hit rates.
 */
import type { Request, Response } from 'express';
import { listPredictorStats } from '../../models/predictions';
import { asyncHandler, handlePredictionsApiError, PREDICTOR_NAMES } from '../predictions/utils-api';

export const handleGetPredictorLeaderboard = asyncHandler(async (_req, res) => {
  try {
    const rows = await listPredictorStats();
    const predictors = rows.map((row) => {
      const resolved = row.hits + row.misses;
      const hitRate = resolved > 0 ? Math.round((row.hits / resolved) * 1000) / 1000 : 0;
      return {
        predictorId: row.predictor_id,
        name: PREDICTOR_NAMES[row.predictor_id] ?? row.predictor_id,
        picks: row.picks,
        hits: row.hits,
        misses: row.misses,
        hitRate,
      };
    });

    res.json({ predictors });
  } catch (err) {
    handlePredictionsApiError(res, err);
  }
});
