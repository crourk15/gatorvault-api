/**
 * GET /api/futurecast/player/:id — single allow-listed player + staff notes.
 */
import { createRequire } from 'node:module';
import type { Request, Response } from 'express';
import { asyncHandler, handlePredictionsApiError } from '../predictions/utils-api';
import { findAllowlistedPlayer } from './allowlist-board';
import { FUTURECAST_CLASS_YEAR } from './eligibility';

const require = createRequire(import.meta.url);

export const handleGetFutureCastPlayer = asyncHandler(async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) {
      res.status(400).json({ error: 'Player id required' });
      return;
    }

    const player = await findAllowlistedPlayer(id);
    if (!player) {
      res.status(404).json({ error: 'Player not found on 2027 allow-list' });
      return;
    }

    const notes: Array<{
      id: string;
      playerId: string;
      note: string;
      priority: 'high' | 'medium' | 'low';
      createdAt: string;
    }> = [];

    try {
      const warRoom = require('../../lib/war-room-store');
      const breakdowns = (warRoom.getAllBreakdowns() as Array<Record<string, unknown>>) ?? [];
      const hit = breakdowns.find((b) => String(b.playerSlug).toLowerCase() === player.slug);
      if (hit) {
        const note =
          String(hit.staffNotes || hit.insiderNotes || hit.projection || hit.recruitingStory || '').trim();
        if (note) {
          notes.push({
            id: `${player.slug}-note`,
            playerId: player.id,
            note,
            priority: player.priority,
            createdAt: String(hit.updatedAt || new Date().toISOString()),
          });
        }
      }
    } catch {
      /* optional */
    }

    res.json({
      classYear: FUTURECAST_CLASS_YEAR,
      player,
      notes,
    });
  } catch (err) {
    handlePredictionsApiError(res, err);
  }
});
