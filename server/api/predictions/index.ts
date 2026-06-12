/**
 * GET /api/predictions — FutureCast Picks feed.
 */
import type { Request, Response } from 'express';
import {
  listPredictionCandidates,
  listPredictions,
  upsertActiveModelPrediction,
} from '../../models/predictions';
import { syncModelPredictionsForCandidates } from './engine';
import {
  asyncHandler,
  handlePredictionsApiError,
  parseLimit,
  parseOptionalInt,
  parsePosition,
  parsePredictionStatus,
  serializeFeedPrediction,
} from './utils-api';

export const handleListPredictions = asyncHandler(async (req: Request, res: Response) => {
  try {
    const class_year = parseOptionalInt(req.query.class_year, 'class_year');
    const position = parsePosition(req.query.position);
    const status = parsePredictionStatus(req.query.status) ?? 'ACTIVE';
    const limit = parseLimit(req.query.limit, 100, 500);
    const refresh = req.query.refresh === 'true' || req.query.refresh === '1';

    let rows = await listPredictions({ class_year, position, status, limit });

    if (refresh || rows.length === 0) {
      const candidates = await listPredictionCandidates({ class_year, position });
      await syncModelPredictionsForCandidates(candidates, upsertActiveModelPrediction);
      rows = await listPredictions({ class_year, position, status, limit });
    }

    res.json({
      predictions: rows.map(serializeFeedPrediction),
    });
  } catch (err) {
    handlePredictionsApiError(res, err);
  }
});
