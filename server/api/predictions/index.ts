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
  applyFeedFilters,
  asyncHandler,
  handlePredictionsApiError,
  parseLimit,
  parseOptionalInt,
  parsePosition,
  parsePredictionStatus,
  parseQueryFlag,
  serializeFeedPrediction,
} from './utils-api';

export const handleListPredictions = asyncHandler(async (req: Request, res: Response) => {
  try {
    const class_year = parseOptionalInt(req.query.class_year, 'class_year');
    const position = parsePosition(req.query.position);
    const status = parsePredictionStatus(req.query.status) ?? 'ACTIVE';
    const limit = parseLimit(req.query.limit, 100, 500);
    const refresh = req.query.refresh === 'true' || req.query.refresh === '1';

    const hsOnly = parseQueryFlag(req.query.hsOnly);
    const portalOnly = parseQueryFlag(req.query.portalOnly);
    const floridaOnly = parseQueryFlag(req.query.floridaOnly);
    const trendingUp = parseQueryFlag(req.query.trendingUp);

    let rows = await listPredictions({ class_year, position, status, limit: 500 });

    if (refresh || rows.length === 0) {
      const candidates = await listPredictionCandidates({ class_year, position });
      await syncModelPredictionsForCandidates(candidates, upsertActiveModelPrediction);
      rows = await listPredictions({ class_year, position, status, limit: 500 });
    }

    let predictions = rows.map(serializeFeedPrediction);
    predictions = applyFeedFilters(predictions, { hsOnly, portalOnly, floridaOnly, trendingUp });
    predictions = predictions.slice(0, limit);

    res.json({ predictions });
  } catch (err) {
    handlePredictionsApiError(res, err);
  }
});
