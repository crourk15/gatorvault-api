/**
 * GET /api/futurecast/high-priority?year=2027 — UF priority target board.
 * Response metric types: server/types/futurecast-elite-api.ts
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Request, Response } from 'express';
import {
  listMovementHistoryByPlayerIds,
  listPredictions,
  listRollingMovement,
  ROLLING_MOVEMENT_WINDOW_DAYS,
  VOLATILITY_WINDOW_DAYS,
} from '../../models/predictions';
import { listCompetingVolatilityBoosts } from '../../models/competing-school-history';
import { loadRecruitingRankings } from '../../lib/load-recruiting-rankings';
import {
  asyncHandler,
  handlePredictionsApiError,
  PREDICTOR_NAMES,
  serializeFeedRowsWithVolatility,
} from '../predictions/utils-api';
import {
  dedupeFeedRows,
  filterFutureCastFeedRows,
  filterModelPredictionsOnly,
  FUTURECAST_CLASS_YEAR,
} from './feed-filters';
import {
  sendCachedJson,
  highPriorityCacheKey,
  loadHighPriorityCached,
  primeFuturecastCache,
  sanitizeHighPriorityStarsPayload,
  writeHighPriorityRuntime,
} from './response-cache';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { filterBlockedRecruits } = require('../../lib/recruiting-blocked-players');
const { isActiveUfTarget } = require('../../lib/recruiting-target-filters');
const { buildVerifiedVisitIntelRows, applyVerifiedVisitFields, buildVerifiedVisitRecapRows, getVisitIntelBoardSnapshot } = require('../../lib/visit-intel-utils');
const { mergeExpectedVisitHistory } = require('../../lib/game-week-visitors');
const { resolveUfProbability, resolveGatorVaultLikelihood, resolveUncommittedMarketRpm, loadUfPctPredictorsBySlug, sanitizeRpmPct, sanitizeStoreOddsPct, pickRivalsPmScore } = require('../../lib/uf-probability-utils');
const { buildFlipWatchRows } = require('../../lib/flip-watch-utils');
const intelStore = require('../../lib/recruiting-intel-store');
const {
  ALLOWLIST_2027,
  ALLOWLIST_2028,
  FLIP_WATCH_2027,
  FLIP_WATCH_COMMITS_2027,
  CANONICAL_TARGET_NAMES,
} = require('../../lib/recruiting-target-allowlist');
const { loadUnderclassmenBoardPlayers } = require('../../lib/underclassmen-intel');
const RECRUITING_PLAYERS_PATH = path.join(__dirname, '../../data/recruiting/players.json');
const TARGET_BOARD_SEED_PATH = path.join(__dirname, '../../data/recruiting/2027-target-board.json');

/**
 * Sync Closing Class HP soft plate — Tier B GET must never return empty deferred_rebuild
 * for 2027. Lab Top UF Targets / Flip Watch stay API-live (no Codemagic) from allowlist +
 * 2027-target-board.json; full odds/visits refill via warm/cron.
 */
export function softClosingClassHighPriorityFromSeed(classYear = FUTURECAST_CLASS_YEAR) {
  const year = Number(classYear) || FUTURECAST_CLASS_YEAR;
  const recruitingBySlug = loadRecruitingBySlug();
  const targetSeedBySlug = loadTargetSeedBySlug();
  const allowSlugs = (ALLOWLIST_2027 as string[]).map((s) => String(s).toLowerCase());

  const seedRows: TargetBoardEntry[] = [];
  for (const slug of allowSlugs) {
    const seed = targetSeedBySlug.get(slug);
    const recruiting = recruitingBySlug.get(slug);
    const name =
      seed?.name ||
      recruiting?.name ||
      (CANONICAL_TARGET_NAMES as Record<string, string>)[slug] ||
      slug;
    seedRows.push({
      slug,
      name,
      pos: recruiting?.pos || seed?.pos || undefined,
      school: recruiting?.school || seed?.school || undefined,
      htWt: recruiting?.htWt || seed?.htWt || undefined,
      stars: recruiting?.stars ?? seed?.stars ?? undefined,
      rating: recruiting?.rating ?? seed?.rating ?? undefined,
      natlRank: recruiting?.natlRank ?? seed?.natlRank ?? undefined,
      posRank: recruiting?.posRank ?? seed?.posRank ?? undefined,
      stateRank: recruiting?.stateRank ?? seed?.stateRank ?? undefined,
      headliner: Boolean(seed?.headliner || recruiting?.headliner),
      committedTo: resolveCommittedTo(
        { slug, name, committedTo: seed?.committedTo ?? null },
        recruiting,
        seed
      ),
      skinny: seed?.skinny || recruiting?.skinny || undefined,
      ufProbability: recruiting?.ufProbability ?? seed?.ufProbability,
      classYear: year,
    });
  }

  const openHunts = filterBlockedRecruits(seedRows).filter((t: TargetBoardEntry) =>
    isActiveUfTarget(t)
  );

  const players: HighPriorityPlayer[] = openHunts.map((target) => {
    const recruiting = recruitingBySlug.get(target.slug);
    const competingSchools = (() => {
      try {
        const { competingSchoolsFromRecruitingRecord } = require('../../lib/underclassmen-intel');
        return competingSchoolsFromRecruitingRecord(
          recruiting as Record<string, unknown> | null | undefined
        );
      } catch {
        return [] as Array<{ name: string; pct: number }>;
      }
    })();
    const storeRpm = resolveUfRpmPctForRecruiting(
      recruiting as Record<string, unknown> | null | undefined,
      target.slug,
      competingSchools
    );
    const resolvedUf =
      year >= 2028
        ? resolveGatorVaultLikelihood({
            modelPct: 0,
            rpmPct: storeRpm ?? 0,
            rivalsPct: 0,
            fitScore:
              recruiting?.fitScore != null && Number(recruiting.fitScore) > 0
                ? Number(recruiting.fitScore)
                : 0,
            storePct: firstPositiveStorePct(target.ufProbability, recruiting?.ufProbability) ?? 0,
            delta7d: 0,
            stars: target.stars ?? null,
            headliner: Boolean(target.headliner),
          })
        : resolveUfProbability({
            modelPct: null,
            storePct: firstPositiveStorePct(target.ufProbability, storeRpm, recruiting?.ufProbability),
            predictors: [],
            stars: target.stars ?? null,
            headliner: Boolean(target.headliner),
          });
    const fitScore =
      recruiting?.fitScore != null && Number(recruiting.fitScore) > 0
        ? Math.round(Number(recruiting.fitScore))
        : 0;
    return {
      id: target.slug,
      slug: target.slug,
      name: target.name,
      classYear: year,
      position: target.pos ?? recruiting?.pos ?? '—',
      school: target.school ?? recruiting?.school ?? null,
      htWt: target.htWt ?? null,
      stars: (() => {
        const n = Number(target.stars ?? 0);
        return Number.isFinite(n) && n >= 1 ? Math.round(n) : null;
      })(),
      headliner: Boolean(target.headliner),
      committedTo: target.committedTo ?? null,
      compositeScore: Number(target.rating ?? recruiting?.rating ?? 0) || 0,
      nationalRank: target.natlRank ?? recruiting?.natlRank ?? null,
      positionRank: target.posRank ?? recruiting?.posRank ?? null,
      stateRank: target.stateRank ?? recruiting?.stateRank ?? null,
      rating: Number(target.rating ?? recruiting?.rating ?? 0) || 0,
      natlRank: target.natlRank ?? recruiting?.natlRank ?? null,
      posRank: target.posRank ?? recruiting?.posRank ?? null,
      ufProbability: resolvedUf.value,
      ufProbabilitySource: resolvedUf.source,
      ufProbabilityLabel: resolvedUf.label,
      ufProbabilityLowConfidence: resolvedUf.lowConfidence,
      movementDelta: 0,
      delta7d: 0,
      fitScore,
      staffConfidence: 0,
      priorityScore: Math.max(40, fitScore || 50),
      insiderNotes: null,
      notePreview: null,
      skinny: target.skinny ?? null,
      visitHistory: [],
      ufOvStatus: null,
      visitStart: null,
      visitEnd: null,
      trendHistory: [],
      predictors: storeRpm != null ? [{ name: 'On3 RPM', score: storeRpm }] : [],
      competingSchools,
      ufRpmPct: storeRpm,
    } as HighPriorityPlayer;
  });

  const flipPool = seedRows.map((p) => ({
    slug: p.slug,
    name: p.name,
    pos: p.pos,
    position: p.pos,
    stars: p.stars,
    committedTo: p.committedTo,
  }));
  const commitBySlug = new Map<string, string>();
  for (const [slug, school] of Object.entries(FLIP_WATCH_COMMITS_2027 || {})) {
    if (school) commitBySlug.set(String(slug).toLowerCase(), String(school));
  }
  for (const row of seedRows) {
    if (row.committedTo) commitBySlug.set(row.slug.toLowerCase(), row.committedTo);
  }
  const flipWatch = buildFlipWatchRows(flipPool, [], {
    curatedSlugs: FLIP_WATCH_2027,
    commitDefaults: FLIP_WATCH_COMMITS_2027,
    displayNames: CANONICAL_TARGET_NAMES,
    commitBySlug,
    limit: FLIP_WATCH_2027.length,
  });

  const lastUpdated = new Date().toISOString();
  return sanitizeHighPriorityStarsPayload({
    ok: true,
    classYear: year,
    count: players.length,
    visitIntelCount: 0,
    visitRecapCount: 0,
    flipWatchCount: flipWatch.length,
    visitBoardSnapshot: { upcomingCount: 0, recapCount: 0 },
    updatedAt: lastUpdated,
    lastUpdated,
    players,
    visitIntel: [],
    visitRecap: [],
    flipWatch,
    movementNarratives: [],
    degraded: 'closing_seed',
  });
}

