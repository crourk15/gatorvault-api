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
import { sendCachedJson, highPriorityCacheKey } from './response-cache';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { filterBlockedRecruits } = require('../../lib/recruiting-blocked-players');
const { isActiveUfTarget } = require('../../lib/recruiting-target-filters');
const { buildVerifiedVisitIntelRows, applyVerifiedVisitFields, buildVerifiedVisitRecapRows, getVisitIntelBoardSnapshot } = require('../../lib/visit-intel-utils');
const { resolveUfProbability, loadUfPctPredictorsBySlug } = require('../../lib/uf-probability-utils');
const { buildFlipWatchRows } = require('../../lib/flip-watch-utils');
const intelStore = require('../../lib/recruiting-intel-store');
const {
  ALLOWLIST_2028,
  FLIP_WATCH_2027,
  FLIP_WATCH_COMMITS_2027,
  CANONICAL_TARGET_NAMES,
} = require('../../lib/recruiting-target-allowlist');
const { loadUnderclassmenBoardPlayers } = require('../../lib/underclassmen-intel');
const RECRUITING_PLAYERS_PATH = path.join(__dirname, '../../data/recruiting/players.json');
const TARGET_BOARD_SEED_PATH = path.join(__dirname, '../../data/recruiting/2027-target-board.json');

/** Underclassmen years served by the high-priority endpoint (2027 uses legacy board pipeline). */
export const HIGH_PRIORITY_UNDERCLASSMEN_YEARS = [2028] as const;
/** Top N allowlist targets surfaced for 2028+ high-priority board. */
export const HIGH_PRIORITY_UNDERCLASSMEN_LIMIT = 18;

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
  return n <= 1 ? Math.round(n * 100) : Math.round(n);
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
  // Rank by GatorVault priority / likelihood — not allowlist seed order.
  const prio = (b.priorityScore ?? 0) - (a.priorityScore ?? 0);
  if (prio !== 0) return prio;
  const uf = (b.ufProbability ?? 0) - (a.ufProbability ?? 0);
  if (uf !== 0) return uf;
  return (b.fitScore ?? 0) - (a.fitScore ?? 0);
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
  if (classYear === 2028) {
    const live = await getLiveBoardTargets(2028);
    const liveSlugs = live
      .map((t: { slug?: string }) => String(t.slug || '').toLowerCase())
      .filter(Boolean);
    const liveSet = new Set(liveSlugs);
    const allowlistFirst = (ALLOWLIST_2028 as string[])
      .map((s) => String(s).toLowerCase())
      .filter((slug) => liveSet.has(slug));
    const extras = liveSlugs.filter((slug) => !allowlistFirst.includes(slug));
    if (allowlistFirst.length || extras.length) return [...allowlistFirst, ...extras];
    return (ALLOWLIST_2028 as string[]).map((s) => String(s).toLowerCase());
  }
  return [];
}

function boardPlayerToHighPriority(
  p: import('./allowlist-board').FutureCastBoardPlayer
): HighPriorityPlayer {
  const ufProbability = ufPctFromBoard(p.ufConfidence);
  const fitScore = Math.round(p.fitScore ?? 0);
  // Movement comes from uf-trend snapshots after applySnapshotMovement — never seed baselines.
  const delta7d = 0;
  const ufRpmPct =
    p.ufRpmPct != null && Number(p.ufRpmPct) > 0 ? Math.round(Number(p.ufRpmPct)) : null;
  const realPredictors = (p.predictors ?? []).filter((x) => x?.name && !isSeedPredictorName(x.name));
  const staffFromPredictors = realPredictors.find((x) => /rivals|staff|insider/i.test(x.name));
  const staffConfidence =
    staffFromPredictors && staffFromPredictors.score > 0
      ? Math.round(staffFromPredictors.score)
      : 0;
  const priorityScore =
    Math.round((ufProbability * 0.55 + fitScore * 0.3 + Math.max(0, delta7d) * 0.15) * 100) / 100;

  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    classYear: p.classYear,
    position: p.position,
    school: p.school ?? null,
    htWt: null,
    stars: p.stars ?? null,
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
    ufProbabilitySource: p.ufProbabilitySource,
    ufProbabilityLabel: p.ufProbabilityLabel ?? 'GV',
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
  const mapped = board
    .map(boardPlayerToHighPriority)
    .filter((p) => isActiveUfTarget(p))
    .filter((p) => Number(p.classYear) === Number(classYear));
  const ufTrendSnapshot = require('../../lib/uf-trend-snapshot');
  // Record today's GV likelihood, then attach real 7d snapshot deltas (not seed +4).
  const withMovement = ufTrendSnapshot.applySnapshotMovement(mapped, { minAbs: 1 });
  const sorted = [...withMovement].sort(compareUnderclassmenHighPriority);
  const top10 = sorted.slice(0, HIGH_PRIORITY_UNDERCLASSMEN_LIMIT);
  const lastUpdated = new Date().toISOString();
  const visitBoardSnapshot = getVisitIntelBoardSnapshot([]);

  return {
    classYear,
    count: top10.length,
    visitIntelCount: 0,
    visitRecapCount: 0,
    flipWatchCount: 0,
    visitBoardSnapshot,
    updatedAt: lastUpdated,
    lastUpdated,
    players: top10,
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

        const resolvedUf = resolveUfProbability({
          modelPct: model?.confidence ?? model?.ufProbability,
          storePct:
            target.ufProbability ??
            recruiting?.ufRpmPct ??
            recruiting?.ufProbability ??
            recruiting?.futurecastProbability,
          predictors,
          stars: target.stars ?? rank?.stars ?? null,
          headliner: Boolean(target.headliner),
        });
        const ufProbability = resolvedUf.value;
        const { competingSchoolsFromRecruitingRecord } = require('../../lib/underclassmen-intel');
        const competingSchools = competingSchoolsFromRecruitingRecord(
          recruiting as Record<string, unknown> | null | undefined
        );
        const ufRpmPct =
          recruiting?.ufRpmPct != null && Number(recruiting.ufRpmPct) > 0
            ? Math.round(Number(recruiting.ufRpmPct))
            : null;
        const delta7d = mergedDelta7dBySlug.get(slug) ?? model?.delta ?? 0;
        const movementDelta = delta7d;
        const fitScore = Math.round(model?.ufFitScore ?? target.rating ?? compositeScore ?? 0);
        const staffConfidence = Math.round(
          model?.fitScoreBreakdown?.staff ??
            (ufProbability > 0 ? Math.min(100, ufProbability * 0.85) : 0)
        );

        const priorityScore =
          Math.round(
            (ufProbability * 0.5 +
              fitScore * 0.2 +
              staffConfidence * 0.2 +
              Math.max(0, movementDelta) * 0.1) *
              100
          ) / 100;

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
          stars: target.stars ?? rank?.stars ?? null,
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
          visitHistory: buildVisitHistory(target, recruiting),
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

      const sorted = [...playersWithVerifiedVisits].sort((a, b) => b.priorityScore - a.priorityScore);
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
          storePct:
            seed?.ufProbability ??
            recruiting?.ufProbability ??
            recruiting?.futurecastProbability,
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
  if (isUnderclassmenHighPriorityYear(classYear)) {
    return buildUnderclassmenHighPriorityPayload(classYear);
  }
  return buildClosingClassHighPriorityPayload(classYear);
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
    await sendCachedJson(res, cacheKey, () => buildHighPriorityPayload(classYear));
  } catch (err) {
    handlePredictionsApiError(res, err);
  }
});

export { allowlist2028Rank, compareUnderclassmenHighPriority };
