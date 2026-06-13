/**
 * GET /api/futurecast/heatmap — Up / Down / Flat movement bucket counts.
 */
import type { Request, Response } from 'express';
import { listStockBoardRows } from '../../models/predictions';
import { asyncHandler, handlePredictionsApiError } from '../predictions/utils-api';
import { filterFutureCastStockRows } from './feed-filters';

const WINDOW_DAYS = 7;

export const handleGetMovementHeatmap = asyncHandler(async (_req: Request, res: Response) => {
  try {
    const rows = filterFutureCastStockRows(await listStockBoardRows(WINDOW_DAYS));

    let upCount = 0;
    let downCount = 0;
    let flatCount = 0;

    for (const row of rows) {
      if (row.window_delta > 0) upCount += 1;
      else if (row.window_delta < 0) downCount += 1;
      else flatCount += 1;
    }

    res.json({
      buckets: [
        { label: 'Up', count: upCount },
        { label: 'Down', count: downCount },
        { label: 'Flat', count: flatCount },
      ],
      windowDays: WINDOW_DAYS,
    });
  } catch (err) {
    handlePredictionsApiError(res, err);
  }
});
