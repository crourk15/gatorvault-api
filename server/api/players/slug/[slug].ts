/**
 * GET /api/players/slug/:slug — single player by slug.
 */
import type { Request, Response } from 'express';
import { getPlayerBySlug } from '../../../models/player';
import {
  asyncHandler,
  handleApiError,
  isSlug,
  sendError,
  serializeFullPlayer,
} from '../utils';

export const handleGetPlayerBySlug = asyncHandler(async (req: Request, res: Response) => {
  try {
    const slug = String(req.params.slug || '').toLowerCase();
    if (!slug || !isSlug(slug)) {
      sendError(res, 400, 'Invalid slug');
      return;
    }

    const player = await getPlayerBySlug(slug);
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
