/**
 * GET /api/futurecast/big-board — HS recruits only (FutureCast namespace).
 */
import type { Request, Response } from 'express';
import { listBigBoardPlayers } from '../../models/big-board';
import { buildBigBoard } from '../big-board/engine';
import {
  asyncHandler,
  handleApiError,
  parseLimit,
  parseOptionalInt,
  parseOrder,
  parsePosition,
  parseSort,
} from '../big-board/utils-api';

export const handleGetFutureCastBigBoard = asyncHandler(async (req: Request, res: Response) => {
  try {
    const class_year = parseOptionalInt(req.query.class_year, 'class_year');
    const position = parsePosition(req.query.position);
    const sort = parseSort(req.query.sort);
    const order = parseOrder(req.query.order);
    const limit = parseLimit(req.query.limit, 200, 500);

    const raw = await listBigBoardPlayers({
      class_year,
      position,
      lifecycle: 'HS',
    });
    const players = buildBigBoard(raw, sort, order, limit);

    res.json({
      lifecycle: 'HIGH_SCHOOL',
      classYear: class_year ?? null,
      players,
    });
  } catch (err) {
    handleApiError(res, err);
  }
});
