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
  ufRpmPct?: number | null;
};

type EarlyWatchEntry = {
  slug?: string;
  name?: string;
  classYear?: number;
  tier?: string;
  pos?: string;
  position?: string;
  school?: string;
  state?: string;
  /** @deprecated Seed metrics — ignored for fan display; real board/recruiting only. */
  ufProbability?: number;
  fitScore?: number;
  discoveryScore?: number;
  earlyMovement?: number;
  competingSchools?: Array<{ name: string; pct: number }>;
  stars?: number;
  rating?: number;
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
  const recruiting = await getRecruitingPlayerBySlug(slug);
  const storeYear = Number(recruiting?.classYear ?? 0);
  if (isUnderclassmenClassYear(storeYear)) return storeYear;
  if (entry?.classYear && isUnderclassmenClassYear(Number(entry.classYear))) {
    return Number(entry.classYear);
  }
  return null;
}

function synthesizeMovementHistory(
  ufConfidence: number,
  trendDelta7d: number
): Array<{ date: string; confidence: number }> {
  const now = Date.now();
  // trendDelta7d is already percentage points (e.g. +4), never a 0–1 fraction.
  const deltaPp = Number(trendDelta7d) || 0;
  const points: Array<{ date: string; confidence: number }> = [];
  for (let i = 6; i >= 0; i -= 1) {
    const t = i / 6;
    const confidence = Math.round((ufConfidence - deltaPp * t) * 10) / 10;
    points.push({
      date: new Date(now - i * 86_400_000).toISOString().slice(0, 10),
      confidence: Math.max(0, Math.min(100, confidence)),
    });
  }
  return points;
}

function parseRecruitingUfPct(raw: unknown): number | null {
  // RPM-only reader: reject unit-interval residual leftovers (0.99 / 0.6887).
  const { sanitizeRpmPct } = require('./uf-probability-utils') as {
    sanitizeRpmPct: (v: unknown) => number | null;
  };
  return sanitizeRpmPct(raw);
}

/** Min peer % when falling back to legacy competitors (UF + 1–2 rivals). */
const LEGACY_PEER_MIN_PCT = 4;
/** When Florida RPM is this high, skip stale legacy peer crumbs (UF-only OK). */
const UF_LOCKED_SKIP_LEGACY_PCT = 90;
const LEGACY_PEER_MAX = 2;

function competitorPct(raw: unknown): number | null {
  if (raw == null || !Number.isFinite(Number(raw))) return null;
  const num = Number(raw);
  return Math.min(100, Math.max(0, Math.round((num <= 1 ? num * 100 : num) * 10) / 10));
}

function competingSchoolsFromRecruitingRecord(
  recruiting: Record<string, unknown> | null | undefined
): Array<{ name: string; pct: number }> {
  const bySchool = new Map<string, { name: string; pct: number }>();

  const add = (nameRaw: unknown, pctRaw: unknown) => {
    const school = String(nameRaw || '').trim();
    if (!school || /\bflorida\b|\bgators\b|\buf\b/i.test(school)) return;
    const pct = competitorPct(pctRaw);
    if (pct == null || pct <= 0) return;
    const key = school.toLowerCase();
    const existing = bySchool.get(key);
    if (!existing || pct > existing.pct) {
      bySchool.set(key, { name: school, pct });
    }
  };

  const competitors = (recruiting?.competitors ?? []) as Array<{
    school?: string;
    name?: string;
    score?: number;
    pct?: number;
    source?: string;
  }>;
  // Prefer confirmed On3 / live competitors. If none, allow top 1–2 meaningful legacy peers
  // (not when UF is already ~locked — that reads as a fake battle).
  const nonLegacy = competitors.filter(
    (c) => String(c?.source || '').toLowerCase() !== 'legacy'
  );
  let competitorPool = nonLegacy;
  if (!competitorPool.length) {
    const ufRpm = competitorPct(recruiting?.ufRpmPct) ?? 0;
    if (ufRpm < UF_LOCKED_SKIP_LEGACY_PCT) {
      competitorPool = [...competitors]
        .map((c) => ({
          c,
          pct: competitorPct(c?.score ?? c?.pct) ?? 0,
        }))
        .filter((row) => row.pct >= LEGACY_PEER_MIN_PCT)
        .sort((a, b) => b.pct - a.pct)
        .slice(0, LEGACY_PEER_MAX)
        .map((row) => row.c);
    }
  }
  for (const c of competitorPool) {
    add(c?.school || c?.name, c?.score ?? c?.pct);
  }

  // Confirmed On3 RPM board when present on the player row.
  try {
    const { rpmTopFromOn3TopTeams } = require('./autoposter/rewrite/comp-sourcing');
    const classYear = Number(recruiting?.classYear) || 2028;
    const topTeams = (recruiting?.on3TopTeams || recruiting?.topTeams || []) as unknown[];
    if (Array.isArray(topTeams) && topTeams.length) {
      for (const row of rpmTopFromOn3TopTeams(topTeams, classYear)) {
        add(row.school, row.pct);
      }
    }
  } catch {
    /* optional */
  }

  return [...bySchool.values()].sort((a, b) => b.pct - a.pct);
}

