/**
 * In-memory player profile cache — instant revisits within TTL.
 */
import type { FullProfilePayload } from './player-full-profile-api';

export const PROFILE_CACHE_TTL_MS = 5 * 60 * 1000;

type CacheEntry = {
  data: FullProfilePayload;
  cachedAt: number;
};

const profileCache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<FullProfilePayload>>();

export function profileCacheKey(slug: string, playerId?: string | null): string {
  return playerId ? `id:${playerId}` : `slug:${slug.trim().toLowerCase()}`;
}

export function isProfileCacheFresh(entry: CacheEntry): boolean {
  const apiAge = Date.now() - new Date(entry.data.lastUpdated).getTime();
  const localAge = Date.now() - entry.cachedAt;
  return apiAge < PROFILE_CACHE_TTL_MS && localAge < PROFILE_CACHE_TTL_MS;
}

export function readProfileCache(key: string): FullProfilePayload | null {
  const entry = profileCache.get(key);
  if (!entry || !isProfileCacheFresh(entry)) {
    if (entry) profileCache.delete(key);
    return null;
  }
  return entry.data;
}

export function writeProfileCache(key: string, data: FullProfilePayload): void {
  profileCache.set(key, { data, cachedAt: Date.now() });
}

export function getInflightProfile(key: string): Promise<FullProfilePayload> | undefined {
  return inflight.get(key);
}

export function setInflightProfile(key: string, promise: Promise<FullProfilePayload>): void {
  inflight.set(key, promise);
  void promise.finally(() => {
    if (inflight.get(key) === promise) inflight.delete(key);
  });
}

export function invalidateProfileCache(key?: string): void {
  if (key) profileCache.delete(key);
  else profileCache.clear();
}
