/**
 * GET /api/players — list with filters + summary fields.
 */
import type { Request, Response } from 'express';
import { listPlayerSummaries } from '../../models/player';
import {
  asyncHandler,
  handleApiError,
  parseLifecycle,
  parseLimit,
  parseOptionalInt,
  parsePortalStatus,
  parsePosition,
  parseUfStatus,
  serializePlayerSummary,
} from './utils';

export const handleListPlayers = asyncHandler(async (req: Request, res: Response) => {
  try {
    const class_year = parseOptionalInt(req.query.class_year, 'class_year');
    const position = parsePosition(req.query.position);
    const status = parseLifecycle(req.query.lifecycle ?? req.query.status);
    const portal_status = parsePortalStatus(req.query.portal_status);
    const uf_status = parseUfStatus(req.query.uf_status);
    const limit = parseLimit(req.query.limit, 200, 500);

    const players = await listPlayerSummaries({
      class_year,
      position,
      status,
      portal_status,
      uf_status,
      limit,
    });

    res.json({
      players: players.map((p) => serializePlayerSummary(p as unknown as Record<string, unknown>)),
    });
  } catch (err) {
    handleApiError(res, err);
  }
});