/** Underclassmen years served by the high-priority endpoint (2027 uses legacy board pipeline). */
export const HIGH_PRIORITY_UNDERCLASSMEN_YEARS = [2028] as const;
/**
 * Chase UI hint (Priority chase / hero still sort by priorityScore and slice client-side).
 * Discovery 2028 HP payload returns the full allowlist — Closest to commit must not be
 * gated by a chase-hot cut (e.g. Hudson West leading SMU but outside top-18 heat).
 */
export const HIGH_PRIORITY_UNDERCLASSMEN_CHASE_LIMIT = 18;
/** @deprecated Use HIGH_PRIORITY_UNDERCLASSMEN_CHASE_LIMIT — kept for older imports/tests. */
export const HIGH_PRIORITY_UNDERCLASSMEN_LIMIT = HIGH_PRIORITY_UNDERCLASSMEN_CHASE_LIMIT;

export type VisitBadgeType = 'OV' | 'UV' | 'Game Day' | 'Junior Day' | 'Spring Visit';

export interface VisitBadge {
  type: VisitBadgeType;
  label: string;
}

export interface HighPriorityPredictor {
  name: string;
  score: number;
}

export interface HighPriorityPlayer {
  id: string;
  slug: string;
  name: string;
  classYear?: number | null;
  position: string;
  school: string | null;
  htWt: string | null;
  stars: number | null;
  headliner: boolean;
  committedTo: string | null;
  compositeScore: number;
  nationalRank: number | null;
  positionRank: number | null;
  stateRank: number | null;
  rating: number | null;
  natlRank: number | null;
  posRank: number | null;
  ufProbability: number;
  ufProbabilitySource?: string;
  ufProbabilityLabel?: string | null;
  ufProbabilityLowConfidence?: boolean;
  movementDelta: number;
  delta7d: number;
  fitScore: number;
  staffConfidence: number;
  priorityScore: number;
  insiderNotes: string | null;
  notePreview: string | null;
  skinny: string | null;
  visitHistory: VisitBadge[];
  ufOvStatus: string | null;
  visitStart: string | null;
  visitEnd: string | null;
  visitVerified?: boolean;
  visitSource?: string | null;
  visitSourceLabel?: string | null;
  trendHistory: Array<{ date: string; confidence: number }>;
  predictors: HighPriorityPredictor[];
  /** Confirmed On3 / store RPM competitors only — never filler. */
  competingSchools?: Array<{ name: string; pct: number }>;
  /** Confirmed On3 UF RPM % when available (preferred over model for battle RPM bar). */
  ufRpmPct?: number | null;
  /** Structured UF process — Closest to commit must not be On3 % alone. */
  hasUFOffer?: boolean;
  closestCommitEligible?: boolean;
  processEvidence?: {
    allowlisted?: boolean;
    hasUFOffer?: boolean;
    flOfferCount?: number;
    floridaVisits?: number;
    ov?: number;
    uv?: number;
    home?: number;
    intel90?: number;
    pursuitHits?: number;
    scheduledOv?: boolean;
    recentVisit?: boolean;
    hasProcess?: boolean;
    stillWarm?: boolean;
    closestEligible?: boolean;
    reasons?: string[];
  } | null;
}

interface TargetBoardEntry {
  slug: string;
  name: string;
  pos?: string;
  school?: string;
  htWt?: string;
  stars?: number;
  rating?: number;
  natlRank?: number;
  posRank?: number;
  stateRank?: number;
  headliner?: boolean;
  committedTo?: string | null;
  skinny?: string;
  ufOvStatus?: string | null;
  visitStart?: string | null;
  visitEnd?: string | null;
  ufProbability?: number;
}

interface RecruitingPlayerRow {
  id?: string;
  slug?: string;
  name?: string;
  pos?: string;
  school?: string;
  profileNote?: string;
  ufOvStatus?: string | null;
  visitStart?: string | null;
  visitEnd?: string | null;
  ufProbability?: number | null;
  futurecastProbability?: number | null;
}

interface WarRoomBreakdown {
  playerSlug: string;
  insiderNotes?: string | null;
  staffNotes?: string | null;
  projection?: string | null;
  recruitingStory?: string | null;
}

function parseYear(raw: unknown): number {
  const n = parseInt(String(raw ?? ''), 10);
  return Number.isFinite(n) ? n : FUTURECAST_CLASS_YEAR;
}

