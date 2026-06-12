/**
 * GET /api/uf-fit/:id — detailed UF Fit intel for a player.
 */
import type { Request, Response } from 'express';
import { getPlayerById } from '../../models/player';
import { getUfFitIntelByPlayerId, ufFitRowToEngineInput } from '../../models/uf-fit-intel';
import { computeUfFitIntel } from './engine';
import {
  asyncHandler,
  handleUfFitApiError,
  isUuid,
  sendError,
} from './utils-api';

export const handleGetUfFitIntel = asyncHandler(async (req: Request, res: Response) => {
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

    const row = await getUfFitIntelByPlayerId(id);
    if (!row) {
      sendError(res, 404, 'UF Fit profile not found');
      return;
    }

    const intel = computeUfFitIntel(ufFitRowToEngineInput(row));

    res.json({
      playerId: id,
      ufFitScore: intel.ufFitScore,
      fitTier: intel.fitTier,
      schemeFit: intel.schemeFit,
      cultureFit: intel.cultureFit,
      positionalNeed: intel.positionalNeed,
      staffInterest: intel.staffInterest,
      fitDelta: intel.fitDelta,
      fitVolatility: intel.fitVolatility,
      history: intel.history,
    });
  } catch (err) {
    handleUfFitApiError(res, err);
  }
});
