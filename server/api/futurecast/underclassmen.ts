/**
 * GET /api/futurecast/underclassmen
 * GET /api/futurecast/early-watchlist
 *
 * Dedicated underclassmen intel — 2028 locked targets (allowlist), plus 2029–2030 younger watchboard.
 */
import type { Request, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import {
  calculateVolatility,
  listMovementHistoryByPlayerIds,
  listPredictions,
  listStockBoardRows,
} from '../../models/predictions';
import { asyncHandler, handlePredictionsApiError, serializeFeedRowsWithVolatility } from '../predictions/utils-api';
import {
  primeFuturecastCache,
  sendCachedJson,
  underclassmenCacheKey,
} from './response-cache';
import {
  buildUnderclassmenIntelForSlug,
  loadUnderclassmenBoardPlayers,
  type UnderclassmenIntelBundle,
} from '../../lib/underclassmen-intel';
import {
  dedupeFeedRows,
  filterModelPredictionsOnly,
  filterMovementIntelStockRows,
} from './feed-filters';
import { UNDERCLASSMEN_MOVEMENT_WINDOW_DAYS } from './allowlist-board';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { getAllowlistSet } = require('../../lib/recruiting-target-allowlist');
const { isActiveUfTarget } = require('../../lib/recruiting-target-filters');
const { buildUnderclassmenSoftPlate } = require('../../lib/underclassmen-soft-plate') as {
  buildUnderclassmenSoftPlate: (years?: number[]) => Record<string, unknown>;
};

const EARLY_WATCHLIST_PATH = path.join(__dirname, '../../data/futurecast/early-watchlist.json');
const DEFAULT_YEARS = [2028, 2029, 2030] as const;

export type UnderclassmenTier = 'target' | 'watchlist';

export type UnderclassmenPlayer = import('./allowlist-board').FutureCastBoardPlayer & {
  tier: UnderclassmenTier;
  discoveryScore?: number | null;
  /** Rolling UF Δ% from FutureCast movement engine (30d window). */
  earlyMovement?: number | null;
  /** Locked 2028 UF target on Early Discovery allowlist. */
  allowlistTarget?: boolean;
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
  name?: string;
  classYear?: number;
  tier?: string;
  pos?: string;
  position?: string;
  school?: string;
  state?: string;
  stars?: number;
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

type MovementEnrichment = {
  trendDelta7d: number | null;
  volatility7d: number;
};

async function loadMovementEnrichmentBySlug(
  classYear: number,
  slugs: string[],
  windowDays = UNDERCLASSMEN_MOVEMENT_WINDOW_DAYS
): Promise<Map<string, MovementEnrichment>> {
  const slugSet = new Set(slugs.map((s) => String(s).toLowerCase()).filter(Boolean));
  if (!slugSet.size) return new Map();

  const { buildAllowlistSlugAliasLookup } = require('../../lib/allowlist-slug-aliases') as {
    buildAllowlistSlugAliasLookup: (slugs: string[], year: number) => Map<string, string>;
  };
  const aliasLookup = buildAllowlistSlugAliasLookup([...slugSet], classYear);
  const resolveCanonical = (rowSlug: string) =>
    aliasLookup.get(String(rowSlug || '').toLowerCase());

  const [stockRowsRaw, predictionRows] = await Promise.all([
    listStockBoardRows(windowDays, { lifecycle: 'HS', class_year: classYear }).catch((err) => {
      console.warn(
        '[underclassmen] stock board unavailable:',
        err instanceof Error ? err.message : err
      );
      return [];
    }),
    listPredictions({
      class_year: classYear,
      status: 'ACTIVE',
      lifecycle: 'HS',
      limit: 500,
    }).catch((err) => {
      console.warn(
        '[underclassmen] predictions unavailable:',
        err instanceof Error ? err.message : err
      );
      return [];
    }),
  ]);

  const stockRows = filterMovementIntelStockRows(stockRowsRaw).filter((row) =>
    Boolean(resolveCanonical(String(row.slug || '').toLowerCase()))
  );
  const stockBySlug = new Map<string, (typeof stockRows)[0]>();
  for (const row of stockRows) {
    const canonical = resolveCanonical(String(row.slug || '').toLowerCase());
    if (canonical && !stockBySlug.has(canonical)) stockBySlug.set(canonical, row);
  }

  const modelRows = dedupeFeedRows(filterModelPredictionsOnly(predictionRows)).filter((row) =>
    Boolean(resolveCanonical(String(row.slug || row.playerSlug || '').toLowerCase()))
  );
  const serialized = await serializeFeedRowsWithVolatility(modelRows);
  const predictionBySlug = new Map<string, (typeof serialized)[0]>();
  for (const row of serialized) {
    const canonical = resolveCanonical(String(row.playerSlug || '').toLowerCase());
    if (canonical && !predictionBySlug.has(canonical)) predictionBySlug.set(canonical, row);
  }

  const playerIds = serialized.map((p) => p.playerId).filter(Boolean);
  const historyMap = await listMovementHistoryByPlayerIds(playerIds, windowDays);

  const out = new Map<string, MovementEnrichment>();
  for (const slug of slugSet) {
    const stock = stockBySlug.get(slug);
    const model = predictionBySlug.get(slug);
    const trendRaw =
      stock?.window_delta != null
        ? Number(stock.window_delta)
        : model?.delta != null
          ? Number(model.delta)
          : null;
    const trendDelta7d =
      trendRaw != null && Number.isFinite(trendRaw)
        ? Math.round(trendRaw * 1000) / 1000
        : null;
    const history = model?.playerId ? historyMap.get(model.playerId) ?? [] : [];
    const volatility7d =
      history.length > 0
        ? Math.round(calculateVolatility(history) * 100) / 100
        : trendDelta7d != null
          ? Math.round(Math.abs(trendDelta7d) * 100) / 100
          : 0;

    out.set(slug, { trendDelta7d, volatility7d });
  }

  return out;
}

function applyMovementEnrichment<
  T extends { slug: string; trendDelta7d?: number | null; volatility7d?: number },
>(player: T, movement?: MovementEnrichment): T {
  if (!movement) return player;
  const trendDelta7d =
    player.trendDelta7d != null ? player.trendDelta7d : movement.trendDelta7d;
  const volatility7d =
    player.volatility7d != null && player.volatility7d > 0
      ? player.volatility7d
      : movement.volatility7d;
  return { ...player, trendDelta7d, volatility7d };
}

async function slugsForYear(classYear: number): Promise<string[]> {
  if (classYear === 2028) {
    const { dedupeAllowlistSlugs } = require('../../lib/allowlist-slug-aliases') as {
      dedupeAllowlistSlugs: (slugs: string[], year: number) => string[];
    };
    return dedupeAllowlistSlugs(
      [...getAllowlistSet(2028)].map((s: string) => String(s).toLowerCase()),
      2028
    );
  }

  const watchSlugs = loadEarlyWatchEntries()
    .filter((e) => Number(e.classYear) === classYear)
    .map((e) => String(e.slug || '').toLowerCase())
    .filter(Boolean);

  // 2029–2030 Younger Prospects: recruiting-store targets + early-watchlist entries.
  // Do not use getBoard() — that allowlist-filters and returns [] when no year allowlist exists.
  if (classYear === 2029 || classYear === 2030) {
    const {
      getAllPlayers,
      isHubCommittedStatus,
      isHubFloridaCommitStatus,
    } = require('../../lib/recruiting-store') as {
      getAllPlayers: () => Promise<Array<Record<string, unknown>>>;
      isHubCommittedStatus: (p: Record<string, unknown>) => boolean;
      isHubFloridaCommitStatus: (p: Record<string, unknown>) => boolean;
    };
    const players = await getAllPlayers();
    const storeSlugs = players
      .filter((p) => {
        if (Number(p.classYear) !== classYear) return false;
        if (isHubCommittedStatus(p) || isHubFloridaCommitStatus(p)) return false;
        const cat = String(p.category || '').toLowerCase();
        return cat === 'target' || cat === 'recruit' || cat === '';
      })
      .map((p) => String(p.slug || '').toLowerCase())
      .filter(Boolean);
    return [...new Set([...storeSlugs, ...watchSlugs])];
  }

  return [...new Set(watchSlugs)];
}

export async function buildUnderclassmenPayload(years: number[] = [...DEFAULT_YEARS]): Promise<UnderclassmenResponse> {
  const {
    loadDiscoveryEnrichmentBySlug,
    applyDiscoveryEnrichment,
    buildAllowlistWatchboardFallback,
    sortUnderclassmenForWatchboard,
  } = require('../../lib/underclassmen-discovery-enrich');

  const earlyMeta = new Map(
    loadEarlyWatchEntries()
      .filter((e) => e.slug)
      .map((e) => [String(e.slug).toLowerCase(), e])
  );

  const discoveryBySlug =
    years.includes(2028) ? await loadDiscoveryEnrichmentBySlug(2028) : new Map();

  const classes: Record<string, UnderclassmenClassBucket> = {};
  const flat: UnderclassmenPlayer[] = [];

  // Build years in parallel — sequential 2028→2029→2030 was the Discovery multi-minute stall.
  const yearBuckets = await Promise.all(
    years.map(async (year) => {
      const slugs = await slugsForYear(year);
      if (!slugs.length) {
        return { year, targets: [] as UnderclassmenPlayer[], watchlist: [] as UnderclassmenPlayer[] };
      }

      let enriched = await loadUnderclassmenBoardPlayers(year, slugs);
      // Board rows already carry 30d movement from loadBoardPlayersForSlugs.
      // Only backfill slugs still missing a delta (avoid a second full stock/history pass).
      const missingMovementSlugs = enriched
        .filter((p) => p.trendDelta7d == null || !Number.isFinite(Number(p.trendDelta7d)))
        .map((p) => p.slug);
      const movementBySlug =
        missingMovementSlugs.length > 0
          ? await loadMovementEnrichmentBySlug(
              year,
              missingMovementSlugs,
              UNDERCLASSMEN_MOVEMENT_WINDOW_DAYS
            )
          : new Map();
      const enrichedSlugs = new Set(enriched.map((p) => p.slug.toLowerCase()));

      if (year === 2028) {
        for (const slug of slugs) {
          const key = String(slug).toLowerCase();
          if (enrichedSlugs.has(key)) continue;
          const fallback = buildAllowlistWatchboardFallback(key, discoveryBySlug.get(key));
          if (fallback) {
            enriched.push(fallback);
            enrichedSlugs.add(key);
          }
        }
      }

      const targets: UnderclassmenPlayer[] = [];
      const watchlist: UnderclassmenPlayer[] = [];

      for (const player of enriched) {
        // Commits (UF or elsewhere) are not discovery targets — keep Lab movement honest.
        if (!isActiveUfTarget(player)) continue;

        const entry = earlyMeta.get(player.slug);
        const tier: UnderclassmenTier =
          year === 2030 || entry?.tier === 'watchlist' ? 'watchlist' : 'target';
        const discoveryMeta =
          year === 2028 ? discoveryBySlug.get(player.slug.toLowerCase()) : undefined;
        const merged = applyDiscoveryEnrichment(player, discoveryMeta);
        const withMovement = applyMovementEnrichment(
          merged,
          movementBySlug.get(player.slug.toLowerCase())
        );
        // Never fall back to seeded earlyMovement (±4 theater). Real deltas only.
        let trendDelta7d =
          withMovement.trendDelta7d != null && Number.isFinite(Number(withMovement.trendDelta7d))
            ? Number(withMovement.trendDelta7d)
            : null;
        if (trendDelta7d != null && Math.abs(Math.round(trendDelta7d)) === 4) {
          // Classic allowlist-seed flat bump — drop unless durable UF trend confirms a real move.
          try {
            const ufTrend = require('../../lib/uf-trend-snapshot') as {
              computeDelta7d?: (slug: string, asOf?: Date, opts?: object) => number | null;
            };
            const snap =
              typeof ufTrend.computeDelta7d === 'function'
                ? ufTrend.computeDelta7d(player.slug, new Date(), {
                    preferSource: 'gatorvault',
                    requireSource: false,
                  })
                : null;
            if (snap == null || !Number.isFinite(snap) || Math.abs(snap) < 1) {
              trendDelta7d = null;
            } else if (Math.abs(Math.round(snap)) === 4) {
              // Snapshot itself is the seed-flat artifact.
              trendDelta7d = null;
            } else {
              trendDelta7d = Math.round(snap);
            }
          } catch {
            trendDelta7d = null;
          }
        }
        const volatility7d =
          trendDelta7d == null
            ? 0
            : withMovement.volatility7d != null && withMovement.volatility7d > 0
              ? withMovement.volatility7d
              : Math.round(Math.abs(trendDelta7d) * 100) / 100;
        const row: UnderclassmenPlayer = {
          ...withMovement,
          trendDelta7d,
          volatility7d,
          tier,
          discoveryScore:
            discoveryMeta?.discoveryScore ??
            entry?.discoveryScore ??
            merged.discoveryScore ??
            null,
          earlyMovement: trendDelta7d,
          allowlistTarget:
            year === 2028 ? Boolean(discoveryMeta?.allowlistTarget) : merged.allowlistTarget,
        };
        if (tier === 'watchlist') watchlist.push(row);
        else targets.push(row);
      }

      return { year, targets, watchlist };
    })
  );

  for (const bucket of yearBuckets) {
    classes[String(bucket.year)] = bucketForYear(bucket.year, bucket.targets, bucket.watchlist);
    flat.push(...bucket.targets, ...bucket.watchlist);
  }

  const updatedAt = new Date().toISOString();
  const empty = flat.length === 0;

  return {
    ok: true,
    updatedAt,
    years,
    classes,
    players: sortUnderclassmenForWatchboard(flat),
    empty,
    message: empty ? 'No underclassmen intel loaded for requested years.' : undefined,
  };
}

export const handleGetFutureCastUnderclassmen = asyncHandler(async (req: Request, res: Response) => {
  try {
    const years = parseYears(typeof req.query.years === 'string' ? req.query.years : undefined);
    const cacheKey = underclassmenCacheKey(years);
    await sendCachedJson(res, cacheKey, () => buildUnderclassmenPayload(years), {
      // Never leave Lab More boards / Names-to-know on empty deferred_rebuild.
      softOnDeferred: () => {
        const payload = {
          ...buildUnderclassmenSoftPlate(years),
          degraded: 'soft_plate' as const,
        };
        primeFuturecastCache(cacheKey, payload);
        return payload;
      },
      // Soft plate is sync JSON; spaced/keepalive warm can refill full board later.
      backgroundBuildOnSoft: false,
    });
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
    await sendCachedJson(res, cacheKey, () => buildUnderclassmenPayload([...years]), {
      softOnDeferred: () => {
        const payload = {
          ...buildUnderclassmenSoftPlate([...years]),
          degraded: 'soft_plate' as const,
        };
        primeFuturecastCache(cacheKey, payload);
        return payload;
      },
      backgroundBuildOnSoft: false,
    });
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