function notePreview(text: string | null | undefined, max = 120): string | null {
  if (!text?.trim()) return null;
  const t = text.trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

function buildVisitHistory(
  target: TargetBoardEntry,
  recruiting: RecruitingPlayerRow | undefined
): VisitBadge[] {
  const visits: VisitBadge[] = [];
  const seen = new Set<string>();
  const ovStatus = String(target.ufOvStatus || recruiting?.ufOvStatus || '').toLowerCase();

  const add = (type: VisitBadgeType, label: string) => {
    if (seen.has(type)) return;
    seen.add(type);
    visits.push({ type, label });
  };

  if (ovStatus.includes('scheduled') || target.visitStart || recruiting?.visitStart) {
    add('OV', 'OV');
  }

  const text = `${target.skinny ?? ''} ${recruiting?.profileNote ?? ''}`.toLowerCase();
  if (/unofficial visit|\buv\b/.test(text)) add('UV', 'UV');
  if (/junior day/.test(text)) add('Junior Day', 'Junior Day');
  if (/spring visit/.test(text)) add('Spring Visit', 'Spring Visit');
  if (/game day|gameday/.test(text)) add('Game Day', 'Game Day');

  return visits;
}

async function loadTargetBoardFromStore(): Promise<TargetBoardEntry[]> {
  const store = require('../../lib/recruiting-store');
  const { enrichTargetsWithBoardSeed } = require('../../lib/target-board-enrich');
  const allowlist = require('../../lib/recruiting-target-allowlist');
  const board = await store.getBoard(FUTURECAST_CLASS_YEAR);
  const enriched = enrichTargetsWithBoardSeed(board.targets || [], FUTURECAST_CLASS_YEAR, allowlist);
  return filterBlockedRecruits(
    enriched.map((p: Record<string, unknown>) => ({
      slug: String(p.slug || ''),
      name: String(p.name || ''),
      pos: p.pos as string | undefined,
      school: p.school as string | undefined,
      htWt: p.htWt as string | undefined,
      stars: p.stars as number | undefined,
      rating: p.rating as number | undefined,
      natlRank: p.natlRank as number | undefined,
      posRank: p.posRank as number | undefined,
      stateRank: p.stateRank as number | undefined,
      headliner: Boolean(p.headliner),
      committedTo: (p.committedTo as string | null) ?? null,
      skinny: p.skinny as string | undefined,
      ufOvStatus: p.ufOvStatus as string | null | undefined,
      visitStart: p.visitStart as string | null | undefined,
      visitEnd: p.visitEnd as string | null | undefined,
      ufProbability: p.ufProbability as number | undefined,
      classYear: FUTURECAST_CLASS_YEAR,
    }))
  ).filter((t: TargetBoardEntry) => isActiveUfTarget(t));
}

function loadRecruitingBySlug(): Map<string, RecruitingPlayerRow> {
  const map = new Map<string, RecruitingPlayerRow>();
  try {
    const players = JSON.parse(fs.readFileSync(RECRUITING_PLAYERS_PATH, 'utf8')) as RecruitingPlayerRow[];
    for (const p of players) {
      if (p.slug) map.set(p.slug, p);
      if (p.id) map.set(p.id, p);
    }
  } catch {
    /* optional */
  }
  return map;
}

function loadTargetSeedBySlug(): Map<string, TargetBoardEntry> {
  const map = new Map<string, TargetBoardEntry>();
  try {
    const doc = JSON.parse(fs.readFileSync(TARGET_BOARD_SEED_PATH, 'utf8')) as {
      targets?: TargetBoardEntry[];
    };
    for (const target of doc.targets ?? []) {
      if (target.slug) map.set(target.slug, target);
    }
  } catch {
    /* optional */
  }
  return map;
}

function resolveCommittedTo(
  target: TargetBoardEntry,
  recruiting: RecruitingPlayerRow | undefined,
  seed: TargetBoardEntry | undefined
): string | null {
  return target.committedTo ?? recruiting?.committedTo ?? seed?.committedTo ?? null;
}

function loadInsiderNotesBySlug(): Map<string, string> {
  const map = new Map<string, string>();
  try {
    const warRoom = require('../../lib/war-room-store');
    const breakdowns = (warRoom.getAllBreakdowns() as WarRoomBreakdown[]) ?? [];
    for (const b of breakdowns) {
      const note =
        b.insiderNotes?.trim() ||
        b.staffNotes?.trim() ||
        b.projection?.trim() ||
        b.recruitingStory?.trim() ||
        '';
      if (note && b.playerSlug) map.set(b.playerSlug, note);
    }
  } catch {
    /* optional */
  }
  return map;
}

function ufPctFromBoard(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value)) return 0;
  const n = Number(value);
  // Model/store fractions (0–1) expand; already-percent values stay.
  return n <= 1 ? Math.round(n * 100) : Math.round(n);
}

/** On3 / market RPM — percentage points only. Never expand 1 → 100. */
function firstPositiveRpmPct(...vals: Array<number | null | undefined>): number | null {
  for (const v of vals) {
    const n = sanitizeRpmPct(v);
    if (n != null && n > 0) return n;
  }
  return null;
}

/**
 * Drop impossible "Florida RPM 95–100" when the On3-style field clearly belongs
 * to another school (Zaiden Jernigan: Miss State ~20% lead vs Florida 100% poison).
 */
function rpmConsistentWithField(
  rpm: number | null,
  competingSchools: Array<{ name: string; pct: number }> | null | undefined
): number | null {
  if (rpm == null) return rpm;
  const real = (competingSchools || []).filter((c) => Number(c?.pct) >= 5);
  if (!real.length) return rpm;
  const top = [...real].sort((a, b) => Number(b.pct) - Number(a.pct))[0];
  const florida = real.find((c) => /florida/i.test(String(c.name || '')));
  const topIsFlorida = top && /florida/i.test(String(top.name || ''));
  const floridaPct = florida ? Number(florida.pct) : 0;
  // Gabriel: Miami 94 vs poisoned Field 80 — rival owns the board.
  if (!topIsFlorida && Number(top.pct) >= 12 && Number(top.pct) > rpm && rpm >= 40) {
    return floridaPct > 0 ? Math.max(1, Math.round(floridaPct)) : null;
  }
  if (rpm >= 85 && !topIsFlorida && floridaPct + 40 < rpm) return null;
  return rpm;
}

/**
 * Prefer live On3 topTeams Florida share over poisoned store ufRpmPct.
 * Keeps residual shares (Jernigan ~1%, Gabriel ~0.8%) so Field/Closest
 * cannot invent an 80% Florida lock from a percent-board crumb.
 */
