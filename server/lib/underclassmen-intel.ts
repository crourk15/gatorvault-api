/**
 * Per-player underclassmen intel (2028–2030) — early watchlist + board enrichment.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { loadBoardPlayersForSlugs, type FutureCastBoardPlayer } from '../api/futurecast/allowlist-board';
import { getRecruitingPlayerBySlug } from '../api/players/recruiting-fallback';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Fixed namespace for deterministic underclassmen intel UUIDs (RFC 4122 v5). */
const INTEL_NAMESPACE = 'a3b5c7d9-e1f2-4a6b-8c0d-2e4f6a8b0c1d';

const EARLY_WATCHLIST_PATH = path.join(__dirname, '../data/futurecast/early-watchlist.json');
const UNDERCLASSMEN_MIN_YEAR = 2028;
const UNDERCLASSMEN_MAX_YEAR = 2030;

export type UnderclassmenEarlyIntel = {
  slug: string;
  name: string;
  classYear: number;
  position: string;
  tier: 'target' | 'watchlist';
  ufProbability: number;
  fitScore: number;
  discoveryScore: number | null;
  volatilityScore: number;
  priority: string;
  committedTo: string | null;
  competingSchools: Array<{ name: string; pct: number }>;
};

export type UnderclassmenEarlySignal = {
  id: string;
  playerId: string;
  signalType: string;
  signalValue: Record<string, unknown>;
  createdAt: string;
};

export type UnderclassmenEarlyMovement = {
  trendDelta7d: number;
  volatility7d: number;
  movementWindow: {
    ufProbNow: number;
    ufProb7dAgo: number;
    delta7d: number;
    volatilityScore: number;
    windowDays: number;
  } | null;
  movementHistory: Array<{ date: string; confidence: number }>;
};

export type UnderclassmenFutureCastPick = {
  id: string;
  school: string;
  confidence: number;
  delta?: number;
  sourceType: 'MODEL' | 'STAFF' | 'FAN' | 'BLENDED';
  predictorId: string;
  status: 'ACTIVE' | 'HIT' | 'MISS' | 'WITHDRAWN';
  createdAt: string;
  updatedAt: string;
};

export type UnderclassmenRelatedIntel = {
  id: string;
  slug: string;
  fullName: string;
  classYear: number;
  position: string;
  ufConfidence: number;
  fitScore: number;
};

export type UnderclassmenIntelBundle = {
  intelUuid: string;
  slug: string;
  classYear: number;
  earlyIntel: UnderclassmenEarlyIntel;
  earlySignals: UnderclassmenEarlySignal[];
  earlyMovement: UnderclassmenEarlyMovement;
  earlyFutureCastPicks: UnderclassmenFutureCastPick[];
  relatedIntel: UnderclassmenRelatedIntel[];
  updatedAt: string;
};

type EarlyWatchEntry = {
  slug?: string;
  name?: string;
  classYear?: number;
  tier?: string;
  pos?: string;
  position?: string;
  ufProbability?: number;
  fitScore?: number;
  discoveryScore?: number;
  earlyMovement?: number;
  competingSchools?: Array<{ name: string; pct: number }>;
};

function namespaceBytes(uuid: string): Buffer {
  return Buffer.from(uuid.replace(/-/g, ''), 'hex');
}

/** Deterministic UUID v5 from player slug — stable intel id for underclassmen profiles. */
export function intelUuidForSlug(slug: string): string {
  const normalized = String(slug || '').trim().toLowerCase();
  const hash = crypto
    .createHash('sha1')
    .update(Buffer.concat([namespaceBytes(INTEL_NAMESPACE), Buffer.from(normalized, 'utf8')]))
    .digest();

  hash[6] = (hash[6]! & 0x0f) | 0x50;
  hash[8] = (hash[8]! & 0x3f) | 0x80;

  const hex = hash.toString('hex').slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export function isUnderclassmenClassYear(classYear: number): boolean {
  return classYear >= UNDERCLASSMEN_MIN_YEAR && classYear <= UNDERCLASSMEN_MAX_YEAR;
}

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

function earlyMetaForSlug(slug: string): EarlyWatchEntry | undefined {
  const key = String(slug || '').toLowerCase();
  return loadEarlyWatchEntries().find((e) => String(e.slug || '').toLowerCase() === key);
}

async function resolveClassYear(slug: string, entry?: EarlyWatchEntry): Promise<number | null> {
  if (entry?.classYear && isUnderclassmenClassYear(Number(entry.classYear))) {
    return Number(entry.classYear);
  }
  const recruiting = await getRecruitingPlayerBySlug(slug);
  const year = Number(recruiting?.classYear ?? 0);
  return isUnderclassmenClassYear(year) ? year : null;
}

function toPercent(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value)) return 0;
  const n = Number(value);
  return n <= 1 ? Math.round(n * 1000) / 10 : Math.round(n * 10) / 10;
}

