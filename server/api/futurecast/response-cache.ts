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
/** Bumped for Expected visit labels merged onto soft/disk HP serve. */
/** v30: heal poisoned Florida RPM on disk serve + background rebuild after DISK hit. */
export const FUTURECAST_API_CACHE_VERSION = 30;

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

export type SendCachedJsonOptions = {
  /**
   * When Tier B deferMiss would return status:building, serve this sync payload instead.
   * Must be a fan-ready body (no status:building) so iOS apiFetch does not throw.
   */
  softOnDeferred?: () => unknown;
  /** After soft deferred response, rebuild into memory in the background (default true). */
  backgroundBuildOnSoft?: boolean;
};

export async function sendCachedJson(
  res: Response,
  cacheKey: string,
  buildPayload: () => Promise<unknown>,
  options: SendCachedJsonOptions = {}
): Promise<void> {
  // Default ON in production: never block Lab GETs on cold master-board rebuilds.
  const deferMiss = process.env.FC_GET_NO_SYNC_BUILD !== 'false';
  const { value, hit, stale, deferred } = await cache.wrap(cacheKey, buildPayload, CACHE_TTL_MS, {
    deferMiss,
  });
  if (deferred) {
    if (typeof options.softOnDeferred === 'function') {
      try {
        const soft = options.softOnDeferred();
        if (soft != null) {
          res.setHeader('X-GatorVault-Cache', 'SOFT');
          res.status(200).json(soft);
          if (options.backgroundBuildOnSoft !== false) {
            void cache
              .wrap(cacheKey, buildPayload, CACHE_TTL_MS)
              .then((result: { value?: unknown }) => {
                if (result?.value != null) {
                  console.log('[futurecast-cache] background warm after soft', cacheKey);
                }
              })
              .catch((err: unknown) => {
                const message = err instanceof Error ? err.message : String(err);
                console.warn('[futurecast-cache] background warm failed', cacheKey, message);
              });
          }
          return;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn('[futurecast-cache] softOnDeferred failed', cacheKey, message);
      }
    }
    res.setHeader('X-GatorVault-Cache', 'DEFERRED');
    // Always include array fields FutureCast Lab spreads/slices during SSG/iOS paint.
    res.status(200).json({
      ok: true,
      status: 'building',
      unavailable: true,
      players: [],
      items: [],
      targets: [],
      trendingUp: [],
      trendingDown: [],
      risers: [],
      fallers: [],
      highVolatility: [],
      stable: [],
      fitScoreLeaders: [],
      fitScoreRisks: [],
      alerts: [],
      notes: [],
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

/** Fan Lab cards treat 0 as a real rating — coerce unknown/placeholder stars to null. */
export function normalizeFanStars(raw: unknown): number | null {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.round(n);
}

/**
 * Disk/runtime HP can keep Florida ufRpmPct=100 after a 1% On3 residual poison
 * while competingSchools still show Miss State/etc leading. Heal on every serve
 * so Closest does not wait for a full rebuild cron.
 */
export function healHighPriorityRpmPoisonRow(row: Record<string, unknown>): Record<string, unknown> {
  const { sanitizeRpmPct } = require('../../lib/uf-probability-utils') as {
    sanitizeRpmPct: (v: unknown) => number | null;
  };
  const rpm = sanitizeRpmPct(row.ufRpmPct);
  const comps = Array.isArray(row.competingSchools)
    ? (row.competingSchools as Array<{ name?: string; pct?: number }>)
    : [];
  const real = comps
    .filter((c) => c?.name && Number(c.pct) >= 5)
    .sort((a, b) => Number(b.pct) - Number(a.pct));
  const top = real[0];
  const topIsFlorida = top && /\bflorida\b|\bgators\b/i.test(String(top.name || ''));
  const florida = real.find((c) => /\bflorida\b|\bgators\b/i.test(String(c.name || '')));
  const floridaPct = florida ? Number(florida.pct) : 0;

  let nextRpm = rpm;
  let poisoned = false;
  if (rpm != null && rpm >= 85 && top && !topIsFlorida && floridaPct + 40 < rpm) {
    nextRpm = floridaPct > 0 ? Math.round(floridaPct) : null;
    poisoned = true;
  }
  // Rival-led board with absurd Florida lock and no Florida crumb on the peer list.
  if (
    !poisoned &&
    rpm != null &&
    rpm >= 85 &&
    top &&
    !topIsFlorida &&
    Number(top.pct) >= 12 &&
    Number(top.pct) + 40 < rpm
  ) {
    nextRpm = null;
    poisoned = true;
  }
  if (!poisoned) return row;

  const anchor = nextRpm != null && nextRpm > 0 ? nextRpm : 1;
  const uf = Number(row.ufProbability);
  let nextUf = uf;
  if (Number.isFinite(uf) && uf > anchor + 15) {
    // Market-anchored GV band — never leave Closest on a fake 77% over Miss State.
    nextUf = Math.min(99, Math.max(1, anchor + 10));
  }

  const predictors = Array.isArray(row.predictors)
    ? (row.predictors as Array<{ name?: string; score?: number }>).map((p) => {
        if (p && /on3/i.test(String(p.name || '')) && nextRpm != null) {
          return { ...p, score: nextRpm };
        }
        if (p && /on3/i.test(String(p.name || '')) && nextRpm == null) {
          return { ...p, score: anchor };
        }
        return p;
      })
    : row.predictors;

  return {
    ...row,
    ufRpmPct: nextRpm,
    ufProbability: Number.isFinite(nextUf) ? nextUf : row.ufProbability,
    predictors,
  };
}

/** Sanitize HP (and similar) payloads so seed/disk leftovers never emit 0★
 *  and never resurrect alumni/roster ATH phantoms from durable runtime cache.
 */
export function sanitizeHighPriorityStarsPayload(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value;
  const doc = value as Record<string, unknown>;
  if (!Array.isArray(doc.players)) return value;
  let players = doc.players.map((row) => {
    if (!row || typeof row !== 'object') return row;
    const p = row as Record<string, unknown>;
    return healHighPriorityRpmPoisonRow({ ...p, stars: normalizeFanStars(p.stars) });
  });
  try {
    const { filterBlockedRecruits } = require('../../lib/recruiting-blocked-players') as {
      filterBlockedRecruits: (list: unknown[]) => unknown[];
    };
    players = filterBlockedRecruits(players);
  } catch {
    /* optional */
  }
  // Soft/disk HP can predate a full rebuild — stamp Expected visit labels on every serve.
  try {
    const { mergeExpectedVisitHistory } = require('../../lib/game-week-visitors') as {
      mergeExpectedVisitHistory: (
        slug: string,
        visitHistory: unknown
      ) => Array<{ type: string; label: string }>;
    };
    players = players.map((row) => {
      if (!row || typeof row !== 'object') return row;
      const p = row as Record<string, unknown>;
      const slug = String(p.slug || '');
      if (!slug) return row;
      return {
        ...p,
        visitHistory: mergeExpectedVisitHistory(slug, p.visitHistory),
      };
    });
  } catch {
    /* optional */
  }
  // Charles elite profile bar — Priority Chase is not a dumping ground for thin soft shells.
  try {
    const { filterEliteChaseProfiles } = require('../../lib/elite-chase-profile-bar') as {
      filterEliteChaseProfiles: (list: unknown[]) => unknown[];
    };
    const before = players.length;
    players = filterEliteChaseProfiles(players);
    if (players.length !== before) {
      /* count updated below */
    }
  } catch {
    /* optional */
  }
  return {
    ...doc,
    count: Array.isArray(players) ? players.length : doc.count,
    players,
  };
}

/** Durable/bundled HP snapshot — survives restart (hub-runtime pattern). */
export function readHighPriorityRuntime(year: number | string): unknown | null {
  const fs = require('node:fs');
  for (const filePath of highPriorityRuntimeCandidates(year)) {
    try {
      if (!fs.existsSync(filePath)) continue;
      return sanitizeHighPriorityStarsPayload(JSON.parse(fs.readFileSync(filePath, 'utf8')));
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
    fs.writeFileSync(filePath, JSON.stringify(sanitizeHighPriorityStarsPayload(value)), 'utf8');
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
  if (fresh != null) return sanitizeHighPriorityStarsPayload(fresh);
  const stale = typeof cache.getStale === 'function' ? cache.getStale(key) : null;
  if (stale != null) return sanitizeHighPriorityStarsPayload(stale);
  const disk = readHighPriorityRuntime(year);
  if (disk != null) {
    const healed = sanitizeHighPriorityStarsPayload(disk);
    cache.set(key, healed, CACHE_TTL_MS);
    return healed;
  }
  return null;
}

function masterBoardRuntimeCandidates(): string[] {
  const path = require('node:path');
  const { resolveRecruitingDataDir, BUNDLE_DIR } = require('../../lib/recruiting-data-dir');
  const name = 'master-board.json';
  return [
    path.join(resolveRecruitingDataDir(), 'futurecast-runtime', name),
    path.join(BUNDLE_DIR, 'futurecast-runtime', name),
  ];
}

function isUsableMasterBoard(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const doc = value as Record<string, unknown>;
  if (doc.status === 'building' || doc.unavailable === true) return false;
  return Array.isArray(doc.players) && doc.players.length > 0;
}

/** Durable/bundled master-board snapshot — keeps iOS Lab primary off status:building. */
export function readMasterBoardRuntime(): unknown | null {
  const fs = require('node:fs');
  for (const filePath of masterBoardRuntimeCandidates()) {
    try {
      if (!fs.existsSync(filePath)) continue;
      const doc = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (isUsableMasterBoard(doc)) return doc;
    } catch {
      /* try next */
    }
  }
  return null;
}

export function writeMasterBoardRuntime(value: unknown): boolean {
  if (!isUsableMasterBoard(value)) return false;
  try {
    const fs = require('node:fs');
    const path = require('node:path');
    const { resolveRecruitingDataDir } = require('../../lib/recruiting-data-dir');
    const filePath = path.join(resolveRecruitingDataDir(), 'futurecast-runtime', 'master-board.json');
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(value), 'utf8');
    // Also refresh bundled seed so deploys keep a fan-ready fallback.
    try {
      const { BUNDLE_DIR } = require('../../lib/recruiting-data-dir');
      const bundlePath = path.join(BUNDLE_DIR, 'futurecast-runtime', 'master-board.json');
      fs.mkdirSync(path.dirname(bundlePath), { recursive: true });
      fs.writeFileSync(bundlePath, JSON.stringify(value), 'utf8');
    } catch {
      /* optional */
    }
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn('[futurecast-cache] write master-board runtime failed:', message);
    return false;
  }
}

/** Soft board from HP seed when master disk is cold — never return empty building to iOS. */
export function softMasterBoardFromHighPriority(): unknown | null {
  // Merge Closing (2027) + Discovery (2028) so Lab year-scoped panels never miss
  // open hunts like Tranard when master-board is cold.
  type HpSoft = {
    players?: Array<Record<string, unknown>>;
    updatedAt?: string;
    lastUpdated?: string;
  } | null;
  const hp27 = loadHighPriorityCached(2027) as HpSoft;
  const hp28 = loadHighPriorityCached(2028) as HpSoft;
  const rows = [
    ...(Array.isArray(hp27?.players) ? hp27!.players! : []),
    ...(Array.isArray(hp28?.players) ? hp28!.players! : []),
  ];
  if (!rows.length) return null;
  const hp = hp28?.players?.length ? hp28 : hp27;

  const players = rows.map((p, idx) => {
    const uf =
      Number(p.ufProbability ?? p.ufConfidence ?? p.ufRpmPct ?? p.ufPct ?? 0) || 0;
    return {
      id: String(p.id || p.slug || `soft-${idx}`),
      slug: String(p.slug || ''),
      name: String(p.name || p.fullName || p.slug || 'Player'),
      position: p.position ?? null,
      school: p.school ?? p.highSchool ?? null,
      classYear: Number(p.classYear) || Number(p.class) || 2028,
      ufConfidence: uf,
      ufProbability: uf,
      ufRpmPct: p.ufRpmPct ?? null,
      trendDelta7d: Number(p.delta7d ?? p.trendDelta7d ?? 0) || 0,
      fitScore: Number(p.fitScore ?? p.ufFitScore ?? 0) || 0,
      stars: normalizeFanStars(p.stars),
      committedTo: p.committedTo ?? null,
      priority: 'high',
      volatility7d: Number(p.volatilityScore ?? p.volatility7d ?? 0) || 0,
      predictors: Array.isArray(p.predictors) ? p.predictors : [],
      competingSchools: Array.isArray(p.competingSchools) ? p.competingSchools : [],
    };
  });

  const avg =
    players.reduce((sum, p) => sum + (Number(p.ufConfidence) || 0), 0) / players.length;
  const updatedAt = String(hp?.updatedAt || hp?.lastUpdated || new Date().toISOString());
  const highPriority = players.slice(0, 18);

  return {
    classYear: 2028,
    updatedAt,
    movementHeatmap: { upCount: 0, downCount: 0, flatCount: players.length },
    heatmap: {
      buckets: [
        { label: 'Up', count: 0 },
        { label: 'Down', count: 0 },
        { label: 'Flat', count: players.length },
      ],
      windowDays: 7,
    },
    ufConfidenceAverage: avg,
    confidenceSparkline: [],
    commitWatch: [],
    highPriority: {
      playerIds: highPriority.map((p) => p.id),
      players: highPriority,
    },
    movementSummary: {
      risers: [],
      fallers: [],
      highVolatility: [],
      riserPlayers: [],
      fallerPlayers: [],
      volatilePlayers: [],
    },
    players,
    degraded: 'hp_soft_seed',
  };
}

/** Memory → disk → HP soft seed. */
export function loadMasterBoardCached(): unknown | null {
  const key = masterBoardCacheKey();
  const fresh = cache.get(key);
  if (isUsableMasterBoard(fresh)) return fresh;
  const stale = typeof cache.getStale === 'function' ? cache.getStale(key) : null;
  if (isUsableMasterBoard(stale)) return stale;
  const disk = readMasterBoardRuntime();
  if (disk != null) {
    cache.set(key, disk, CACHE_TTL_MS);
    return disk;
  }
  const soft = softMasterBoardFromHighPriority();
  if (soft != null) {
    cache.set(key, soft, CACHE_TTL_MS);
    return soft;
  }
  return null;
}

/** Soft movement-intel plate from master-board — never missing riser/faller arrays. */
export function softMovementIntelFromMaster(classYear = 2028): {
  classYear: number;
  updatedAt: string;
  movementHeatmap: { upCount: number; downCount: number; flatCount: number };
  heatmap: { buckets: { label: string; count: number }[]; windowDays: number };
  risers: unknown[];
  fallers: unknown[];
  highVolatility: unknown[];
  stable: unknown[];
  fitScoreLeaders: unknown[];
  fitScoreRisks: unknown[];
  alerts: unknown[];
  degraded: string;
} {
  const softTrend = softTrendingBoardFromMaster();
  const master = loadMasterBoardCached() as
    | {
        updatedAt?: string;
        movementHeatmap?: { upCount: number; downCount: number; flatCount: number };
        heatmap?: { buckets: { label: string; count: number }[]; windowDays: number };
        players?: unknown[];
      }
    | null;
  const players = Array.isArray(master?.players) ? master!.players! : [];
  return {
    classYear: Number(classYear) || softTrend.classYear,
    updatedAt: String(master?.updatedAt || softTrend.updatedAt),
    movementHeatmap: master?.movementHeatmap || {
      upCount: softTrend.trendingUp.length,
      downCount: softTrend.trendingDown.length,
      flatCount: Math.max(0, players.length - softTrend.trendingUp.length - softTrend.trendingDown.length),
    },
    heatmap: master?.heatmap || {
      buckets: [
        { label: 'Up', count: softTrend.trendingUp.length },
        { label: 'Down', count: softTrend.trendingDown.length },
        { label: 'Flat', count: Math.max(0, players.length - softTrend.trendingUp.length - softTrend.trendingDown.length) },
      ],
      windowDays: 7,
    },
    risers: softTrend.trendingUp,
    fallers: softTrend.trendingDown,
    highVolatility: [],
    stable: [],
    fitScoreLeaders: [],
    fitScoreRisks: [],
    alerts: [],
    degraded: 'master_soft_movement',
  };
}

/** Soft trending plate from master-board / empty arrays — never status:building for Lab. */
export function softTrendingBoardFromMaster(): {
  classYear: number;
  updatedAt: string;
  trendingUp: unknown[];
  trendingDown: unknown[];
  degraded: string;
} {
  const master = loadMasterBoardCached() as
    | {
        classYear?: number;
        updatedAt?: string;
        movementSummary?: {
          riserPlayers?: unknown[];
          fallerPlayers?: unknown[];
        };
        players?: Array<Record<string, unknown>>;
      }
    | null;
  const updatedAt = String(master?.updatedAt || new Date().toISOString());
  const classYear = Number(master?.classYear) || 2028;
  let trendingUp = Array.isArray(master?.movementSummary?.riserPlayers)
    ? master!.movementSummary!.riserPlayers!
    : [];
  let trendingDown = Array.isArray(master?.movementSummary?.fallerPlayers)
    ? master!.movementSummary!.fallerPlayers!
    : [];
  if (!trendingUp.length && !trendingDown.length && Array.isArray(master?.players)) {
    const ranked = [...master!.players!].sort(
      (a, b) => Number(b.trendDelta7d ?? 0) - Number(a.trendDelta7d ?? 0)
    );
    trendingUp = ranked.filter((p) => Number(p.trendDelta7d ?? 0) > 0).slice(0, 8);
    trendingDown = ranked
      .filter((p) => Number(p.trendDelta7d ?? 0) < 0)
      .sort((a, b) => Number(a.trendDelta7d ?? 0) - Number(b.trendDelta7d ?? 0))
      .slice(0, 8);
  }
  return {
    classYear,
    updatedAt,
    trendingUp,
    trendingDown,
    degraded: 'master_soft_trending',
  };
}

/** Warm master-board alone — safer than full lab warm on Starter. */
export async function warmFuturecastMasterBoard(): Promise<{ ok: true; key: string }> {
  const { buildMasterBoardPayload } = require('./allowlist-board');
  const key = masterBoardCacheKey();
  const { value } = await cache.wrap(key, () => buildMasterBoardPayload(), CACHE_TTL_MS);
  if (value != null) writeMasterBoardRuntime(value);
  return { ok: true, key };
}

export function clearFuturecastCache(): void {
  cache.clear();
}