function resolveUfRpmPctForRecruiting(
  recruiting: Record<string, unknown> | null | undefined,
  slug: string,
  competingSchools: Array<{ name: string; pct: number }> | null | undefined
): number | null {
  let fromTeams: number | null = null;
  let residualFromTeams: number | null = null;
  try {
    const {
      ufRpmFromTopTeams,
      detectTopTeamsPctScale,
      teamPct,
    } = require('../../lib/on3-board-hydrate') as {
      ufRpmFromTopTeams: (
        topTeams: unknown,
        classYear: number,
        opts?: { minPct?: number }
      ) => number | null;
      detectTopTeamsPctScale: (rows: unknown) => 'percent' | 'fraction' | 'unknown';
      teamPct: (row: unknown, scale: string) => number | null;
    };
    const teams = (recruiting?.topTeams || recruiting?.on3TopTeams) as unknown;
    const classYear = Number(recruiting?.classYear) || 2028;
    const rawFromTeams = ufRpmFromTopTeams(teams, classYear, { minPct: 0.5 });
    // 0.8% on a percent board is real residual — sanitizeRpmPct would null it.
    if (rawFromTeams != null && Number.isFinite(rawFromTeams) && rawFromTeams > 0) {
      fromTeams =
        rawFromTeams < 1 ? Math.max(1, Math.round(rawFromTeams)) : firstPositiveRpmPct(rawFromTeams);
    }
    // Residual crumb boards return null from hydrate (below minPct). Still read
    // Florida with board-aware scale — never blind raw≤1.5 → ×100 (Gabriel 0.80→80).
    if (fromTeams == null && Array.isArray(teams)) {
      const collegeRows = teams as unknown[];
      const scale = detectTopTeamsPctScale(collegeRows);
      const fl = collegeRows.find((row) => {
        const rec = row as Record<string, unknown>;
        const team = (rec?.team || rec) as Record<string, unknown> | undefined;
        const name = String(team?.name || team?.fullName || rec?.name || '');
        return /\bflorida\b|\bgators\b/i.test(name) && !/florida state|south florida/i.test(name);
      });
      if (fl) {
        const pct = teamPct(fl, scale);
        if (pct != null && Number.isFinite(pct) && pct > 0) {
          residualFromTeams = pct < 1 ? Math.max(1, Math.round(pct)) : firstPositiveRpmPct(pct);
        }
      }
    }
  } catch {
    fromTeams = null;
  }
  const store = firstPositiveRpmPct(
    recruiting?.ufRpmPct as number | null | undefined,
    loadAllowlistRpmPct(slug)
  );
  // topTeams wins when present — store 80/100 vs Miami board is poison.
  let candidate = fromTeams != null ? fromTeams : store;
  if (fromTeams != null && store != null && store >= 70 && fromTeams + 40 < store) {
    candidate = fromTeams;
  }
  if (
    residualFromTeams != null &&
    (candidate == null || (candidate >= 70 && residualFromTeams + 40 < candidate))
  ) {
    candidate = residualFromTeams;
  }
  // Rival-led industry board: never keep a locked Florida RPM.
  const topRival = [...(competingSchools || [])].sort((a, b) => Number(b.pct) - Number(a.pct))[0];
  if (
    candidate != null &&
    candidate >= 40 &&
    topRival &&
    Number(topRival.pct) >= 12 &&
    Number(topRival.pct) > candidate
  ) {
    candidate = fromTeams != null ? fromTeams : residualFromTeams;
  }
  return rpmConsistentWithField(candidate, competingSchools);
}

/** Store/model UF odds — may still be 0–1 fractions. */
function firstPositiveStorePct(...vals: Array<number | null | undefined>): number | null {
  for (const v of vals) {
    const n = sanitizeStoreOddsPct(v);
    if (n != null && n > 0) return n;
  }
  return null;
}

/** @deprecated — ambiguous; prefer firstPositiveRpmPct / firstPositiveStorePct */
function firstPositivePct(...vals: Array<number | null | undefined>): number | null {
  return firstPositiveStorePct(...vals);
}

function loadAllowlistRpmPct(slug: string): number | null {
  try {
    const { loadOn3RpmUfPctBySlug } = require('../../lib/on3-rpm-allowlist') as {
      loadOn3RpmUfPctBySlug: () => Map<string, number>;
    };
    const pct = loadOn3RpmUfPctBySlug().get(String(slug || '').toLowerCase());
    return pct != null && Number(pct) > 0 ? Math.round(Number(pct)) : null;
  } catch {
    return null;
  }
}

function isUnderclassmenHighPriorityYear(classYear: number): boolean {
  return (HIGH_PRIORITY_UNDERCLASSMEN_YEARS as readonly number[]).includes(classYear);
}

function allowlist2028Rank(slug: string): number {
  const key = String(slug || '').toLowerCase();
  const index = (ALLOWLIST_2028 as string[]).indexOf(key);
  return index >= 0 ? index : Number.MAX_SAFE_INTEGER;
}

function compareUnderclassmenHighPriority(a: HighPriorityPlayer, b: HighPriorityPlayer): number {
  // Rank by staff-chase traction (visits/offers/staff/beat) — not RPM or fit alone.
  const prio = (b.priorityScore ?? 0) - (a.priorityScore ?? 0);
  if (prio !== 0) return prio;
  const delta = (b.delta7d ?? 0) - (a.delta7d ?? 0);
  if (delta !== 0) return delta;
  return allowlist2028Rank(a.slug) - allowlist2028Rank(b.slug);
}

/**
 * Re-score Lab High Priority as Hottest Targets:
 * staff heat × must-get fit × positional need × FL geo × market pressure.
 * Campus UV stacks do not own the sort.
 */
function applyChasePriorityScores<
  T extends {
    slug: string;
    fitScore?: number;
    delta7d?: number;
    ufStatus?: string | null;
    uf_status?: string | null;
    evaluationNotes?: string | null;
    evaluation_notes?: string | null;
    signals?: unknown[];
    pos?: string | null;
    position?: string | null;
    stars?: number | null;
    rating?: number | null;
    vaultGrade?: number | null;
    natlRank?: number | null;
    htWt?: string | null;
    height?: string | null;
    inState?: boolean | null;
    state?: string | null;
    hometownState?: string | null;
    skinny?: string | null;
    profileNote?: string | null;
    classYear?: number | null;
  },
>(
  players: T[],
  classYear: number
): Array<
  T & {
    priorityScore: number;
    chaseScore: number;
    hotScore: number;
    hotLanes?: Record<string, number>;
    hotBadges?: Record<string, boolean>;
  }
> {
  const { scoreHotTargetBoard } = require('../../lib/hot-florida-targets');
  return scoreHotTargetBoard(players, { classYear });
}

function isSeedPredictorName(name: string): boolean {
  return /allowlist[_\s-]?seed/i.test(String(name || ''));
}

function buildDisplayPredictors(
  raw: Array<{ name: string; score: number }>,
  ufRpmPct: number | null
): Array<{ name: string; score: number }> {
  const out: Array<{ name: string; score: number }> = [];
  if (ufRpmPct != null && ufRpmPct > 0) {
    out.push({ name: 'On3 RPM', score: ufRpmPct });
  }
  for (const p of raw || []) {
    if (!p?.name || isSeedPredictorName(p.name)) continue;
    if (out.some((x) => x.name.toLowerCase() === String(p.name).toLowerCase())) continue;
    out.push({ name: p.name, score: Number(p.score) || 0 });
  }
  return out.slice(0, 4);
}

