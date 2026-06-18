/**
 * GET /api/player/full-profile/:slug — aggregated profile bundle (single round-trip).
 */
import type { Request, Response } from 'express';
import { asyncHandler, handleApiError, isSlug, sendError } from '../../players/utils';
import { buildFullProfileBySlug } from '../build-full-profile';

export const handleGetFullProfile = asyncHandler(async (req: Request, res: Response) => {
  try {
    const slug = String(req.params.slug || '').trim().toLowerCase();
    if (!slug || !isSlug(slug)) {
      sendError(res, 400, 'Invalid slug');
      return;
    }

    const profile = await buildFullProfileBySlug(slug);
    if (!profile) {
      sendError(res, 404, 'Player not found');
      return;
    }

    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=120');
    res.json({ ok: true, ...profile });
  } catch (err) {
    handleApiError(res, err);
  }
});
