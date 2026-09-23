/**
 * Aggregated player profile API — single round-trip + resolve.
 */
import { apiFetch } from './api-fetch';
import type { PlayerProfileBundle, PlayerCore } from './player-api';
import type { PortalIntelPayload, TransferPrediction } from './portal-api';
import type { UfFitIntelResponse } from './uf-fit-api';
import {
  profileCacheKey,
  readProfileCache,
  setInflightProfile,
  writeProfileCache,
  getInflightProfile,
} from './profile-cache';
import { normalizeFullProfilePayload } from './player-profile-normalize';

export type FullProfileMovementWindow = {
  ufProbNow: number;
  ufProb7dAgo: number;
  delta7d: number;
  volatilityScore: number;
  windowDays: number;
};

export type FullProfileCompetingSchool = {
  school: string;
  rankNow: number;
  rankPrior: number | null;
  delta: number;
  volatilityBoost: number;
  pct?: number | null;
};

export type FullProfileFuturecastSummary = {
  ufProbability: number | null;
  on3UfProbability?: number | null;
  gvProbability?: number | null;
  predictedSchool: string | null;
  movementDelta: number | null;
  fitScore: number | null;
  volatilityScore: number | null;
};

export type FullProfileVaultScouting = {
  evaluation: string | null;
  comparison: string | null;
  projection: string | null;
  strengths: string[];
  schemeFit?: string | null;
};

export type FullProfilePayload = {
  lastUpdated: string;
  source: 'postgres' | 'recruiting-store';
  player: PlayerCore;
  highSchoolProfile: PlayerProfileBundle['highSchoolProfile'];
  collegeProfile: PlayerProfileBundle['collegeProfile'];
  portalProfile: PlayerProfileBundle['portalProfile'];
  ufSpecificProfile: PlayerProfileBundle['ufSpecificProfile'];
  movementWindow: FullProfileMovementWindow | null;
  movementHistory: PlayerCore['movementHistory'];
  signals: PlayerProfileBundle['signals'];
  related: PlayerProfileBundle['related'];
  portalPredictions: {
    predictions: TransferPrediction[];
    intel: PortalIntelPayload;
  } | null;
  fitIntel: UfFitIntelResponse | null;
  competingSchools: FullProfileCompetingSchool[];
  futurecastSummary: FullProfileFuturecastSummary | null;
  vaultScouting?: FullProfileVaultScouting | null;
};

export type ResolvePlayerKind = 'futurecast' | 'roster' | 'recruiting-fallback';

export type ResolvePlayerResponse = {
  ok: boolean;
  kind: ResolvePlayerKind;
  playerId: string;
  canonicalSlug: string;
  redirectHref: string | null;
  roster: Record<string, unknown> | null;
};

export type ProfileRouteContext = 'recruiting' | 'futurecast' | 'roster' | 'auto';

export function mapFullProfileToBundle(payload: FullProfilePayload): PlayerProfileBundle {
  const normalized = normalizeFullProfilePayload(payload);
  return {
    player: normalized.player,
    highSchoolProfile: normalized.highSchoolProfile,
    collegeProfile: normalized.collegeProfile,
    portalProfile: normalized.portalProfile,
    ufSpecificProfile: normalized.ufSpecificProfile,
    signals: normalized.signals,
    related: normalized.related,
  };
}