async function loadUnderclassmenHighPrioritySlugs(classYear: number): Promise<string[]> {
  const { getLiveBoardTargets } = require('../../lib/live-board-targets');
  const { getAllowlistSet } = require('../../lib/recruiting-target-allowlist');
  const { isBlockedRecruit } = require('../../lib/recruiting-blocked-players');
  if (classYear === 2028) {
    // Priority Chase = locked hunt list (static + admin + formula), NOT the full
    // live-board census. Dumping live extras reintroduced roster/alumni ATH shells
    // (Kyle Trask, Caden Jones, Tramell Jones) after allowlist removes.
    const allow = [...getAllowlistSet(2028)]
      .map((s: string) => String(s).toLowerCase())
      .filter((slug: string) => slug && !isBlockedRecruit({ slug }));
    if (!allow.length) {
      return (ALLOWLIST_2028 as string[])
        .map((s) => String(s).toLowerCase())
        .filter((slug) => slug && !isBlockedRecruit({ slug }));
    }
    const live = await getLiveBoardTargets(2028);
    const liveSet = new Set(
      live
        .map((t: { slug?: string }) => String(t.slug || '').toLowerCase())
        .filter(Boolean)
    );
    const onLive = allow.filter((slug: string) => liveSet.has(slug));
    const offline = allow.filter((slug: string) => !liveSet.has(slug));
    return onLive.length || offline.length ? [...onLive, ...offline] : allow;
  }
  return [];
}

function boardPlayerToHighPriority(
  p: import('./allowlist-board').FutureCastBoardPlayer
): HighPriorityPlayer {
  const ufRpmPct =
    p.ufRpmPct != null && Number(p.ufRpmPct) > 0 ? Math.round(Number(p.ufRpmPct)) : null;
  const gvRaw = p.ufConfidence != null && Number(p.ufConfidence) > 0 ? Number(p.ufConfidence) : null;
  // Never invent 0% when GV is missing — fall back to On3 RPM so cards match peers (Hudson West).
  const ufProbability = gvRaw != null ? ufPctFromBoard(gvRaw) : ufRpmPct != null ? ufRpmPct : 0;
  const fitScore =
    p.fitScore != null && Number(p.fitScore) > 0 ? Math.round(Number(p.fitScore)) : 0;
  // Movement comes from uf-trend snapshots after applySnapshotMovement — never seed baselines.
  const delta7d = 0;
  const realPredictors = (p.predictors ?? []).filter((x) => x?.name && !isSeedPredictorName(x.name));
  const staffFromPredictors = realPredictors.find((x) => /rivals|staff|insider/i.test(x.name));
  const staffConfidence =
    staffFromPredictors && staffFromPredictors.score > 0
      ? Math.round(staffFromPredictors.score)
      : 0;
  // Placeholder — overwritten by applyChasePriorityScores before sort.
  const priorityScore = 0;

  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    classYear: p.classYear,
    position: p.position,
    school: p.school ?? null,
    htWt: null,
    stars: (() => {
      const n = Number(p.stars);
      return Number.isFinite(n) && n >= 1 ? Math.round(n) : null;
    })(),
    headliner: false,
    committedTo: p.committedTo ?? null,
    compositeScore: p.composite ?? 0,
    nationalRank: p.natlRank ?? null,
    positionRank: p.posRank ?? null,
    stateRank: p.stateRank ?? null,
    rating: p.composite ?? null,
    natlRank: p.natlRank ?? null,
    posRank: p.posRank ?? null,
    ufProbability,
    ufProbabilitySource: p.ufProbabilitySource ?? (gvRaw != null ? undefined : ufRpmPct != null ? 'on3-rpm' : undefined),
    ufProbabilityLabel: p.ufProbabilityLabel ?? (gvRaw != null ? 'GV' : ufRpmPct != null ? 'On3 RPM' : 'GV'),
    ufProbabilityLowConfidence: p.ufProbabilityLowConfidence ?? false,
    movementDelta: delta7d,
    delta7d,
    fitScore,
    staffConfidence,
    priorityScore,
    insiderNotes: null,
    notePreview: null,
    skinny: null,
    visitHistory: [],
    ufOvStatus: null,
    visitStart: null,
    visitEnd: null,
    trendHistory: [],
    predictors: buildDisplayPredictors(p.predictors ?? [], ufRpmPct),
    competingSchools: (p.competingSchools ?? [])
      .filter((s) => s?.name && Number(s.pct) > 0)
      .map((s) => ({ name: s.name, pct: Number(s.pct) })),
    ufRpmPct,
  };
}

async function buildUnderclassmenHighPriorityPayload(classYear: number) {
  const slugs = await loadUnderclassmenHighPrioritySlugs(classYear);
  const board = slugs.length ? await loadUnderclassmenBoardPlayers(classYear, slugs) : [];
  const mapped = filterBlockedRecruits(
    board
      .map(boardPlayerToHighPriority)
      .filter((p) => isActiveUfTarget(p))
      .filter((p) => Number(p.classYear) === Number(classYear))
  );
  let eliteMapped = mapped;
  try {
    const { filterEliteChaseProfiles } = require('../../lib/elite-chase-profile-bar');
    eliteMapped = filterEliteChaseProfiles(mapped);
  } catch {
    eliteMapped = mapped;
  }
  const ufTrendSnapshot = require('../../lib/uf-trend-snapshot');
  // Record today's GV likelihood, then attach real 7d snapshot deltas (not seed +4).
  const withMovement = ufTrendSnapshot.applySnapshotMovement(eliteMapped, { minAbs: 1 });
  const withChase = applyChasePriorityScores(withMovement, classYear);
  // Attach offer/visit/intel evidence so Closest to commit is process-backed, not On3 % alone.
  const { attachClosestCommitEvidence } = require('../../lib/closest-commit-evidence');
  const withEvidence = attachClosestCommitEvidence(withChase, { classYear, days: 180 });
  // Fan-facing visit lines + Why we chase notes from live visit/intel stores (API-only).
  // Soft priority nudge from fresh process — never invents delta7d / Rising.
  const { enrichHighPriorityChaseCards, DEFAULT_VISIT_DAYS } = require('../../lib/hp-chase-card-enrich');
  // Match Board Intel (~21d) — 180d painted June camp UVs on almost every Chase card.
  const withCardIntel = enrichHighPriorityChaseCards(withEvidence, { days: DEFAULT_VISIT_DAYS });
  // Full locked board, chase-scored. Do not slice to chase top-N — Who commits next /
  // Closest to commit is a system board-lead read over every allowlist target.
  // Priority chase surfaces still re-sort by priorityScore and take top 10 client-side.
  const players = [...withCardIntel].sort(compareUnderclassmenHighPriority);
  const lastUpdated = new Date().toISOString();
  const visitBoardSnapshot = getVisitIntelBoardSnapshot([]);

  return {
    classYear,
    count: players.length,
    visitIntelCount: 0,
    visitRecapCount: 0,
    flipWatchCount: 0,
    visitBoardSnapshot,
    updatedAt: lastUpdated,
    lastUpdated,
    players,
    visitIntel: [],
    visitRecap: [],
    flipWatch: [],
    movementNarratives: [],
  };
}

