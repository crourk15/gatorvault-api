/**
 * GET /api/portal/predictions/:id — transfer destination predictions.
 */
import type { Request, Response } from 'express';
import { getPlayerById } from '../../models/player';
import {
  getPortalIntelByPlayerId,
  listPeerPortalDestinations,
  portalRowToEngineInput,
} from '../../models/portal-intel';
import {
  computePortalIntelScores,
  computePortalLikelihoodTrend,
  computeTransferPredictions,
} from './engine';
import {
  asyncHandler,
  handlePortalApiError,
  isUuid,
  sendError,
} from './utils-api';

export const handleGetPortalPredictions = asyncHandler(async (req: Request, res: Response) => {
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

    const row = await getPortalIntelByPlayerId(id);
    if (!row) {
      sendError(res, 404, 'Portal intel not found');
      return;
    }

    const input = portalRowToEngineInput(row);
    const peerDestinations = await listPeerPortalDestinations(row.previous_school);
    const predictions = computeTransferPredictions(input, peerDestinations);
    const scores = computePortalIntelScores(input);
    const trend = computePortalLikelihoodTrend(input, 30);

    res.json({
      playerId: id,
      predictions,
      intel: {
        portalLikelihood: scores.portalLikelihood,
        depthChartRisk: scores.depthChartRisk,
        snapShareScore: scores.snapShareScore,
        snapShare: scores.snapShare,
        volatility: scores.volatility,
        likelihoodTrend: trend,
      },
    });
  } catch (err) {
    handlePortalApiError(res, err);
  }
});
