/**
 * GET /api/players/slug/:slug — single player by slug.
 */
import type { Request, Response } from 'express';
import { createRequire } from 'node:module';
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

const require = createRequire(import.meta.url);
const { verifiedClassYearForSlug, overlayVerifiedFloridaProfile } = require('../../../lib/recruiting-verified-commits') as {
  verifiedClassYearForSlug: (slug: string) => number | null;
  overlayVerifiedFloridaProfile: (
    player: Record<string, unknown>,
    recruiting: Record<string, unknown> | null
  ) => Record<string, unknown>;
};

async function withVerifiedFloridaCommit(slug: string, player: Record<string, unknown>) {
  if (verifiedClassYearForSlug(slug) == null) return player;
  try {
    const recruiting = await getRecruitingPlayerBySlug(slug);
    return overlayVerifiedFloridaProfile(player, recruiting);
  } catch {
    return player;
  }
}

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

    const core = await withVerifiedFloridaCommit(slug, serializeFullPlayer(player) as Record<string, unknown>);
    res.json({
      player: {
        ...core,
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
