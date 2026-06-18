/**
 * Recruiting Hub API — backend contract with 5-minute client cache.
 */
import { apiFetch } from '@/lib/api-fetch';
import type { RecruitingBoardPlayer } from '@/lib/recruiting-board-api';

export const RECRUITING_CACHE_TTL_MS = 5 * 60_000;
export const RECRUITING_INTEL_CACHE_TTL_MS = 60_000;

export interface RecruitingPlayer extends RecruitingBoardPlayer {
  id?: string;
  class?: number;
  nationalRank?: number | null;
  positionRank?: number | null;
  commitmentDate?: string | null;
  intel?: RecruitingIntelItem[];
}

export interface RecruitingIntelItem {
  id: string;
  playerId: string;
  /** Canonical recruiting slug when resolved from intel row (preferred over numeric On3 id). */
  playerSlug?: string | null;
  timestamp: string;
  text: string;
  ufProbability: number;
}

/** GET /api/recruiting/class/:year */
export interface RecruitingClassPayload {
  ok?: boolean;
  year: number;
  commits: number;
  classScore: number;
  nationalRank: number;
  secRank: number;
  blueChipRatio: number;
  inStateRatio: number;
  yoyMovement: number;
  players: RecruitingPlayer[];
}

/** GET /api/recruiting/player/:id */
export type RecruitingPlayerPayload = RecruitingPlayer;

export interface RecruitingPortalEntry {
  playerId: string;
  name: string;
  position: string;
  status: string;
  intel?: RecruitingIntelItem[];
}

type CacheEntry<T> = { savedAt: number; payload: T };

function readCache<T>(key: string, maxAgeMs: number): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { savedAt, payload } = JSON.parse(raw) as CacheEntry<T>;
    if (Date.now() - savedAt > maxAgeMs) return null;
    return payload;
  } catch {
    return null;
  }
}

function writeCache<T>(key: string, payload: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), payload }));
  } catch {
    /* quota */
  }
}

function invalidateCacheKey(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(key);
  } catch {
    /* quota */
  }
}

async function cachedFetch<T>(
  key: string,
  path: string,
  maxAgeMs = RECRUITING_CACHE_TTL_MS,
  force = false
): Promise<T> {
  if (!force) {
    const hit = readCache<T>(key, maxAgeMs);
    if (hit) return hit;
  }
  const sep = path.includes('?') ? '&' : '?';
  const url = force ? `${path}${sep}force=1` : path;
  const payload = await apiFetch<T>(url);
  writeCache(key, payload);
  return payload;
}

export function fetchRecruitingClass(year: number): Promise<RecruitingClassPayload> {
  return cachedFetch(`gv:recruiting:class:${year}`, `/api/recruiting/class/${year}`);
}

export function fetchRecruitingPlayer(id: string): Promise<RecruitingPlayerPayload> {
  return cachedFetch(`gv:recruiting:player:${id}`, `/api/recruiting/player/${encodeURIComponent(id)}`).then((raw) => {
    const wrapped = raw as { player?: RecruitingPlayerPayload };
    return wrapped.player ?? (raw as RecruitingPlayerPayload);
  });
}

export type HighPriorityIntelResponse = {
  items: RecruitingIntelItem[];
  lastUpdated: string | null;
};

export function fetchHighPriorityIntel(options?: { force?: boolean }): Promise<HighPriorityIntelResponse> {
  const force = options?.force ?? false;
  return cachedFetch(
    'gv:recruiting:intel:hp',
    '/api/recruiting/intel/high-priority',
    RECRUITING_INTEL_CACHE_TTL_MS,
    force
  ).then((raw) => {
    if (Array.isArray(raw)) {
      return { items: raw, lastUpdated: null };
    }
    const wrapped = raw as {
      items?: RecruitingIntelItem[];
      intel?: RecruitingIntelItem[];
      lastUpdated?: string;
      meta?: { lastUpdated?: string };
    };
    return {
      items: wrapped.items ?? wrapped.intel ?? [],
      lastUpdated: wrapped.lastUpdated ?? wrapped.meta?.lastUpdated ?? null,
    };
  });
}

export function invalidateRecruitingIntelCache(): void {
  invalidateCacheKey('gv:recruiting:intel:hp');
}

export function fetchRecruitingTargets(year: number): Promise<RecruitingPlayer[]> {
  return cachedFetch(`gv:recruiting:targets:${year}`, `/api/recruiting/targets/${year}`).then((raw) => {
    if (Array.isArray(raw)) return raw;
    const wrapped = raw as { items?: RecruitingPlayer[]; targets?: RecruitingPlayer[] };
    return wrapped.items ?? wrapped.targets ?? [];
  });
}

export function fetchRecruitingPortal(): Promise<RecruitingPortalEntry[]> {
  return cachedFetch('gv:recruiting:portal', '/api/recruiting/portal').then((raw) => {
    const data = raw as { incoming?: RecruitingPortalEntry[] };
    return (data.incoming ?? []).map((p) => ({
      playerId: p.playerId ?? (p as { slug?: string }).slug ?? '',
      name: p.name,
      position: p.position ?? '',
      status: p.status ?? 'inbound',
      intel: p.intel,
    }));
  });
}
