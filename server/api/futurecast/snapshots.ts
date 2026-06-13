/**
 * GET /api/futurecast/snapshots — daily and weekly movement snapshots.
 */
import type { Request, Response } from 'express';
import { listStockBoardRows, type StockBoardRow } from '../../models/predictions';
import {
  asyncHandler,
  handlePredictionsApiError,
  serializeStockPrediction,
} from '../predictions/utils-api';

const DAILY_WINDOW_DAYS = 1;
const WEEKLY_WINDOW_DAYS = 7;
const MAX_PER_BUCKET = 10;

function splitSnapshotRows(rows: StockBoardRow[], limit: number) {
  const up = rows
    .filter((row) => row.window_delta > 0)
    .sort((a, b) => b.window_delta - a.window_delta)
    .slice(0, limit)
    .map(serializeStockPrediction);

  const down = rows
    .filter((row) => row.window_delta < 0)
    .sort((a, b) => a.window_delta - b.window_delta)
    .slice(0, limit)
    .map(serializeStockPrediction);

  return { up, down };
}

export const handleGetMovementSnapshots = asyncHandler(async (_req: Request, res: Response) => {
  try {
    const [dailyRows, weeklyRows] = await Promise.all([
      listStockBoardRows(DAILY_WINDOW_DAYS),
      listStockBoardRows(WEEKLY_WINDOW_DAYS),
    ]);

    const daily = splitSnapshotRows(dailyRows, MAX_PER_BUCKET);
    const weekly = splitSnapshotRows(weeklyRows, MAX_PER_BUCKET);

    res.json({
      dailyUp: daily.up,
      dailyDown: daily.down,
      weeklyUp: weekly.up,
      weeklyDown: weekly.down,
      dailyWindowDays: DAILY_WINDOW_DAYS,
      weeklyWindowDays: WEEKLY_WINDOW_DAYS,
    });
  } catch (err) {
    handlePredictionsApiError(res, err);
  }
});