/** Export for high-priority / battles — On3 first, then smart legacy peer fallback. */
export { competingSchoolsFromRecruitingRecord };

function buildEarlySignals(
  intelUuid: string,
  player: FutureCastBoardPlayer,
  tier: 'target' | 'watchlist',
  entry?: EarlyWatchEntry,
  staffNote?: string | null,
  discoveryScoreOverride?: number | null,
  asOf?: string | null
): UnderclassmenEarlySignal[] {
  const stamp = asOf || null;
  const signals: UnderclassmenEarlySignal[] = [];

  const note = String(staffNote || '').trim();
  if (note) {
    signals.push({
      id: `${intelUuid}-staff-note`,
      playerId: intelUuid,
      signalType: 'EVALUATION_NOTE',
      signalValue: { note, source: 'recruiting-store' },
      createdAt: stamp as string,
    });
  }

  const discoveryScore = discoveryScoreOverride ?? entry?.discoveryScore ?? null;
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
      createdAt: stamp as string,
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
      createdAt: stamp as string,
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
      createdAt: stamp as string,
    });
  }

  // Competing On3 RPM interest is shown on the Prediction Market board — not as feed events.

  return signals;
}

function buildFutureCastPicks(
  intelUuid: string,
  player: FutureCastBoardPlayer
): UnderclassmenFutureCastPick[] {
  const now = new Date().toISOString();
  const picks: UnderclassmenFutureCastPick[] = [];

  const floridaPct =
    player.ufConfidence != null && player.ufConfidence > 0
      ? player.ufConfidence
      : player.ufRpmPct != null && player.ufRpmPct > 0
        ? player.ufRpmPct
        : null;
  if (floridaPct != null && floridaPct > 0) {
    const fromRpm = !(player.ufConfidence != null && player.ufConfidence > 0);
    picks.push({
      id: `${intelUuid}-pick-florida`,
      school: 'Florida',
      confidence: Math.round(floridaPct),
      delta: player.trendDelta7d != null ? Math.round(player.trendDelta7d) : undefined,
      sourceType: fromRpm ? 'BLENDED' : 'MODEL',
      predictorId: fromRpm ? 'on3-rpm' : 'gatorvault',
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    });
  }

  for (const school of player.competingSchools ?? []) {
    if (!school?.name || /florida|gators/i.test(school.name)) continue;
    const pct = Number(school.pct);
    if (!Number.isFinite(pct) || pct <= 0) continue;
    picks.push({
      id: `${intelUuid}-pick-${school.name.toLowerCase().replace(/\s+/g, '-')}`,
      school: school.name,
      confidence: Math.round(pct),
      sourceType: 'BLENDED',
      predictorId: 'on3-rpm',
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    });
  }

  for (const predictor of player.predictors ?? []) {
    if (!predictor?.name || /florida|gators|on3|rpm|allowlist/i.test(predictor.name)) continue;
    if (picks.some((p) => p.school.toLowerCase() === predictor.name.toLowerCase())) continue;
    picks.push({
      id: `${intelUuid}-pick-${predictor.name.toLowerCase().replace(/\s+/g, '-')}`,
      school: predictor.name,
      confidence: Math.round(predictor.score),
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
  const position = String(
    entry?.pos ||
      entry?.position ||
      board?.pos ||
      board?.position ||
      ''
  ).trim().toUpperCase();
  return {
    id: intelUuidForSlug(slug),
    slug,
    name: String(board?.name || entry?.name || slug),
    classYear: Number(board?.classYear ?? entry?.classYear ?? classYear),
    position: position || 'TBD',
    school: (board?.school as string) ?? entry?.school ?? null,
    hometown: null,
    state: (board?.state as string) ?? entry?.state ?? null,
    composite: Math.round(Number(board?.rating ?? 0) * 100) / 100,
    // Never trust seed-file stars — only target-board / recruiting ratings.
    stars: Number(board?.stars ?? 0) || 0,
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
    recruiting?.position ||
      recruiting?.pos ||
      entry?.pos ||
      entry?.position ||
      board?.pos ||
      board?.position ||
      ''
  )
    .trim()
    .toUpperCase();

  const recruitingRecord = recruiting as Record<string, unknown> | null | undefined;
  const competingSchools = competingSchoolsFromRecruitingRecord(recruitingRecord);
  const rpmPct = parseRecruitingUfPct(recruiting?.ufRpmPct);
  const storePct = parseRecruitingUfPct(recruiting?.ufProbability);
  const fitScore =
    recruiting?.fitScore != null && Number(recruiting.fitScore) > 0
      ? Number(recruiting.fitScore)
      : null;
  const { resolveGatorVaultLikelihood } = require('./uf-probability-utils');
  const resolved = resolveGatorVaultLikelihood({
    modelPct: 0,
    rpmPct: rpmPct ?? 0,
    rivalsPct: 0,
    fitScore: fitScore ?? 0,
    storePct: storePct ?? 0,
    delta7d: 0,
    stars: Number(recruiting?.stars ?? board?.stars ?? 0) || null,
    headliner: false,
  });
  const ufConfidence = resolved.value > 0 ? resolved.value : null;
  const category = String(recruiting?.category || '').toLowerCase();

  return {
    id: intelUuidForSlug(slug),
    slug,
    name: String(recruiting?.name || board?.name || entry?.name || slug),
    classYear: Number(recruiting?.classYear ?? board?.classYear ?? entry?.classYear ?? classYear),
    position: position || 'TBD',
    school: recruiting?.highSchool ?? (board?.school as string) ?? entry?.school ?? null,
    hometown: recruiting?.hometown ?? null,
    state: recruiting?.state ?? (board?.state as string) ?? entry?.state ?? null,
    composite: Math.round(Number(recruiting?.rating ?? board?.rating ?? 0) * 100) / 100,
    stars: Number(recruiting?.stars ?? board?.stars ?? 0) || 0,
    natlRank: recruiting?.natlRank ?? (board?.natlRank as number) ?? null,
    posRank: recruiting?.posRank ?? (board?.posRank as number) ?? null,
    stateRank: recruiting?.stateRank ?? (board?.stateRank as number) ?? null,
    ufConfidence,
    ufProbabilitySource: resolved.source,
    ufProbabilityLabel: resolved.label ?? null,
    ufProbabilityLowConfidence: Boolean(resolved.lowConfidence),
    ufRpmPct: rpmPct,
    fitScore,
    trendDelta7d: null,
    volatility7d: 0,
    priority: category === 'target' || entry?.tier === 'target' ? 'high' : 'low',
    committedTo: recruiting?.committedTo ?? (board?.committedTo as string) ?? null,
    predictors: [],
    competingSchools,
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
  const rows = await loadEnrichedBoardPlayers(classYear, slugs);
  // Overlay On3 competitor boards + RPM market % — do not replace GV likelihood with RPM.
  // Batch slug lookup (was N+1 getRecruitingPlayerBySlug → multi-minute Discovery boards).
  const store = require('./recruiting-store') as {
    getPlayersBySlugs?: (slugs: string[]) => Promise<Map<string, Record<string, unknown>>>;
  };
  const slugList = rows.map((p) => p.slug).filter(Boolean);
  let recruitingBySlug = new Map<string, Awaited<ReturnType<typeof getRecruitingPlayerBySlug>>>();
  if (typeof store.getPlayersBySlugs === 'function' && slugList.length) {
    try {
      recruitingBySlug = (await store.getPlayersBySlugs(slugList)) as typeof recruitingBySlug;
    } catch (err) {
      console.warn(
        '[underclassmen-intel] batch recruiting overlay failed:',
        err instanceof Error ? err.message : err
      );
    }
  }
  return rows.map((player) => {
    const recruiting =
      recruitingBySlug.get(String(player.slug || '').toLowerCase()) ?? null;
    return enrichPlayerFromRecruitingStore(player, recruiting as never, earlyMetaForSlug(player.slug));
  });
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

function enrichPlayerFromRecruitingStore(
  player: FutureCastBoardPlayer,
  recruiting: Awaited<ReturnType<typeof getRecruitingPlayerBySlug>>,
  entry?: EarlyWatchEntry
): FutureCastBoardPlayer {
  const recruitingRecord = recruiting as Record<string, unknown> | null | undefined;
  const storeCompete = competingSchoolsFromRecruitingRecord(recruitingRecord);
  const ufRpmPct =
    parseRecruitingUfPct(recruiting?.ufRpmPct) ?? player.ufRpmPct ?? null;
  const storeFit =
    recruiting?.fitScore != null && Number(recruiting.fitScore) > 0
      ? Number(recruiting.fitScore)
      : null;

  // Prefer confirmed On3 competitor RPM over rivals/model filler boards.
  const competingSchools = storeCompete.length
    ? storeCompete
    : player.competingSchools ?? [];

  return {
    ...player,
    // Keep GatorVault likelihood from board blend — RPM is market layer only.
    ufConfidence: player.ufConfidence,
    ufRpmPct,
    fitScore: player.fitScore ?? storeFit,
    competingSchools,
    predictors: player.predictors ?? [],
    priority:
      player.priority !== 'low' || String(recruiting?.category || '').toLowerCase() === 'target'
        ? player.priority === 'low' && String(recruiting?.category || '').toLowerCase() === 'target'
          ? 'high'
          : player.priority
        : player.priority,
  };
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

  const recruiting = await getRecruitingPlayerBySlug(normalized);
  player = enrichPlayerFromRecruitingStore(player, recruiting, entry);
  const intelUuid = intelUuidForSlug(normalized);
  const tier: 'target' | 'watchlist' =
    classYear === 2030 || entry?.tier === 'watchlist' ? 'watchlist' : 'target';
  const trendDelta7d = player.trendDelta7d;
  const ufConfidence = player.ufConfidence;

  let discoveryScore: number | null = entry?.discoveryScore ?? null;
  if (classYear === 2028) {
    const { loadDiscoveryEnrichmentBySlug } = require('./underclassmen-discovery-enrich') as {
      loadDiscoveryEnrichmentBySlug: (year: number) => Promise<Map<string, { discoveryScore?: number }>>;
    };
    discoveryScore =
      (await loadDiscoveryEnrichmentBySlug(2028)).get(normalized)?.discoveryScore ?? discoveryScore;
  }

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
    discoveryScore,
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
            // trendDelta7d is percentage points already — do not *100 (that invented +72 theater).
            ufProb7dAgo: Math.max(0, ufConfidence - trendDelta7d),
            delta7d: trendDelta7d,
            volatilityScore: player.volatility7d,
            windowDays: UNDERCLASSMEN_MOVEMENT_WINDOW_DAYS,
          }
        : null,
    movementHistory,
  };

  const asOf =
    String((recruiting as { updatedAt?: string } | null)?.updatedAt || '').trim() || null;

  return {
    intelUuid,
    slug: normalized,
    classYear: player.classYear,
    earlyIntel,
    earlySignals: buildEarlySignals(
      intelUuid,
      player,
      tier,
      entry,
      recruiting?.profileNote ?? recruiting?.skinny ?? null,
      discoveryScore,
      asOf
    ),
    earlyMovement,
    earlyFutureCastPicks: buildFutureCastPicks(intelUuid, player),
    relatedIntel: buildRelatedIntel(normalized, classYear, player.position, enriched),
    updatedAt: new Date().toISOString(),
    ufRpmPct: player.ufRpmPct ?? null,
  };
}
