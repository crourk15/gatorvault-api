/**
 * GET /api/futurecast/stock — Stock Up / Stock Down board.
 */
import type { Request, Response } from 'express';
import { listStockBoardRows } from '../../models/predictions';
import {
  asyncHandler,
  handlePredictionsApiError,
  serializeStockRowsWithVolatility,
} from '../predictions/utils-api';
import { filterFutureCastStockRows } from './feed-filters';

const DEFAULT_WINDOW_DAYS = 7;
const MAX_PER_SIDE = 25;

export const handleGetStockBoard = asyncHandler(async (req: Request, res: Response) => {
  try {
    const rawWindow = req.query.windowDays ?? req.query.window_days;
    const windowDays =
      rawWindow != null && rawWindow !== '' ? Number(rawWindow) : DEFAULT_WINDOW_DAYS;
    const resolvedWindow = Number.isFinite(windowDays) ? windowDays : DEFAULT_WINDOW_DAYS;

    const rows = filterFutureCastStockRows(await listStockBoardRows(resolvedWindow));

    const upRows = rows
      .filter((row) => row.window_delta > 0)
      .sort((a, b) => b.window_delta - a.window_delta)
      .slice(0, MAX_PER_SIDE);

    const downRows = rows
      .filter((row) => row.window_delta < 0)
      .sort((a, b) => a.window_delta - b.window_delta)
      .slice(0, MAX_PER_SIDE);

    const [stockUp, stockDown] = await Promise.all([
      serializeStockRowsWithVolatility(upRows),
      serializeStockRowsWithVolatility(downRows),
    ]);

    res.json({ stockUp, stockDown, windowDays: resolvedWindow });
  } catch (err) {
    handlePredictionsApiError(res, err);
  }
});
