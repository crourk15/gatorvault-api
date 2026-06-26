/**
 * 60s in-memory cache for FutureCast homepage API payloads.
 */
import type { Response } from 'express';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createMemoryCache } = require('../../lib/memory-cache');

const CACHE_TTL_MS = 60_000;
const cache = createMemoryCache(CACHE_TTL_MS);

/** Bump when high-priority or master-board payload shape changes. */
export const FUTURECAST_API_CACHE_VERSION = 6;

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
  const { value, hit } = await cache.wrap(cacheKey, buildPayload, CACHE_TTL_MS);
  res.setHeader('X-GatorVault-Cache', hit ? 'HIT' : 'MISS');
  res.json(value);
}

export function clearFuturecastCache(): void {
  cache.clear();
}
