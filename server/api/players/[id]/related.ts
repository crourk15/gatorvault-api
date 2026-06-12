/**
 * GET /api/players/:id/related — same position + class year, ranked by Big Board score.
 */
import type { Request, Response } from 'express';
import { buildBigBoard } from '../../big-board/engine';
import { listBigBoardPlayers } from '../../../models/big-board';
import { getPlayerById } from '../../../models/player';
import {
  asyncHandler,
  handleApiError,
  isUuid,
  parseLimit,
  sendError,
} from '../utils';

export const handleGetRelatedPlayers = asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!isUuid(id)) {
      sendError(res, 400, 'Invalid UUID');
      return;
    }

    const player = await getPlayerById(id);
    if (!player) {
      sendError(res, 404, 'Player not found');
      return;
    }

    const limit = parseLimit(req.query.limit, 6, 20);
    const rows = await listBigBoardPlayers({
      class_year: player.class_year,
      position: player.position,
    });

    const ranked = buildBigBoard(rows, 'rank', 'desc', rows.length);
    const players = ranked.filter((p) => p.id !== id).slice(0, limit);

    res.json({ players });
  } catch (err) {
    handleApiError(res, err);
  }
});