async function buildClosingClassHighPriorityPayload(classYear: number) {
      const rankings = loadRecruitingRankings();
      const recruitingBySlug = loadRecruitingBySlug();
      const targetSeedBySlug = loadTargetSeedBySlug();
      const insiderBySlug = loadInsiderNotesBySlug();
      const targets = await loadTargetBoardFromStore();
      const predictorsBySlug = loadUfPctPredictorsBySlug();
      const targetSlugs = targets.map((t) => t.slug);

      const visitLogStore = require('../../lib/recruiting-visit-log-store');
      const visitLogs = visitLogStore.loadDoc().items || [];

      let rows = await listPredictions({
        class_year: classYear,
        status: 'ACTIVE',
        lifecycle: 'HS',
        limit: 500,
      });
      rows = filterFutureCastFeedRows(filterModelPredictionsOnly(rows));
      rows = dedupeFeedRows(rows);
      const serialized = await serializeFeedRowsWithVolatility(rows);

      const boosts = await listCompetingVolatilityBoosts(ROLLING_MOVEMENT_WINDOW_DAYS).catch(
        () => new Map<string, number>()
      );
      const rollingRows = await listRollingMovement(
        { class_year: classYear, lifecycle: 'HS' },
        boosts
      );
      const delta7dBySlug = new Map(
        rollingRows.map((row) => [row.slug, row.delta7d])
      );
      const ufTrendSnapshot = require('../../lib/uf-trend-snapshot');
      const snapshotDeltaBySlug = ufTrendSnapshot.buildDelta7dBySlug(targetSlugs);
      const mergedDelta7dBySlug = ufTrendSnapshot.mergeDelta7dMaps(
        delta7dBySlug,
        snapshotDeltaBySlug,
        targetSlugs
      );

      const predictionBySlug = new Map<string, (typeof serialized)[number]>();
      for (const p of serialized) {
        if (p.playerSlug) predictionBySlug.set(p.playerSlug, p);
      }

      const playerIds = serialized.map((p) => p.playerId);
      const historyMap = await listMovementHistoryByPlayerIds(playerIds, VOLATILITY_WINDOW_DAYS);

      const players: HighPriorityPlayer[] = targets.map((target) => {
        const slug = target.slug;
        const recruiting = recruitingBySlug.get(slug);
        const seed = targetSeedBySlug.get(slug);
        const model = predictionBySlug.get(slug);
        const rank = rankings.get(slug);
        const insiderNotes = insiderBySlug.get(slug) ?? null;

        const compositeScore = rank?.compositeScore ?? target.rating ?? 0;
        const nationalRank = rank?.nationalRank ?? target.natlRank ?? null;
        const positionRank = rank?.positionRank ?? target.posRank ?? null;
        const stateRank = rank?.stateRank ?? target.stateRank ?? null;

        const predictors: HighPriorityPredictor[] = [];
        if (model?.predictorId) {
          predictors.push({
            name: PREDICTOR_NAMES[model.predictorId] ?? model.predictorId,
            score: Math.round(model.confidence),
          });
        }
        for (const ext of predictorsBySlug.get(slug.toLowerCase()) || []) {
          predictors.push(ext);
        }

        const { competingSchoolsFromRecruitingRecord } = require('../../lib/underclassmen-intel');
        const competingSchools = competingSchoolsFromRecruitingRecord(
          recruiting as Record<string, unknown> | null | undefined
        );
        const storeRpm = resolveUfRpmPctForRecruiting(
          recruiting as Record<string, unknown> | null | undefined,
          slug,
          competingSchools
        );
        const rpmForGv =
          resolveUncommittedMarketRpm({
            rpmPct: storeRpm,
            committed: Boolean(resolveCommittedTo(target, recruiting, seed)),
            topTeams:
              (recruiting as { topTeams?: unknown; on3TopTeams?: unknown } | null | undefined)
                ?.topTeams ||
              (recruiting as { on3TopTeams?: unknown } | null | undefined)?.on3TopTeams ||
              null,
            classYear,
          }) ?? storeRpm;
        const rivalsPct = pickRivalsPmScore(predictors);
        // Never let allowlist/predictor On3 RPM disagree with field-healed market RPM.
        if (storeRpm != null) {
          const on3Idx = predictors.findIndex((p) => /on3/i.test(String(p.name || '')));
          if (on3Idx >= 0) predictors[on3Idx] = { name: 'On3 RPM', score: storeRpm };
          else predictors.push({ name: 'On3 RPM', score: storeRpm });
        }
        const storeFit =
          recruiting?.fitScore != null && Number(recruiting.fitScore) > 0
            ? Number(recruiting.fitScore)
            : 0;
        const seedModel = String(model?.predictorId || '').toLowerCase() === 'allowlist_seed';
        const delta7d = mergedDelta7dBySlug.get(slug) ?? model?.delta ?? 0;
        const movementDelta = delta7d;
        const resolvedUf =
          classYear >= 2028
            ? resolveGatorVaultLikelihood({
                modelPct: seedModel ? 0 : model?.confidence ?? model?.ufProbability ?? 0,
                rpmPct: rpmForGv ?? 0,
                rivalsPct,
                fitScore: Math.round(model?.ufFitScore ?? storeFit ?? 0),
                storePct:
                  firstPositiveStorePct(
                    target.ufProbability,
                    recruiting?.ufProbability,
                    recruiting?.futurecastProbability
                  ) ?? 0,
                delta7d: Number(delta7d) / 100,
                stars: target.stars ?? rank?.stars ?? null,
                headliner: Boolean(target.headliner),
              })
            : resolveUfProbability({
                modelPct: model?.confidence ?? model?.ufProbability,
                // Never let an explicit 0 block On3 RPM (Hudson West / peers).
                storePct: firstPositiveStorePct(
                  target.ufProbability,
                  storeRpm,
                  recruiting?.ufProbability,
                  recruiting?.futurecastProbability
                ),
                predictors,
                stars: target.stars ?? rank?.stars ?? null,
                headliner: Boolean(target.headliner),
              });
        const ufProbability = resolvedUf.value;
        const ufRpmPct = storeRpm;
        // Scheme fit only — never fall back to On3 rating/composite (that forged
        // "Elite scheme fit · 8% Florida" hero copy from a 90+ rating).
        const fitScore = Math.round(model?.ufFitScore ?? storeFit ?? 0);
        const staffConfidence = Math.round(
          model?.fitScoreBreakdown?.staff ??
            (ufProbability > 0 ? Math.min(100, ufProbability * 0.85) : 0)
        );

        // Placeholder — overwritten by applyChasePriorityScores before sort.
        const priorityScore = 0;

        const pgTrendHistory = (historyMap.get(model?.playerId ?? '') ?? []).map((h) => ({
          date: h.date,
          confidence: h.confidence,
        }));
        const snapshotTrendHistory = ufTrendSnapshot.buildTrendHistoryForSlug(slug);
        const trendHistory = ufTrendSnapshot.mergeTrendHistories(pgTrendHistory, snapshotTrendHistory);

        return {
          id: slug,
          slug,
          name: target.name,
          position: target.pos ?? recruiting?.pos ?? '—',
          school: target.school ?? recruiting?.school ?? null,
          htWt: target.htWt ?? null,
          stars: (() => {
            const n = Number(target.stars ?? rank?.stars ?? 0);
            return Number.isFinite(n) && n >= 1 ? Math.round(n) : null;
          })(),
          headliner: Boolean(target.headliner),
          committedTo: resolveCommittedTo(target, recruiting, seed),
          compositeScore: compositeScore ?? 0,
          nationalRank,
          positionRank,
          stateRank,
          rating: compositeScore,
          natlRank: nationalRank,
          posRank: positionRank,
          ufProbability,
          ufProbabilitySource: resolvedUf.source,
          ufProbabilityLabel: resolvedUf.label,
          ufProbabilityLowConfidence: resolvedUf.lowConfidence,
          movementDelta,
          delta7d,
          fitScore,
          staffConfidence,
          priorityScore,
          insiderNotes,
          notePreview: notePreview(insiderNotes ?? target.skinny),
          skinny: target.skinny ?? null,
          visitHistory: (() => {
            const { mergeExpectedVisitHistory } = require('../../lib/game-week-visitors');
            return mergeExpectedVisitHistory(
              String(target.slug || ''),
              buildVisitHistory(target, recruiting)
            );
          })(),
          ufOvStatus: target.ufOvStatus ?? recruiting?.ufOvStatus ?? null,
          visitStart: target.visitStart ?? recruiting?.visitStart ?? null,
          visitEnd: target.visitEnd ?? recruiting?.visitEnd ?? null,
          trendHistory,
          predictors,
          competingSchools,
          ufRpmPct,
        };
      });

      const playersWithVerifiedVisits = players.map((p) => {
        const verified = applyVerifiedVisitFields(p, visitLogs);
        return {
          ...p,
          visitStart: verified.visitStart,
          visitEnd: verified.visitEnd,
          ufOvStatus: verified.ufOvStatus,
          visitVerified: verified.visitVerified,
          visitSource: verified.visitSource ?? null,
          visitSourceLabel: verified.visitSourceLabel ?? null,
        };
      });

      const withChase = applyChasePriorityScores(playersWithVerifiedVisits, classYear);
      const sorted = [...withChase].sort(
        (a, b) =>
          (b.priorityScore ?? 0) - (a.priorityScore ?? 0) ||
          (b.delta7d ?? 0) - (a.delta7d ?? 0) ||
          String(a.name || '').localeCompare(String(b.name || ''))
      );
      const top10 = sorted.slice(0, HIGH_PRIORITY_UNDERCLASSMEN_LIMIT);

      const visitIntel = buildVerifiedVisitIntelRows(playersWithVerifiedVisits, visitLogs);
      const visitRecap = buildVerifiedVisitRecapRows(playersWithVerifiedVisits, visitLogs, new Date(), {
        limit: 12,
        prioritySlugs: targetSlugs,
      });

      const commitBySlug = new Map<string, string>();
      const ufBySlug = new Map<string, number | null>();
      const ufLabelBySlug = new Map<string, string | null>();
      const ufLowConfidenceBySlug = new Map<string, boolean>();
      const nameBySlug = new Map<string, string>();

      const resolveSlugUfMeta = (slug: string) => {
        const recruiting = recruitingBySlug.get(slug);
        const seed = targetSeedBySlug.get(slug);
        const model = predictionBySlug.get(slug);
        const key = slug.toLowerCase();
        const predictors: HighPriorityPredictor[] = [];
        if (model?.predictorId) {
          predictors.push({
            name: PREDICTOR_NAMES[model.predictorId] ?? model.predictorId,
            score: Math.round(model.confidence),
          });
        }
        for (const ext of predictorsBySlug.get(key) || []) {
          predictors.push(ext);
        }
        return resolveUfProbability({
          modelPct: model?.confidence ?? model?.ufProbability,
          storePct: firstPositiveStorePct(
            seed?.ufProbability,
            resolveUfRpmPctForRecruiting(
              recruiting as Record<string, unknown> | null | undefined,
              slug,
              (() => {
                try {
                  const { competingSchoolsFromRecruitingRecord } = require('../../lib/underclassmen-intel');
                  return competingSchoolsFromRecruitingRecord(
                    recruiting as Record<string, unknown> | null | undefined
                  );
                } catch {
                  return [] as Array<{ name: string; pct: number }>;
                }
              })()
            ),
            recruiting?.ufProbability,
            recruiting?.futurecastProbability
          ),
          predictors,
          stars: seed?.stars ?? recruiting?.stars ?? null,
          headliner: Boolean(seed?.headliner),
        });
      };

      const storeResolvedUf = (slug: string, resolved: ReturnType<typeof resolveUfProbability>) => {
        const key = slug.toLowerCase();
        ufBySlug.set(key, resolved.value);
        ufLabelBySlug.set(key, resolved.label);
        ufLowConfidenceBySlug.set(key, resolved.lowConfidence);
      };

      for (const [slug, seed] of targetSeedBySlug.entries()) {
        const recruiting = recruitingBySlug.get(slug);
        const committedTo = resolveCommittedTo(seed, recruiting, seed);
        const key = slug.toLowerCase();
        if (committedTo) commitBySlug.set(key, committedTo);
        nameBySlug.set(key, seed.name);
        storeResolvedUf(slug, resolveSlugUfMeta(slug));
      }
      for (const p of playersWithVerifiedVisits) {
        const key = String(p.slug || '').toLowerCase();
        ufBySlug.set(key, p.ufProbability ?? ufBySlug.get(key) ?? null);
        ufLabelBySlug.set(key, p.ufProbabilityLabel ?? ufLabelBySlug.get(key) ?? null);
        ufLowConfidenceBySlug.set(
          key,
          p.ufProbabilityLowConfidence ?? ufLowConfidenceBySlug.get(key) ?? false
        );
        nameBySlug.set(key, p.name);
        if (p.committedTo) commitBySlug.set(key, p.committedTo);
      }
      for (const row of visitRecap) {
        const slug = String(row.slug || '');
        if (!slug) continue;
        const key = slug.toLowerCase();
        const recruiting = recruitingBySlug.get(slug);
        if (recruiting?.committedTo) commitBySlug.set(key, recruiting.committedTo);
        if (recruiting?.name) nameBySlug.set(key, recruiting.name);
        if (ufLabelBySlug.get(key) == null) {
          storeResolvedUf(slug, resolveSlugUfMeta(slug));
        }
      }

      const useCuratedFlipWatch = classYear === FUTURECAST_CLASS_YEAR && FLIP_WATCH_2027.length > 0;
      // Prefer recruiting-store rows for Flip Watch (stars/pos/commit) over HP board rows.
      const flipWatchPlayerPool = useCuratedFlipWatch
        ? [
            ...playersWithVerifiedVisits,
            ...[...recruitingBySlug.values()].map((p) => ({
              slug: p.slug,
              name: p.name,
              pos: p.pos,
              position: p.pos,
              stars: p.stars,
              committedTo: p.committedTo,
            })),
          ]
        : playersWithVerifiedVisits;
      for (const [slug, school] of Object.entries(FLIP_WATCH_COMMITS_2027 || {})) {
        if (school) commitBySlug.set(String(slug).toLowerCase(), String(school));
      }
      const flipWatchRaw = buildFlipWatchRows(flipWatchPlayerPool, visitRecap, {
        visitLogs,
        intelRows: intelStore.loadIntelDoc().items || [],
        commitBySlug,
        ufBySlug,
        ufLabelBySlug,
        ufLowConfidenceBySlug,
        nameBySlug,
        ...(useCuratedFlipWatch
          ? {
              curatedSlugs: FLIP_WATCH_2027,
              commitDefaults: FLIP_WATCH_COMMITS_2027,
              displayNames: CANONICAL_TARGET_NAMES,
              limit: FLIP_WATCH_2027.length,
            }
          : {}),
      });
      const movementNarrativeLib = require('../../lib/movement-narrative');
      const visitRecapEnriched = movementNarrativeLib.enrichVisitRecapRows(
        visitRecap,
        visitLogs,
        mergedDelta7dBySlug
      ).map((row) => {
        const player = playersWithVerifiedVisits.find(
          (p) => String(p.slug || '').toLowerCase() === String(row.slug || '').toLowerCase()
        );
        return {
          ...row,
          ufProbability: row.ufProbability ?? player?.ufProbability ?? null,
          ufProbabilityLabel:
            player?.ufProbabilityLabel ?? ufLabelBySlug.get(String(row.slug || '').toLowerCase()) ?? null,
        };
      });
      // Curated Closing Class Flip Watch: commit-school cards only (no RPM / UF %).
      const flipWatch = useCuratedFlipWatch
        ? flipWatchRaw
        : movementNarrativeLib
            .enrichFlipWatchRows(flipWatchRaw, visitLogs, mergedDelta7dBySlug)
            .map((row) => {
              const player = playersWithVerifiedVisits.find(
                (p) => String(p.slug || '').toLowerCase() === String(row.slug || '').toLowerCase()
              );
              return {
                ...row,
                ufProbability: row.ufProbability ?? player?.ufProbability ?? null,
                ufProbabilityLabel:
                  player?.ufProbabilityLabel ??
                  ufLabelBySlug.get(String(row.slug || '').toLowerCase()) ??
                  null,
                ufProbabilityLowConfidence:
                  player?.ufProbabilityLowConfidence ??
                  ufLowConfidenceBySlug.get(String(row.slug || '').toLowerCase()) ??
                  false,
              };
            });
      const narrativePlayerSlugs = new Set(
        playersWithVerifiedVisits.map((p) => String(p.slug || '').toLowerCase())
      );
      const narrativePlayers = [...playersWithVerifiedVisits];
      for (const player of top10) {
        const key = String(player.slug || '').toLowerCase();
        if (!key || narrativePlayerSlugs.has(key)) continue;
        narrativePlayerSlugs.add(key);
        narrativePlayers.push(player);
      }
      const movementNarratives = movementNarrativeLib.buildNarrativeFeed(
        narrativePlayers,
        visitLogs,
        mergedDelta7dBySlug,
        { limit: 8, allowTrendOnly: true }
      );
      const visitBoardSnapshot = getVisitIntelBoardSnapshot(visitLogs);

      const lastUpdated = new Date().toISOString();
      return {
        classYear,
        count: top10.length,
        visitIntelCount: visitIntel.length,
        visitRecapCount: visitRecap.length,
        flipWatchCount: flipWatch.length,
        visitBoardSnapshot,
        updatedAt: lastUpdated,
        lastUpdated,
        players: top10,
        visitIntel,
        visitRecap: visitRecapEnriched,
        flipWatch,
        movementNarratives,
      };
}

