/**
 * GET /api/player/full-profile/:slug — aggregated profile bundle (single round-trip).
 *
 * Prepared meal: serve durable dossier stamp first (live RPM overlay only).
 * Cold miss builds once, stamps to disk, then returns.
 */
import type { Request, Response } from 'express';
import { createRequire } from 'node:module';
import { asyncHandler, handleApiError, isSlug, sendError } from '../../players/utils';
import { buildFullProfileBySlug } from '../build-full-profile';

const require = createRequire(import.meta.url);
const stampStore = require('../../../lib/player-profile-stamp') as {
  getStampedFullProfile: (slug: string) => Promise<Record<string, unknown> | null>;
  writeStamp: (slug: string, profile: unknown, opts?: { writeBundle?: boolean }) => boolean;
};
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

/** Default ON — never force a kitchen cook when a prepared plate exists. */
function stampFirstEnabled(): boolean {
  return process.env.PROFILE_STAMP_FIRST !== 'false';
}

export const handleGetFullProfile = asyncHandler(async (req: Request, res: Response) => {
  try {
    const slug = String(req.params.slug || '').trim().toLowerCase();
    if (!slug || !isSlug(slug)) {
      sendError(res, 400, 'Invalid slug');
      return;
    }

    if (stampFirstEnabled()) {
      try {
        const stamped = await stampStore.getStampedFullProfile(slug);
        if (stamped) {
          res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=120');
          res.setHeader('X-Profile-Cache', 'STAMP');
          res.json({ ok: true, ...stamped });
          return;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn('[full-profile] stamp serve failed, falling back to build:', message);
      }
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

    // Persist prepared meal for next open (RPM stripped inside writeStamp).
    try {
      stampStore.writeStamp(slug, profile);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn('[full-profile] stamp write failed:', message);
    }

    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=120');
    res.setHeader('X-Profile-Cache', hit ? (stale ? 'STALE' : 'HIT') : 'MISS');
    res.json({ ok: true, ...(profile as Record<string, unknown>) });
  } catch (err) {
    handleApiError(res, err);
  }
});
