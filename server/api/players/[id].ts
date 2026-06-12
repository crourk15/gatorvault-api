/**
 * GET /api/players/:id — single player by UUID.
 */
import type { Request, Response } from 'express';
import { getPlayerById } from '../../models/player';
import {
  asyncHandler,
  handleApiError,
  isUuid,
  sendError,
  serializeFullPlayer,
} from './utils';

export const handleGetPlayerById = asyncHandler(async (req: Request, res: Response) => {
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

    res.json({
      player: serializeFullPlayer(player),
    });
  } catch (err) {
    handleApiError(res, err);
  }
});
