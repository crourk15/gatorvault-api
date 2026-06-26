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
const { resolveUfProbability, loadRivalsUfPctBySlug } = require('../../lib/uf-probability-utils');
const { buildFlipWatchRows } = require('../../lib/flip-watch-utils');
const intelStore = require('../../lib/recruiting-intel-store');
const RECRUITING_PLAYERS_PATH = path.join(__dirname, '../../data/recruiting/players.json');
const TARGET_BOARD_SEED_PATH = path.join(__dirname, '../../data/recruiting/2027-target-board.json');

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
  const board = await store.getBoard(FUTURECAST_CLASS_YEAR);
  return filterBlockedRecruits(
    (board.targets || []).map((p: Record<string, unknown>) => ({
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

export const handleGetFutureCastHighPriority = asyncHandler(async (req: Request, res: Response) => {
  try {
    const classYear = parseYear(req.query.year ?? req.query.class_year);
    if (classYear !== FUTURECAST_CLASS_YEAR) {
      res.status(400).json({ error: `Only ${FUTURECAST_CLASS_YEAR} cycle is supported` });
      return;
    }

    const cacheKey = highPriorityCacheKey(classYear);

    await sendCachedJson(res, cacheKey, async () => {
      const rankings = loadRecruitingRankings();
      const recruitingBySlug = loadRecruitingBySlug();
      const targetSeedBySlug = loadTargetSeedBySlug();
      const insiderBySlug = loadInsiderNotesBySlug();
      const targets = await loadTargetBoardFromStore();
      const rivalsUfBySlug = loadRivalsUfPctBySlug();
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
        const rivalsUf = rivalsUfBySlug.get(slug.toLowerCase()) ?? 0;
        if (rivalsUf > 0) {
          predictors.push({ name: 'Rivals PM', score: rivalsUf });
        }

        const resolvedUf = resolveUfProbability({
          modelPct: model?.confidence ?? model?.ufProbability,
          storePct: target.ufProbability ?? recruiting?.ufProbability ?? recruiting?.futurecastProbability,
          predictors,
          stars: target.stars ?? rank?.stars ?? null,
          headliner: Boolean(target.headliner),
        });
        const ufProbability = resolvedUf.value;
        const delta7d = delta7dBySlug.get(slug) ?? model?.delta ?? 0;
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

        const trendHistory = (historyMap.get(model?.playerId ?? '') ?? []).map((h) => ({
          date: h.date,
          confidence: h.confidence,
        }));

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
      const top10 = sorted.slice(0, 10);

      const visitIntel = buildVerifiedVisitIntelRows(playersWithVerifiedVisits, visitLogs);
      const visitRecap = buildVerifiedVisitRecapRows(playersWithVerifiedVisits, visitLogs, new Date(), {
        limit: 12,
        prioritySlugs: targetSlugs,
      });

      const commitBySlug = new Map<string, string>();
      const ufBySlug = new Map<string, number | null>();
      const nameBySlug = new Map<string, string>();
      for (const [slug, seed] of targetSeedBySlug.entries()) {
        const recruiting = recruitingBySlug.get(slug);
        const committedTo = resolveCommittedTo(seed, recruiting, seed);
        const key = slug.toLowerCase();
        if (committedTo) commitBySlug.set(key, committedTo);
        nameBySlug.set(key, seed.name);
        const model = predictionBySlug.get(slug);
        const resolvedUf = resolveUfProbability({
          modelPct: model?.confidence ?? model?.ufProbability,
          storePct: seed.ufProbability ?? recruiting?.ufProbability ?? recruiting?.futurecastProbability,
          predictors: [],
          stars: seed.stars ?? null,
          headliner: Boolean(seed.headliner),
        });
        ufBySlug.set(key, resolvedUf.value);
      }
      for (const p of playersWithVerifiedVisits) {
        const key = String(p.slug || '').toLowerCase();
        ufBySlug.set(key, p.ufProbability ?? ufBySlug.get(key) ?? null);
        nameBySlug.set(key, p.name);
        if (p.committedTo) commitBySlug.set(key, p.committedTo);
      }

      const flipWatchRaw = buildFlipWatchRows(playersWithVerifiedVisits, visitRecap, {
        visitLogs,
        intelRows: intelStore.loadIntelDoc().items || [],
        commitBySlug,
        ufBySlug,
        nameBySlug,
      });
      const movementNarrativeLib = require('../../lib/movement-narrative');
      const visitRecapEnriched = movementNarrativeLib.enrichVisitRecapRows(
        visitRecap,
        visitLogs,
        delta7dBySlug
      );
      const flipWatch = movementNarrativeLib.enrichFlipWatchRows(
        flipWatchRaw,
        visitLogs,
        delta7dBySlug
      );
      const movementNarratives = movementNarrativeLib.buildNarrativeFeed(
        playersWithVerifiedVisits,
        visitLogs,
        delta7dBySlug
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
    });
  } catch (err) {
    handlePredictionsApiError(res, err);
  }
});