export async function fetchFullProfile(
  slug: string,
  options?: { force?: boolean; playerId?: string | null }
): Promise<FullProfilePayload> {
  const normalized = slug.trim().toLowerCase();
  const key = profileCacheKey(normalized, options?.playerId);

  if (!options?.force) {
    const cached = readProfileCache(key);
    if (cached) return cached;
    const pending = getInflightProfile(key);
    if (pending) return pending;
  }

  dequeuePrefetch(normalized);

  const job = apiFetch<FullProfilePayload & { ok?: boolean }>(
    `/api/player/full-profile/${encodeURIComponent(normalized)}`
  ).then((raw) => {
    const {
      ok: _ok,
      lastUpdated,
      source,
      player,
      highSchoolProfile,
      collegeProfile,
      portalProfile,
      ufSpecificProfile,
      movementWindow,
      movementHistory,
      signals,
      related,
      portalPredictions,
      fitIntel,
      competingSchools,
      futurecastSummary,
      vaultScouting,
    } = raw;
    const data: FullProfilePayload = normalizeFullProfilePayload({
      lastUpdated,
      source,
      player,
      highSchoolProfile: highSchoolProfile ?? null,
      collegeProfile: collegeProfile ?? null,
      portalProfile: portalProfile ?? null,
      ufSpecificProfile: ufSpecificProfile ?? null,
      movementWindow: movementWindow ?? null,
      movementHistory: movementHistory ?? [],
      signals: signals ?? [],
      related: related ?? [],
      portalPredictions: portalPredictions ?? null,
      fitIntel: fitIntel ?? null,
      competingSchools: competingSchools ?? [],
      futurecastSummary: futurecastSummary ?? null,
      vaultScouting: vaultScouting ?? null,
    });
    writeProfileCache(key, data);
    if (data.player?.id) {
      writeProfileCache(profileCacheKey(normalized, data.player.id), data);
    }
    return data;
  });

  setInflightProfile(key, job);
  return job;
}

/** Cap concurrent visitor-list prefetches so one tap is not stuck behind 20 cooks. */
const PREFETCH_CONCURRENCY = 2;
const prefetchQueue: string[] = [];
const queuedPrefetch = new Set<string>();
let prefetchActive = 0;

function dequeuePrefetch(slug: string): void {
  if (!queuedPrefetch.has(slug)) return;
  queuedPrefetch.delete(slug);
  const idx = prefetchQueue.indexOf(slug);
  if (idx >= 0) prefetchQueue.splice(idx, 1);
}

function pumpPrefetchQueue(): void {
  while (prefetchActive < PREFETCH_CONCURRENCY && prefetchQueue.length) {
    const next = prefetchQueue.shift();
    if (!next) break;
    queuedPrefetch.delete(next);
    prefetchActive += 1;
    void fetchFullProfile(next)
      .catch(() => {})
      .finally(() => {
        prefetchActive -= 1;
        pumpPrefetchQueue();
      });
  }
}

/** Prefetch profile bundle when link scrolls into view (populates cache). */
export function prefetchFullProfile(slug: string): void {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return;
  const key = profileCacheKey(normalized);
  if (readProfileCache(key) || getInflightProfile(key)) return;
  if (queuedPrefetch.has(normalized)) return;
  queuedPrefetch.add(normalized);
  prefetchQueue.push(normalized);
  pumpPrefetchQueue();
}

export async function resolvePlayerSlug(
  slug: string,
  context: ProfileRouteContext = 'auto'
): Promise<ResolvePlayerResponse> {
  const normalized = slug.trim().toLowerCase();
  const qs = context !== 'auto' ? `?context=${encodeURIComponent(context)}` : '';
  return apiFetch<ResolvePlayerResponse>(
    `/api/player/resolve/${encodeURIComponent(normalized)}${qs}`
  );
}

/** Extract player slug from vault profile href. */
export function playerSlugFromHref(href: string): string | null {
  try {
    const path = new URL(href, 'https://gatorvaultinsider.com').pathname.replace(/\/$/, '');
    const patterns = [
      /\/vault\/recruiting\/player\/([^/]+)$/,
      /\/vault\/futurecast\/player\/([^/]+)$/,
      /\/vault\/portal\/player\/([^/]+)$/,
      /\/vault\/players\/([^/]+)$/,
      /\/recruiting\/player\/([^/]+)$/,
      /\/futurecast\/player\/([^/]+)$/,
      /\/players\/([^/]+)$/,
    ];
    for (const re of patterns) {
      const m = path.match(re);
      if (m?.[1]) return decodeURIComponent(m[1]).toLowerCase();
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function isPlayerProfileHref(href: string): boolean {
  return playerSlugFromHref(href) != null;
}
