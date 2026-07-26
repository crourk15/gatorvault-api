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
export const FUTURECAST_API_CACHE_VERSION = 17;

export function highPriorityCacheKey(classYear: number | string): string {
  return `futurecast:high-priority:v${FUTURECAST_API_CACHE_VERSION}:${classYear}`;
}

export function masterBoardCacheKey(): string {
  return `futurecast:master-board:v${FUTURECAST_API_CACHE_VERSION}`;
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

export function clearFuturecastCache(): void {
  cache.clear();
}