function synthesizeMovementHistory(
  ufConfidence: number,
  trendDelta7d: number
): Array<{ date: string; confidence: number }> {
  const now = Date.now();
  const points: Array<{ date: string; confidence: number }> = [];
  for (let i = 6; i >= 0; i -= 1) {
    const t = i / 6;
    const confidence = Math.round((ufConfidence - trendDelta7d * 100 * t) * 10) / 10;
    points.push({
      date: new Date(now - i * 86_400_000).toISOString().slice(0, 10),
      confidence: Math.max(0, Math.min(100, confidence)),
    });
  }
  return points;
}

function buildEarlySignals(
  intelUuid: string,
  player: FutureCastBoardPlayer,
  tier: 'target' | 'watchlist',
  entry?: EarlyWatchEntry
): UnderclassmenEarlySignal[] {
  const now = new Date().toISOString();
  const signals: UnderclassmenEarlySignal[] = [];

  const discoveryScore = entry?.discoveryScore ?? null;
  if (discoveryScore != null) {
    signals.push({
      id: `${intelUuid}-discovery`,
      playerId: intelUuid,
      signalType: 'EVALUATION_NOTE',
      signalValue: {
        note: 'Early discovery score on FutureCast underclassmen watchlist',
        discoveryScore,
        tier: player.priority,
      },
      createdAt: now,
    });
  }

  if (tier === 'target' || entry?.tier === 'target') {
    signals.push({
      id: `${intelUuid}-staff-flag`,
      playerId: intelUuid,
      signalType: 'STAFF_FLAG',
      signalValue: {
        note: 'Listed on FutureCast early target board',
        classYear: player.classYear,
      },
      createdAt: now,
    });
  }

  const movement = player.earlyMovement ?? player.trendDelta7d ?? entry?.earlyMovement ?? 0;
  if (Math.abs(movement) >= 0.02) {
    signals.push({
      id: `${intelUuid}-momentum`,
      playerId: intelUuid,
      signalType: 'SOCIAL_MOMENTUM',
      signalValue: {
        direction: movement > 0 ? 'up' : 'down',
        delta7d: movement,
        ufConfidence: player.ufConfidence,
      },
      createdAt: now,
    });
  }

  for (const school of player.competingSchools ?? entry?.competingSchools ?? []) {
    if (!school?.name) continue;
    signals.push({
      id: `${intelUuid}-compete-${school.name.toLowerCase().replace(/\s+/g, '-')}`,
      playerId: intelUuid,
      signalType: 'OFFER',
      signalValue: {
        school: school.name,
        interestPct: school.pct,
        source: 'early-watchlist',
      },
      createdAt: now,
    });
  }

  return signals;
}

function buildFutureCastPicks(
  intelUuid: string,
  player: FutureCastBoardPlayer
): UnderclassmenFutureCastPick[] {
  const now = new Date().toISOString();
  const picks: UnderclassmenFutureCastPick[] = [];

  const floridaPct = player.ufConfidence;
  if (floridaPct > 0) {
    picks.push({
      id: `${intelUuid}-pick-florida`,
      school: 'Florida',
      confidence: floridaPct,
      delta: player.trendDelta7d != null ? Math.round(player.trendDelta7d * 1000) / 10 : undefined,
      sourceType: 'MODEL',
      predictorId: 'system',
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    });
  }

  for (const predictor of player.predictors ?? []) {
    if (!predictor?.name || /florida|gators/i.test(predictor.name)) continue;
    picks.push({
      id: `${intelUuid}-pick-${predictor.name.toLowerCase().replace(/\s+/g, '-')}`,
      school: predictor.name,
      confidence: predictor.score,
      sourceType: 'BLENDED',
      predictorId: 'rivals-compete',
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    });
  }

  return picks.sort((a, b) => b.confidence - a.confidence);
}

