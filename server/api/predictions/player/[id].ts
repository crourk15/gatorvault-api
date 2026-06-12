/**
 * GET /api/predictions/player/:id — per-player predictions.
 */
import type { Request, Response } from 'express';
import { getPlayerById } from '../../models/player';
import {
  listPredictionCandidates,
  listPredictionsByPlayerId,
  upsertActiveModelPrediction,
} from '../../models/predictions';
import { syncModelPredictionsForCandidates } from '../engine';
import {
  asyncHandler,
  handlePredictionsApiError,
  isUuid,
  sendError,
  serializePlayerPrediction,
} from '../utils-api';

export const handleGetPlayerPredictions = asyncHandler(async (req: Request, res: Response) => {
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

    let predictions = await listPredictionsByPlayerId(id);

    if (!predictions.some((p) => p.status === 'ACTIVE' && p.source_type === 'MODEL')) {
      const candidates = await listPredictionCandidates({});
      const match = candidates.filter((c) => c.id === id);
      if (match.length) {
        await syncModelPredictionsForCandidates(match, upsertActiveModelPrediction);
        predictions = await listPredictionsByPlayerId(id);
      }
    }

    res.json({
      playerId: id,
      predictions: predictions.map(serializePlayerPrediction),
    });
  } catch (err) {
    handlePredictionsApiError(res, err);
  }
});
