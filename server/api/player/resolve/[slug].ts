/**
 * GET /api/player/resolve/:slug — resolve slug → player id once (no client guessing).
 */
import type { Request, Response } from 'express';
import { asyncHandler, handleApiError, isSlug, sendError } from '../../players/utils';
import { resolvePlayerSlugRecord, type ResolveKind } from '../build-full-profile';

function parseContext(raw: unknown): 'recruiting' | 'futurecast' | 'roster' | 'auto' {
  const value = String(raw || 'auto').toLowerCase();
  if (value === 'recruiting' || value === 'futurecast' || value === 'roster') return value;
  return 'auto';
}

export const handleResolvePlayerSlug = asyncHandler(async (req: Request, res: Response) => {
  try {
    const slug = String(req.params.slug || '').trim().toLowerCase();
    if (!slug || !isSlug(slug)) {
      sendError(res, 400, 'Invalid slug');
      return;
    }

    const context = parseContext(req.query.context);
    const resolved = await resolvePlayerSlugRecord(slug, context);
    if (!resolved) {
      sendError(res, 404, 'Player not found');
      return;
    }

    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
    res.json({
      ok: true,
      kind: resolved.kind as ResolveKind,
      playerId: resolved.playerId,
      canonicalSlug: resolved.canonicalSlug,
      redirectHref: resolved.redirectHref,
      roster: resolved.roster,
    });
  } catch (err) {
    handleApiError(res, err);
  }
});
