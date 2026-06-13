/**
 * GET /api/players/:id — single player by UUID.
 */
import type { Request, Response } from 'express';
import { getPlayerById } from '../../models/player';
import { getUFSpecificProfileByPlayerId } from '../../models/uf-specific-profile';
import {
  calculateVolatility,
  listMovementHistoryByPlayerId,
  movementHistoryFromRows,
  recentMovementHistory,
} from '../../models/predictions';
import { buildFitScoreBreakdown } from './fit-breakdown';
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

    const ufProfile = await getUFSpecificProfileByPlayerId(id);
    const fitScoreBreakdown = buildFitScoreBreakdown(player, ufProfile);
    const movementRows = await listMovementHistoryByPlayerId(id);
    const volatilityScore = calculateVolatility(recentMovementHistory(movementRows));

    res.json({
      player: {
        ...serializeFullPlayer(player),
        ufFitScore: ufProfile?.uf_fit_score ?? null,
        fitScoreBreakdown,
        movementHistory: movementHistoryFromRows(movementRows),
        volatilityScore,
      },
    });
  } catch (err) {
    handleApiError(res, err);
  }
});
