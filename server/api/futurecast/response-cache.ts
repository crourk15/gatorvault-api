/**
 * In-memory cache for FutureCast homepage API payloads.
 * Fresh TTL + stale-while-revalidate so Lab does not block fans on rebuild.
 */
import type { Response } from 'express';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createMemoryCache } = require('../../lib/memory-cache');

/** Fresh window — keep Lab hot between keepalive pings. */
const CACHE_TTL_MS = parseInt(process.env.FUTURECAST_CACHE_TTL_MS || String(5 * 60_000), 10) || 5 * 60_000;
const cache = createMemoryCache(CACHE_TTL_MS);

/** Bump when high-priority or master-board payload shape changes. */
export const FUTURECAST_API_CACHE_VERSION = 23;

export function underclassmenCacheKey(years: Array<number | string>): string {
  return `futurecast:underclassmen:v${FUTURECAST_API_CACHE_VERSION}:${years.join(',')}`;
}

/** Lab "2028 Early Discovery" panel + Big Board Early Discovery tab. */
export function earlyDiscoveryCacheKey(opts: {
  classYearGte?: number;
  minDiscoveryScore?: number;
  minUfFitScore?: number;
  position?: string | null;
  limit?: number;
}): string {
  const classYearGte = opts.classYearGte ?? 2028;
  const minDiscoveryScore = opts.minDiscoveryScore ?? 0;
  const minUfFitScore = opts.minUfFitScore ?? 0;
  const position = opts.position ? String(opts.position).toUpperCase() : '';
  const limit = opts.limit ?? 100;
  return `futurecast:early-discovery:v${FUTURECAST_API_CACHE_VERSION}:${classYearGte}:${minDiscoveryScore}:${minUfFitScore}:${position}:${limit}`;
}

export function highPriorityCacheKey(classYear: number | string): string {
  return `futurecast:high-priority:v${FUTURECAST_API_CACHE_VERSION}:${classYear}`;
}

export function masterBoardCacheKey(): string {
  return `futurecast:master-board:v${FUTURECAST_API_CACHE_VERSION}`;
}

export function trendingBoardCacheKey(): string {
  return `futurecast:trending-board:v${FUTURECAST_API_CACHE_VERSION}`;
}

export function movementIntelCacheKey(classYear: number | string): string {
  return `futurecast:movement-intel:v${FUTURECAST_API_CACHE_VERSION}:${classYear}`;
}

export async function sendCachedJson(
  res: Response,
  cacheKey: string,
  buildPayload: () => Promise<unknown>
): Promise<void> {
  // Default ON in production: never block Lab GETs on cold master-board rebuilds.
  const deferMiss = process.env.FC_GET_NO_SYNC_BUILD !== 'false';
  const { value, hit, stale, deferred } = await cache.wrap(cacheKey, buildPayload, CACHE_TTL_MS, {
    deferMiss,
  });
  if (deferred) {
    res.setHeader('X-GatorVault-Cache', 'DEFERRED');
    res.status(200).json({
      ok: true,
      status: 'building',
      unavailable: true,
      players: [],
      items: [],
      targets: [],
      meta: { cacheKey, cacheReason: 'deferred_rebuild' },
    });
    return;
  }
  const header = !hit ? 'MISS' : stale ? 'STALE' : 'HIT';
  res.setHeader('X-GatorVault-Cache', header);
  res.json(value);
}

