/**
 * Per-player underclassmen intel (2028–2030) — early watchlist + board enrichment.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { loadBoardPlayersForSlugs, UNDERCLASSMEN_MOVEMENT_WINDOW_DAYS, type FutureCastBoardPlayer } from '../api/futurecast/allowlist-board';
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
  ufProbability: number | null;
  fitScore: number | null;
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
  trendDelta7d: number | null;
  volatility7d: number;
  movementWindow: {
    ufProbNow: number | null;
    ufProb7dAgo: number | null;
    delta7d: number | null;
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
  ufConfidence: number | null;
  fitScore: number | null;
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

  const movement = player.trendDelta7d;
  if (movement != null && Math.abs(movement) >= 0.02) {
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

  for (const school of player.competingSchools ?? []) {
    if (!school?.name) continue;
    signals.push({
      id: `${intelUuid}-compete-${school.name.toLowerCase().replace(/\s+/g, '-')}`,
      playerId: intelUuid,
      signalType: 'OFFER',
      signalValue: {
        school: school.name,
        interestPct: school.pct,
        source: 'futurecast-compete',
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
  if (floridaPct != null && floridaPct > 0) {
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

function loadTargetBoardEntry(slug: string, classYear: number): Record<string, unknown> | null {
  const boardPath = path.join(__dirname, `../data/recruiting/${classYear}-target-board.json`);
  try {
    const board = JSON.parse(fs.readFileSync(boardPath, 'utf8')) as {
      targets?: Array<Record<string, unknown>>;
    };
    return (
      board.targets?.find((t) => String(t.slug || '').toLowerCase() === slug.toLowerCase()) ?? null
    );
  } catch {
    return null;
  }
}

function buildMinimalBoardPlayer(
  slug: string,
  classYear: number,
  entry?: EarlyWatchEntry
): FutureCastBoardPlayer | null {
  const board = loadTargetBoardEntry(slug, classYear);
  if (!entry?.slug && !entry?.name && !board?.name) return null;
  const position = String(board?.pos || board?.position || '').trim().toUpperCase();
  return {
    id: intelUuidForSlug(slug),
    slug,
    name: String(board?.name || entry?.name || slug),
    classYear: Number(board?.classYear ?? entry?.classYear ?? classYear),
    position: position || 'TBD',
    school: (board?.school as string) ?? (entry as { school?: string }).school ?? null,
    hometown: null,
    state: (board?.state as string) ?? (entry as { state?: string }).state ?? null,
    composite: Math.round(Number(board?.rating ?? 0) * 100) / 100,
    stars: Number(board?.stars ?? (entry as { stars?: number }).stars ?? 0) || 0,
    natlRank: (board?.natlRank as number) ?? null,
    posRank: (board?.posRank as number) ?? null,
    stateRank: (board?.stateRank as number) ?? null,
    ufConfidence: null,
    fitScore: null,
    trendDelta7d: null,
    volatility7d: 0,
    priority: 'low',
    committedTo: (board?.committedTo as string) ?? null,
    predictors: [],
    competingSchools: [],
  };
}

async function buildSeedBoardPlayerFromRecruiting(
  slug: string,
  classYear: number,
  entry?: EarlyWatchEntry
): Promise<FutureCastBoardPlayer | null> {
  const recruiting = await getRecruitingPlayerBySlug(slug);
  const board = loadTargetBoardEntry(slug, classYear);
  if (!recruiting && !board && !entry?.name) return null;

  const position = String(
    recruiting?.position || recruiting?.pos || board?.pos || board?.position || ''
  )
    .trim()
    .toUpperCase();

  return {
    id: intelUuidForSlug(slug),
    slug,
    name: String(recruiting?.name || board?.name || entry?.name || slug),
    classYear: Number(recruiting?.classYear ?? board?.classYear ?? entry?.classYear ?? classYear),
    position: position || 'TBD',
    school: recruiting?.highSchool ?? (board?.school as string) ?? null,
    hometown: recruiting?.hometown ?? null,
    state: recruiting?.state ?? (board?.state as string) ?? null,
    composite: Math.round(Number(recruiting?.rating ?? board?.rating ?? 0) * 100) / 100,
    stars: Number(recruiting?.stars ?? board?.stars ?? 0) || 0,
    natlRank: recruiting?.natlRank ?? (board?.natlRank as number) ?? null,
    posRank: recruiting?.posRank ?? (board?.posRank as number) ?? null,
    stateRank: recruiting?.stateRank ?? (board?.stateRank as number) ?? null,
    ufConfidence: null,
    fitScore: null,
    trendDelta7d: null,
    volatility7d: 0,
    priority: 'low',
    committedTo: recruiting?.committedTo ?? (board?.committedTo as string) ?? null,
    predictors: [],
    competingSchools: [],
  };
}

async function loadEnrichedBoardPlayers(
  classYear: number,
  slugs: string[]
): Promise<FutureCastBoardPlayer[]> {
  try {
    return await loadBoardPlayersForSlugs(classYear, slugs, {
      movementWindowDays: UNDERCLASSMEN_MOVEMENT_WINDOW_DAYS,
    });
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

/** Authoritative underclassmen board rows with FutureCast metrics when available. */
export async function loadUnderclassmenBoardPlayers(
  classYear: number,
  slugs: string[]
): Promise<FutureCastBoardPlayer[]> {
  return loadEnrichedBoardPlayers(classYear, slugs);
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
      return posMatch(b) - posMatch(a) || (b.ufConfidence ?? -1) - (a.ufConfidence ?? -1);
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
  const trendDelta7d = player.trendDelta7d;
  const ufConfidence = player.ufConfidence;
  const movementHistory =
    ufConfidence != null && trendDelta7d != null
      ? synthesizeMovementHistory(ufConfidence, trendDelta7d)
      : [];

  const earlyIntel: UnderclassmenEarlyIntel = {
    slug: normalized,
    name: player.name,
    classYear: player.classYear,
    position: player.position,
    tier,
    ufProbability: ufConfidence,
    fitScore: player.fitScore,
    discoveryScore: entry?.discoveryScore ?? null,
    volatilityScore: player.volatility7d,
    priority: player.priority,
    committedTo: player.committedTo ?? null,
    competingSchools: player.competingSchools ?? [],
  };

  const earlyMovement: UnderclassmenEarlyMovement = {
    trendDelta7d,
    volatility7d: player.volatility7d,
    movementWindow:
      ufConfidence != null && trendDelta7d != null
        ? {
            ufProbNow: ufConfidence,
            ufProb7dAgo: Math.max(0, ufConfidence - trendDelta7d * 100),
            delta7d: trendDelta7d * 100,
            volatilityScore: player.volatility7d,
            windowDays: UNDERCLASSMEN_MOVEMENT_WINDOW_DAYS,
          }
        : null,
    movementHistory,
  };

  return {
    intelUuid,
    slug: normalized,
    classYear: player.classYear,
    earlyIntel,
    earlySignals: buildEarlySignals(intelUuid, player, tier, entry),
    earlyMovement,
    earlyFutureCastPicks: buildFutureCastPicks(intelUuid, player),
    relatedIntel: buildRelatedIntel(normalized, classYear, player.position, enriched),
    updatedAt: new Date().toISOString(),
  };
}
