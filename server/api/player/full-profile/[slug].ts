/**
 * GET /api/player/full-profile/:slug — aggregated profile bundle (single round-trip).
 */
import type { Request, Response } from 'express';
import { createRequire } from 'node:module';
import { asyncHandler, handleApiError, isSlug, sendError } from '../../players/utils';
import { buildFullProfileBySlug } from '../build-full-profile';

const require = createRequire(import.meta.url);
const { createMemoryCache } = require('../../../lib/memory-cache') as {
  createMemoryCache: (ttlMs?: number) => {
    wrap: (
      key: string,
      fn: () => Promise<unknown>,
      ttlMs?: number
    ) => Promise<{ value: unknown; hit: boolean; stale: boolean }>;
  };
};

const PROFILE_CACHE_MS = Math.max(
  30_000,
  parseInt(process.env.FULL_PROFILE_CACHE_MS || '90000', 10) || 90_000
);
const profileCache = createMemoryCache(PROFILE_CACHE_MS);

export const handleGetFullProfile = asyncHandler(async (req: Request, res: Response) => {
  try {
    const slug = String(req.params.slug || '').trim().toLowerCase();
    if (!slug || !isSlug(slug)) {
      sendError(res, 400, 'Invalid slug');
      return;
    }

    const { value: profile, hit, stale } = await profileCache.wrap(
      `full-profile:${slug}`,
      () => buildFullProfileBySlug(slug),
      PROFILE_CACHE_MS
    );
    if (!profile) {
      sendError(res, 404, 'Player not found');
      return;
    }

    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=120');
    res.setHeader('X-Profile-Cache', hit ? (stale ? 'STALE' : 'HIT') : 'MISS');
    res.json({ ok: true, ...(profile as Record<string, unknown>) });
  } catch (err) {
    handleApiError(res, err);
  }
});
