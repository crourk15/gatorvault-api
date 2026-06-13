/**
 * GET /api/players/slug/:slug — single player by slug.
 */
import type { Request, Response } from 'express';
import { getPlayerBySlug } from '../../../models/player';
import { getUFSpecificProfileByPlayerId } from '../../../models/uf-specific-profile';
import { buildFitScoreBreakdown } from '../fit-breakdown';
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

    const ufProfile = await getUFSpecificProfileByPlayerId(player.id);
    const fitScoreBreakdown = buildFitScoreBreakdown(player, ufProfile);

    res.json({
      player: {
        ...serializeFullPlayer(player),
        ufFitScore: ufProfile?.uf_fit_score ?? null,
        fitScoreBreakdown,
      },
    });
  } catch (err) {
    handleApiError(res, err);
  }
});
