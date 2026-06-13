/**
 * GET /api/players/slug/:slug — single player by slug.
 */
import type { Request, Response } from 'express';
import { getPlayerBySlug } from '../../../models/player';
import { getUFSpecificProfileByPlayerId } from '../../../models/uf-specific-profile';
import {
  calculateVolatility,
  listMovementHistoryByPlayerId,
  movementHistoryFromRows,
  recentMovementHistory,
} from '../../../models/predictions';
import { buildFitScoreBreakdown } from '../fit-breakdown';
import {
  getRecruitingPlayerBySlug,
  mapRecruitingProfiles,
  mapRecruitingToPlayerCore,
} from '../recruiting-fallback';
import {
  asyncHandler,
  handleApiError,
  isSlug,
  sendError,
  serializeFullPlayer,
} from '../utils';

async function tryRecruitingFallback(slug: string, res: Response): Promise<boolean> {
  const recruiting = await getRecruitingPlayerBySlug(slug);
  if (!recruiting) return false;

  const player = mapRecruitingToPlayerCore(recruiting);
  const profiles = mapRecruitingProfiles(recruiting);

  res.json({
    player,
    ...profiles,
    source: 'recruiting-store',
  });
  return true;
}

export const handleGetPlayerBySlug = asyncHandler(async (req: Request, res: Response) => {
  try {
    const slug = String(req.params.slug || '').toLowerCase();
    if (!slug || !isSlug(slug)) {
      sendError(res, 400, 'Invalid slug');
      return;
    }

    const player = await getPlayerBySlug(slug);
    if (!player) {
      if (await tryRecruitingFallback(slug, res)) return;
      sendError(res, 404, 'Player not found');
      return;
    }

    const ufProfile = await getUFSpecificProfileByPlayerId(player.id);
    const fitScoreBreakdown = buildFitScoreBreakdown(player, ufProfile);
    const movementRows = await listMovementHistoryByPlayerId(player.id);
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
    const slug = String(req.params.slug || '').toLowerCase();
    if (slug && isSlug(slug)) {
      try {
        if (await tryRecruitingFallback(slug, res)) return;
      } catch {
        /* fall through */
      }
    }
    handleApiError(res, err);
  }
});