/** Prime Lab caches at boot / keepalive (does not throw — logs and continues). */
export async function warmFuturecastHighPriorityCaches(
  years: number[] = [2027, 2028]
): Promise<{ warmed: number; years: number[] }> {
  const { buildHighPriorityPayload } = require('./high-priority');
  let warmed = 0;
  for (const year of years) {
    const key = highPriorityCacheKey(year);
    try {
      const { value } = await cache.wrap(key, () => buildHighPriorityPayload(year), CACHE_TTL_MS);
      if (value != null) {
        writeHighPriorityRuntime(year, value);
        warmed += 1;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[futurecast-cache] warm ${year} failed:`, message);
    }
  }
  return { warmed, years };
}

/**
 * Elite Lab first-paint warm: master-board + trending + movement + high-priority.
 * Master-board was previously unwarmed — first Lab open paid the full board rebuild.
 */
export async function warmFuturecastLabCaches(
  years: number[] = [2027, 2028]
): Promise<{ warmed: string[]; failed: string[] }> {
  const {
    buildMasterBoardPayload,
    buildTrendingBoardPayload,
    buildMovementIntelPayload,
  } = require('./allowlist-board');
  const warmed: string[] = [];
  const failed: string[] = [];

  const { buildUnderclassmenPayload } = require('./underclassmen');
  const { buildEarlyDiscoveryPayload } = require('./early-discovery');

  // Hero commit-likelihood meter needs high-priority ASAP — kick it off first,
  // in parallel with master-board, instead of waiting until every ED warm finishes.
  const hpPromise = warmFuturecastHighPriorityCaches(years);

  const jobs: Array<{ key: string; label: string; build: () => Promise<unknown> }> = [
    {
      key: masterBoardCacheKey(),
      label: 'master-board',
      build: () => buildMasterBoardPayload(),
    },
    {
      key: trendingBoardCacheKey(),
      label: 'trending-board',
      build: () => buildTrendingBoardPayload(),
    },
    {
      key: movementIntelCacheKey(2027),
      label: 'movement-intel:2027',
      build: () => buildMovementIntelPayload(2027),
    },
    {
      key: movementIntelCacheKey(2028),
      label: 'movement-intel:2028',
      build: () => buildMovementIntelPayload(2028),
    },
    {
      key: underclassmenCacheKey([2028, 2029, 2030]),
      label: 'underclassmen:2028-2030',
      build: () => buildUnderclassmenPayload([2028, 2029, 2030]),
    },
    // Lab More boards panel hits this separately from underclassmen — was unwarmed.
    {
      key: earlyDiscoveryCacheKey({ classYearGte: 2028, limit: 4 }),
      label: 'early-discovery:2028:limit4',
      build: () => buildEarlyDiscoveryPayload({ classYearGte: 2028, limit: 4 }),
    },
    {
      key: earlyDiscoveryCacheKey({ classYearGte: 2028, limit: 100 }),
      label: 'early-discovery:2028',
      build: () => buildEarlyDiscoveryPayload({ classYearGte: 2028, limit: 100 }),
    },
    // Full board Early Discovery tab defaults to discovery score ≥ 50.
    {
      key: earlyDiscoveryCacheKey({ classYearGte: 2028, minDiscoveryScore: 50, limit: 100 }),
      label: 'early-discovery:2028:score50',
      build: () =>
        buildEarlyDiscoveryPayload({ classYearGte: 2028, minDiscoveryScore: 50, limit: 100 }),
    },
  ];

  // Master-board first (shared allowlist), then fan out the rest concurrently.
  const [masterJob, ...restJobs] = jobs;
  try {
    await cache.wrap(masterJob.key, masterJob.build, CACHE_TTL_MS);
    warmed.push(masterJob.label);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[futurecast-cache] warm ${masterJob.label} failed:`, message);
    failed.push(masterJob.label);
  }

  await Promise.all(
    restJobs.map(async (job) => {
      try {
        await cache.wrap(job.key, job.build, CACHE_TTL_MS);
        warmed.push(job.label);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`[futurecast-cache] warm ${job.label} failed:`, message);
        failed.push(job.label);
      }
    })
  );

  const hp = await hpPromise;
  if (hp.warmed > 0) {
    warmed.push(`high-priority:${hp.warmed}/${hp.years.length}`);
  } else {
    failed.push('high-priority');
  }

  return { warmed, failed };
}

/** Prime one Lab cache key (used by spaced elite warm). */
export function primeFuturecastCache(cacheKey: string, value: unknown): void {
  cache.set(cacheKey, value, CACHE_TTL_MS);
}

function highPriorityRuntimeCandidates(year: number | string): string[] {
  const path = require('node:path');
  const { resolveRecruitingDataDir, BUNDLE_DIR } = require('../../lib/recruiting-data-dir');
  const name = `high-priority-${year}.json`;
  return [
    path.join(resolveRecruitingDataDir(), 'futurecast-runtime', name),
    path.join(BUNDLE_DIR, 'futurecast-runtime', name),
  ];
}

/** Durable/bundled HP snapshot — survives restart (hub-runtime pattern). */
export function readHighPriorityRuntime(year: number | string): unknown | null {
  const fs = require('node:fs');
  for (const filePath of highPriorityRuntimeCandidates(year)) {
    try {
      if (!fs.existsSync(filePath)) continue;
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
      /* try next */
    }
  }
  return null;
}

export function writeHighPriorityRuntime(year: number | string, value: unknown): boolean {
  try {
    const fs = require('node:fs');
    const path = require('node:path');
    const { resolveRecruitingDataDir } = require('../../lib/recruiting-data-dir');
    const filePath = path.join(
      resolveRecruitingDataDir(),
      'futurecast-runtime',
      `high-priority-${year}.json`
    );
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(value), 'utf8');
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn('[futurecast-cache] write HP runtime failed:', message);
    return false;
  }
}

/** Memory first, then durable disk — keeps Lab elite after worker warm / restart. */
export function loadHighPriorityCached(year: number | string): unknown | null {
  const key = highPriorityCacheKey(year);
  const fresh = cache.get(key);
  if (fresh != null) return fresh;
  const stale = typeof cache.getStale === 'function' ? cache.getStale(key) : null;
  if (stale != null) return stale;
  const disk = readHighPriorityRuntime(year);
  if (disk != null) {
    cache.set(key, disk, CACHE_TTL_MS);
    return disk;
  }
  return null;
}

/** Warm master-board alone — safer than full lab warm on Starter. */
export async function warmFuturecastMasterBoard(): Promise<{ ok: true; key: string }> {
  const { buildMasterBoardPayload } = require('./allowlist-board');
  const key = masterBoardCacheKey();
  await cache.wrap(key, () => buildMasterBoardPayload(), CACHE_TTL_MS);
  return { ok: true, key };
}

export function clearFuturecastCache(): void {
  cache.clear();
}