function resolvePriority(ufConfidence: number, fitScore: number): 'high' | 'medium' | 'low' {
  const score = ufConfidence * 0.6 + fitScore * 0.4;
  if (score >= 55 || ufConfidence >= 60) return 'high';
  if (score >= 35 || ufConfidence >= 40) return 'medium';
  return 'low';
}

function buildSeedBoardPlayer(
  slug: string,
  classYear: number,
  entry?: EarlyWatchEntry
): FutureCastBoardPlayer | null {
  if (!entry?.slug && !entry?.name) return null;
  const ufConfidence = toPercent(entry?.ufProbability);
  const fitScore = Math.round(Number(entry?.fitScore ?? entry?.rating ?? 0));
  const trendDelta7d = Number(entry?.earlyMovement ?? 0);
  const competingSchools = entry?.competingSchools ?? [];
  return {
    id: intelUuidForSlug(slug),
    slug,
    name: String(entry?.name || slug),
    classYear,
    position: String(entry?.pos || entry?.position || 'ATH').toUpperCase(),
    school: (entry as { school?: string }).school ?? null,
    hometown: null,
    state: (entry as { state?: string }).state ?? null,
    composite: Math.round(Number(entry?.rating ?? 0) * 100) / 100,
    stars: Number((entry as { stars?: number }).stars ?? 0) || 0,
    natlRank: null,
    posRank: null,
    stateRank: null,
    ufConfidence,
    fitScore,
    trendDelta7d,
    volatility7d: Math.round(Math.abs(trendDelta7d) * 100) / 100,
    priority: resolvePriority(ufConfidence, fitScore),
    committedTo: null,
    predictors: competingSchools.map((s) => ({ name: s.name, score: s.pct })),
    competingSchools,
  };
}

async function buildSeedBoardPlayerFromRecruiting(
  slug: string,
  classYear: number,
  entry?: EarlyWatchEntry
): Promise<FutureCastBoardPlayer | null> {
  const fromWatch = buildSeedBoardPlayer(slug, classYear, entry);
  if (fromWatch) return fromWatch;

  const recruiting = await getRecruitingPlayerBySlug(slug);
  if (!recruiting) return null;

  const ufConfidence = toPercent(entry?.ufProbability);
  const fitScore = Math.round(Number(entry?.fitScore ?? recruiting.rating ?? 0));
  const trendDelta7d = Number(entry?.earlyMovement ?? 0);
  const competingSchools = entry?.competingSchools ?? [];
  return {
    id: intelUuidForSlug(slug),
    slug,
    name: String(recruiting.name || slug),
    classYear,
    position: String(recruiting.position || 'ATH').toUpperCase(),
    school: recruiting.highSchool ?? null,
    hometown: recruiting.hometown ?? null,
    state: recruiting.state ?? null,
    composite: Math.round(Number(recruiting.rating ?? 0) * 100) / 100,
    stars: Number(recruiting.stars ?? 0) || 0,
    natlRank: recruiting.natlRank ?? null,
    posRank: recruiting.posRank ?? null,
    stateRank: recruiting.stateRank ?? null,
    ufConfidence: ufConfidence || fitScore * 0.4,
    fitScore,
    trendDelta7d,
    volatility7d: Math.round(Math.abs(trendDelta7d) * 100) / 100,
    priority: resolvePriority(ufConfidence || fitScore * 0.4, fitScore),
    committedTo: recruiting.committedTo ?? null,
    predictors: competingSchools.map((s) => ({ name: s.name, score: s.pct })),
    competingSchools,
  };
}

async function loadEnrichedBoardPlayers(
  classYear: number,
  slugs: string[]
): Promise<FutureCastBoardPlayer[]> {
  try {
    return await loadBoardPlayersForSlugs(classYear, slugs);
  } catch (err) {
    console.warn(
      '[underclassmen-intel] board enrichment unavailable, using seed fallback:',
      err instanceof Error ? err.message : err
    );
    const rows = await Promise.all(
      slugs.map(async (slug) => buildSeedBoardPlayerFromRecruiting(slug, classYear, earlyMetaForSlug(slug)))
    );
    return rows.filter((p): p is FutureCastBoardPlayer => p != null);
  }
}

