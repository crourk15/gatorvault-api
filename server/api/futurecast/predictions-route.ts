/**
 * GET /api/futurecast/predictions — homepage predictions feed + trend history.
 */
import type { Request, Response } from 'express';
import {
  listPredictions,
  listPredictorStats,
  listMovementHistoryByPlayerIds,
  VOLATILITY_WINDOW_DAYS,
} from '../../models/predictions';
import {
  asyncHandler,
  handlePredictionsApiError,
  parseLimit,
  parseOptionalInt,
  serializeFeedRowsWithVolatility,
  PREDICTOR_NAMES,
} from '../predictions/utils-api';
import {
  dedupeFeedRows,
  filterFutureCastFeedRows,
  filterModelPredictionsOnly,
  FUTURECAST_CLASS_YEAR,
} from './feed-filters';
import { dedupeByPlayerId } from './eligibility';
import { sendCachedJson } from './response-cache';

export const handleGetFutureCastPredictions = asyncHandler(async (req: Request, res: Response) => {
  try {
    const classYear =
      parseOptionalInt(req.query.year, 'year') ??
      parseOptionalInt(req.query.class_year, 'class_year') ??
      FUTURECAST_CLASS_YEAR;
    if (classYear !== FUTURECAST_CLASS_YEAR) {
      res.status(400).json({ error: `Only ${FUTURECAST_CLASS_YEAR} cycle is supported` });
      return;
    }
    const limit = parseLimit(req.query.limit, 8, 24);
    const cacheKey = `futurecast:predictions:${classYear}:${limit}`;

    await sendCachedJson(res, cacheKey, async () => {
    let rows = await listPredictions({
      class_year: classYear,
      status: 'ACTIVE',
      lifecycle: 'HS',
      limit: 200,
    });
    rows = filterFutureCastFeedRows(filterModelPredictionsOnly(rows));
    rows = dedupeFeedRows(rows);

    let predictions = await serializeFeedRowsWithVolatility(rows);
    predictions = dedupeByPlayerId(
      predictions.map((p) => ({ ...p, playerId: p.playerId, confidence: p.confidence }))
    );
    predictions = [...predictions].sort((a, b) => b.confidence - a.confidence).slice(0, limit);

    const playerIds = predictions.map((p) => p.playerId);
    const historyMap = await listMovementHistoryByPlayerIds(playerIds, VOLATILITY_WINDOW_DAYS);

    const withHistory = predictions.map((p) => ({
      ...p,
      trendHistory: (historyMap.get(p.playerId) ?? []).map((h) => ({
        date: h.date,
        confidence: h.confidence,
      })),
    }));

    const statRows = await listPredictorStats();
    const predictors = statRows.slice(0, 5).map((row) => {
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

    return {
      classYear,
      predictions: withHistory,
      predictors,
      windowDays: VOLATILITY_WINDOW_DAYS,
    };
    });
  } catch (err) {
    handlePredictionsApiError(res, err);
  }
});
