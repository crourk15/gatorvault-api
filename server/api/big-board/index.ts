/**
 * GET /api/big-board — ranked Big Board intelligence feed.
 */
import type { Request, Response } from 'express';
import { listBigBoardPlayers } from '../../models/big-board';
import { buildBigBoard } from './engine';
import {
  asyncHandler,
  handleApiError,
  parseLifecycle,
  parseLimit,
  parseOptionalInt,
  parseOrder,
  parsePosition,
  parseSort,
} from './utils-api';

export const handleGetBigBoard = asyncHandler(async (req: Request, res: Response) => {
  try {
    const class_year = parseOptionalInt(req.query.class_year, 'class_year');
    const position = parsePosition(req.query.position);
    const lifecycle = parseLifecycle(req.query.lifecycle) ?? 'HS';
    const sort = parseSort(req.query.sort);
    const order = parseOrder(req.query.order);
    const limit = parseLimit(req.query.limit, 200, 500);

    const raw = await listBigBoardPlayers({ class_year, position, lifecycle });
    const players = buildBigBoard(raw, sort, order, limit);

    res.json({ players });
  } catch (err) {
    handleApiError(res, err);
  }
});
