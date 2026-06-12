/**
 * GET /api/players/:id/signals — discovery signals for a player.
 */
import type { Request, Response } from 'express';
import { getPlayerById } from '../../../models/player';
import { listDiscoverySignalsByPlayerId } from '../../../models/discovery-signal';
import {
  asyncHandler,
  handleApiError,
  isUuid,
  parseLimit,
  sendError,
  serializeSignal,
} from '../utils';

export const handleGetPlayerSignals = asyncHandler(async (req: Request, res: Response) => {
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

    const limit = parseLimit(req.query.limit, 100, 500);
    const signals = await listDiscoverySignalsByPlayerId(id, limit);

    res.json({
      signals: signals.map((s) => serializeSignal(s as unknown as Record<string, unknown>)),
    });
  } catch (err) {
    handleApiError(res, err);
  }
});