/** Shared by HTTP handler + boot/keepalive warm so Lab cache is primed before fans hit. */
export async function buildHighPriorityPayload(classYear: number) {
  const payload = isUnderclassmenHighPriorityYear(classYear)
    ? await buildUnderclassmenHighPriorityPayload(classYear)
    : await buildClosingClassHighPriorityPayload(classYear);
  return sanitizeHighPriorityStarsPayload(payload);
}

export const handleGetFutureCastHighPriority = asyncHandler(async (req: Request, res: Response) => {
  try {
    const classYear = parseYear(req.query.year ?? req.query.class_year);
    if (classYear !== FUTURECAST_CLASS_YEAR && !isUnderclassmenHighPriorityYear(classYear)) {
      res.status(400).json({
        error: `Only ${FUTURECAST_CLASS_YEAR} and ${HIGH_PRIORITY_UNDERCLASSMEN_YEARS.join('/')} cycles are supported`,
      });
      return;
    }

    const cacheKey = highPriorityCacheKey(classYear);
    // Elite: serve worker/disk snapshot before returning status:building —
    // Heal on serve so poisoned odds/boards never ship. Do NOT background
    // buildHighPriorityPayload on every DISK hit — that OOM'd Pro and caused
    // exit-143 / 502 loops once HP was no-store (TestFlight hammer).
    const primed = loadHighPriorityCached(classYear);
    if (primed != null) {
      const healed = sanitizeHighPriorityStarsPayload(primed);
      primeFuturecastCache(cacheKey, healed);
      res.setHeader('X-GatorVault-Cache', 'DISK');
      // Odds/board heals must reach iOS — never let URLCache keep a poisoned plate.
      res.setHeader('Cache-Control', 'no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.json(healed);
      // Persist healed plate cheaply (no full rebuild). Full refresh stays on
      // hub-warm / boot spaced Lab warm. Throttle writes so no-store traffic
      // does not stringify the plate on every phone refresh.
      const writeKey = `hp-healed-write:${classYear}`;
      const lastWrite = Number((global as any).__GV_HP_HEALED_WRITE_AT__?.[writeKey] || 0);
      if (Date.now() - lastWrite > 60_000) {
        (global as any).__GV_HP_HEALED_WRITE_AT__ = {
          ...((global as any).__GV_HP_HEALED_WRITE_AT__ || {}),
          [writeKey]: Date.now(),
        };
        setImmediate(() => {
          try {
            writeHighPriorityRuntime(classYear, healed);
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.warn('[futurecast-hp] healed disk write failed:', message);
          }
        });
      }
      return;
    }
    await sendCachedJson(res, cacheKey, () => buildHighPriorityPayload(classYear), {
      // Closing Class: never leave Top UF Targets / Flip Watch empty on Tier B cold miss.
      // Soft plate is allowlist + 2027-target-board (API/data — no Codemagic).
      softOnDeferred: () => {
        if (classYear === FUTURECAST_CLASS_YEAR) {
          const soft = softClosingClassHighPriorityFromSeed(classYear);
          primeFuturecastCache(cacheKey, soft);
          writeHighPriorityRuntime(classYear, soft);
          return soft;
        }
        return loadHighPriorityCached(classYear);
      },
      backgroundBuildOnSoft: false,
    });
  } catch (err) {
    handlePredictionsApiError(res, err);
  }
});

export { allowlist2028Rank, compareUnderclassmenHighPriority };
