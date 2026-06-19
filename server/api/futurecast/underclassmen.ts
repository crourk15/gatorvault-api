/**
 * GET /api/futurecast/underclassmen
 * GET /api/futurecast/early-watchlist
 *
 * Dedicated underclassmen intel — 2028 early targets, 2029 targets, 2030 watchlist.
 */
import type { Request, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { asyncHandler, handlePredictionsApiError } from '../predictions/utils-api';
import { sendCachedJson } from './response-cache';
import {
  buildUnderclassmenIntelForSlug,
  loadUnderclassmenBoardPlayers,
  type UnderclassmenIntelBundle,
} from '../../lib/underclassmen-intel';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { ALLOWLIST_2028 } = require('../../lib/recruiting-target-allowlist');

const EARLY_WATCHLIST_PATH = path.join(__dirname, '../../data/futurecast/early-watchlist.json');
const DEFAULT_YEARS = [2028, 2029, 2030] as const;

export type UnderclassmenTier = 'target' | 'watchlist';

export type UnderclassmenPlayer = import('./allowlist-board').FutureCastBoardPlayer & {
  tier: UnderclassmenTier;
  discoveryScore?: number | null;
  /** Rolling UF Δ% from FutureCast movement engine (30d window). */
  earlyMovement?: number | null;
};

export type UnderclassmenClassBucket = {
  classYear: number;
  targets: UnderclassmenPlayer[];
  watchlist: UnderclassmenPlayer[];
  earlyMovement: UnderclassmenPlayer[];
  count: number;
};

export type UnderclassmenResponse = {
  ok: boolean;
  updatedAt: string;
  years: number[];
  classes: Record<string, UnderclassmenClassBucket>;
  /** Flat list for UI watchboard modules */
  players: UnderclassmenPlayer[];
  empty?: boolean;
  message?: string;
};

type EarlyWatchEntry = {
  slug?: string;
  classYear?: number;
  tier?: string;
  discoveryScore?: number;
  earlyMovement?: number;
};

function loadEarlyWatchEntries(): EarlyWatchEntry[] {
  try {
    const doc = JSON.parse(fs.readFileSync(EARLY_WATCHLIST_PATH, 'utf8')) as {
      entries?: EarlyWatchEntry[];
    };
    return doc.entries ?? [];
  } catch {
    return [];
  }
}

function parseYears(raw: string | undefined): number[] {
  if (!raw) return [...DEFAULT_YEARS];
  const parsed = raw
    .split(',')
    .map((v) => parseInt(v.trim(), 10))
    .filter((y) => y >= 2028 && y <= 2030);
  return parsed.length ? parsed : [...DEFAULT_YEARS];
}

function bucketForYear(
  classYear: number,
  targets: UnderclassmenPlayer[],
  watchlist: UnderclassmenPlayer[]
): UnderclassmenClassBucket {
  const all = [...targets, ...watchlist];
  const earlyMovement = all
    .filter((p) => p.earlyMovement != null && Math.abs(p.earlyMovement) >= 0.02)
    .sort((a, b) => Math.abs(b.earlyMovement ?? 0) - Math.abs(a.earlyMovement ?? 0));
  return {
    classYear,
    targets,
    watchlist,
    earlyMovement,
    count: all.length,
  };
}

async function slugsForYear(classYear: number): Promise<string[]> {
  const { getLiveBoardTargets } = require('../../lib/live-board-targets');
  if (classYear === 2028) {
    const live = await getLiveBoardTargets(2028);
    const liveSlugs = live.map((t: { slug?: string }) => String(t.slug || '').toLowerCase()).filter(Boolean);
    if (liveSlugs.length) return liveSlugs;
    return ALLOWLIST_2028.map((s: string) => String(s).toLowerCase());
  }

  const entries = loadEarlyWatchEntries().filter((e) => Number(e.classYear) === classYear);
  return entries.map((e) => String(e.slug || '').toLowerCase()).filter(Boolean);
}

export async function buildUnderclassmenPayload(years: number[] = [...DEFAULT_YEARS]): Promise<UnderclassmenResponse> {
  const earlyMeta = new Map(
    loadEarlyWatchEntries()
      .filter((e) => e.slug)
      .map((e) => [String(e.slug).toLowerCase(), e])
  );

  const classes: Record<string, UnderclassmenClassBucket> = {};
  const flat: UnderclassmenPlayer[] = [];

  for (const year of years) {
    const slugs = await slugsForYear(year);
    if (!slugs.length) {
      classes[String(year)] = bucketForYear(year, [], []);
      continue;
    }

    const enriched = await loadUnderclassmenBoardPlayers(year, slugs);
    const targets: UnderclassmenPlayer[] = [];
    const watchlist: UnderclassmenPlayer[] = [];

    for (const player of enriched) {
      const entry = earlyMeta.get(player.slug);
      const tier: UnderclassmenTier =
        year === 2030 || entry?.tier === 'watchlist' ? 'watchlist' : 'target';
      const row: UnderclassmenPlayer = {
        ...player,
        tier,
        discoveryScore: entry?.discoveryScore ?? null,
        earlyMovement: player.trendDelta7d,
      };
      if (tier === 'watchlist') watchlist.push(row);
      else targets.push(row);
      flat.push(row);
    }

    classes[String(year)] = bucketForYear(year, targets, watchlist);
  }

  const updatedAt = new Date().toISOString();
  const empty = flat.length === 0;

  return {
    ok: true,
    updatedAt,
    years,
    classes,
    players: flat.sort((a, b) => (b.ufConfidence ?? -1) - (a.ufConfidence ?? -1)),
    empty,
    message: empty ? 'No underclassmen intel loaded for requested years.' : undefined,
  };
}

export const handleGetFutureCastUnderclassmen = asyncHandler(async (req: Request, res: Response) => {
  try {
    const years = parseYears(typeof req.query.years === 'string' ? req.query.years : undefined);
    const cacheKey = `futurecast:underclassmen:${years.join(',')}`;
    await sendCachedJson(res, cacheKey, () => buildUnderclassmenPayload(years));
  } catch (err) {
    handlePredictionsApiError(res, err);
  }
});

/** Alias endpoint — early_watchlist naming from spec */
export const handleGetFutureCastEarlyWatchlist = asyncHandler(async (req: Request, res: Response) => {
  try {
    const minYear = parseInt(String(req.query.class_year_gte || '2028'), 10);
    const years = DEFAULT_YEARS.filter((y) => y >= (Number.isFinite(minYear) ? minYear : 2028));
    const cacheKey = `futurecast:early-watchlist:${years.join(',')}`;
    await sendCachedJson(res, cacheKey, () => buildUnderclassmenPayload([...years]));
  } catch (err) {
    handlePredictionsApiError(res, err);
  }
});

/** GET /api/futurecast/underclassmen/intel/:slug — per-player early intel bundle */
export const handleGetUnderclassmenIntelBySlug = asyncHandler(async (req: Request, res: Response) => {
  try {
    const slug = String(req.params.slug || '').trim().toLowerCase();
    if (!slug) {
      res.status(400).json({ ok: false, error: 'slug required' });
      return;
    }
    const cacheKey = `futurecast:underclassmen:intel:${slug}`;
    await sendCachedJson(res, cacheKey, async () => {
      const bundle = await buildUnderclassmenIntelForSlug(slug);
      if (!bundle) {
        return { ok: false, error: 'Underclassmen intel not found', slug };
      }
      return { ok: true, ...bundle } satisfies { ok: true } & UnderclassmenIntelBundle;
    });
  } catch (err) {
    handlePredictionsApiError(res, err);
  }
});
