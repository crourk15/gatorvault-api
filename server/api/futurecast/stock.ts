/**
 * GET /api/futurecast/stock — Stock Up / Stock Down board.
 */
import type { Request, Response } from 'express';
import { listStockBoardRows } from '../../models/predictions';
import {
  asyncHandler,
  handlePredictionsApiError,
  serializeStockPrediction,
} from '../predictions/utils-api';

const DEFAULT_WINDOW_DAYS = 7;
const MAX_PER_SIDE = 25;

export const handleGetStockBoard = asyncHandler(async (req: Request, res: Response) => {
  try {
    const rawWindow = req.query.windowDays ?? req.query.window_days;
    const windowDays =
      rawWindow != null && rawWindow !== '' ? Number(rawWindow) : DEFAULT_WINDOW_DAYS;
    const resolvedWindow = Number.isFinite(windowDays) ? windowDays : DEFAULT_WINDOW_DAYS;

    const rows = await listStockBoardRows(resolvedWindow);

    const stockUp = rows
      .filter((row) => row.window_delta > 0)
      .sort((a, b) => b.window_delta - a.window_delta)
      .slice(0, MAX_PER_SIDE)
      .map(serializeStockPrediction);

    const stockDown = rows
      .filter((row) => row.window_delta < 0)
      .sort((a, b) => a.window_delta - b.window_delta)
      .slice(0, MAX_PER_SIDE)
      .map(serializeStockPrediction);

    res.json({ stockUp, stockDown, windowDays: resolvedWindow });
  } catch (err) {
    handlePredictionsApiError(res, err);
  }
});