function buildRelatedIntel(
  slug: string,
  classYear: number,
  position: string,
  peers: FutureCastBoardPlayer[]
): UnderclassmenRelatedIntel[] {
  const key = slug.toLowerCase();
  return peers
    .filter((p) => p.slug !== key && p.classYear === classYear)
    .sort((a, b) => {
      const posMatch = (p: FutureCastBoardPlayer) =>
        p.position === position ? 1 : 0;
      return posMatch(b) - posMatch(a) || b.ufConfidence - a.ufConfidence;
    })
    .slice(0, 6)
    .map((p) => ({
      id: intelUuidForSlug(p.slug),
      slug: p.slug,
      fullName: p.name,
      classYear: p.classYear,
      position: p.position,
      ufConfidence: p.ufConfidence,
      fitScore: p.fitScore,
    }));
}

export async function buildUnderclassmenIntelForSlug(
  slug: string
): Promise<UnderclassmenIntelBundle | null> {
  const normalized = String(slug || '').trim().toLowerCase();
  if (!normalized) return null;

  const entry = earlyMetaForSlug(normalized);
  const classYear = await resolveClassYear(normalized, entry);
  if (!classYear) return null;

  const { ALLOWLIST_2028 } = require('./recruiting-target-allowlist');
  let peerSlugs: string[] = [];

  if (classYear === 2028) {
    peerSlugs = (ALLOWLIST_2028 as string[]).map((s) => String(s).toLowerCase());
  } else {
    peerSlugs = loadEarlyWatchEntries()
      .filter((e) => Number(e.classYear) === classYear && e.slug)
      .map((e) => String(e.slug).toLowerCase());
  }

  const slugSet = new Set([normalized, ...peerSlugs]);
  let enriched = await loadEnrichedBoardPlayers(classYear, [...slugSet]);
  let player = enriched.find((p) => p.slug === normalized);
  if (!player) {
    player = (await buildSeedBoardPlayerFromRecruiting(normalized, classYear, entry)) ?? undefined;
    if (player) enriched = [...enriched, player];
  }
  if (!player) return null;

  const intelUuid = intelUuidForSlug(normalized);
  const tier: 'target' | 'watchlist' =
    classYear === 2030 || entry?.tier === 'watchlist' ? 'watchlist' : 'target';
  const trendDelta7d = player.trendDelta7d ?? entry?.earlyMovement ?? 0;
  const ufConfidence = player.ufConfidence;
  const movementHistory = synthesizeMovementHistory(ufConfidence, trendDelta7d);

  const earlyIntel: UnderclassmenEarlyIntel = {
    slug: normalized,
    name: player.name,
    classYear,
    position: player.position,
    tier,
    ufProbability: toPercent(entry?.ufProbability ?? ufConfidence / 100),
    fitScore: player.fitScore,
    discoveryScore: entry?.discoveryScore ?? null,
    volatilityScore: player.volatility7d,
    priority: player.priority,
    committedTo: player.committedTo ?? null,
    competingSchools: player.competingSchools ?? entry?.competingSchools ?? [],
  };

  const earlyMovement: UnderclassmenEarlyMovement = {
    trendDelta7d,
    volatility7d: player.volatility7d,
    movementWindow: {
      ufProbNow: ufConfidence,
      ufProb7dAgo: Math.max(0, ufConfidence - trendDelta7d * 100),
      delta7d: trendDelta7d * 100,
      volatilityScore: player.volatility7d,
      windowDays: 7,
    },
    movementHistory,
  };

  return {
    intelUuid,
    slug: normalized,
    classYear,
    earlyIntel,
    earlySignals: buildEarlySignals(intelUuid, player, tier, entry),
    earlyMovement,
    earlyFutureCastPicks: buildFutureCastPicks(intelUuid, player),
    relatedIntel: buildRelatedIntel(normalized, classYear, player.position, enriched),
    updatedAt: new Date().toISOString(),
  };
}
