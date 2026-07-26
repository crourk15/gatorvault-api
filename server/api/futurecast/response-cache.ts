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
export const FUTURECAST_API_CACHE_VERSION = 19;

export function underclassmenCacheKey(years: Array<number | string>): string {
  return `futurecast:underclassmen:v${FUTURECAST_API_CACHE_VERSION}:${years.join(',')}`;
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
  const { value, hit, stale } = await cache.wrap(cacheKey, buildPayload, CACHE_TTL_MS);
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
      await cache.wrap(key, () => buildHighPriorityPayload(year), CACHE_TTL_MS);
      warmed += 1;
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
  ];

  // Build shared allowlist board first via master-board, then fan out the rest.
  for (const job of jobs) {
    try {
      await cache.wrap(job.key, job.build, CACHE_TTL_MS);
      warmed.push(job.label);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[futurecast-cache] warm ${job.label} failed:`, message);
      failed.push(job.label);
    }
  }

  const hp = await warmFuturecastHighPriorityCaches(years);
  if (hp.warmed > 0) {
    warmed.push(`high-priority:${hp.warmed}/${hp.years.length}`);
  } else {
    failed.push('high-priority');
  }

  return { warmed, failed };
}

export function clearFuturecastCache(): void {
  cache.clear();
}
