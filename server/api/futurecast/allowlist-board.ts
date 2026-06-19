/**
 * FutureCast board data — ONLY verified 2027 allow-list players.
 * Player card metrics: see client/lib/futurecast-elite-metrics.ts
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  calculateVolatility,
  listMovementHistoryByPlayerIds,
  listPredictions,
  listStockBoardRows,
  VOLATILITY_WINDOW_DAYS,
} from '../../models/predictions';
import { loadRecruitingRankings } from '../../lib/load-recruiting-rankings';
import {
  dedupeFeedRows,
  filterModelPredictionsOnly,
  filterMovementIntelStockRows,
  FUTURECAST_CLASS_YEAR,
} from './feed-filters';
import { serializeFeedRowsWithVolatility } from '../predictions/utils-api';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { ALLOWLIST_2027, CANONICAL_TARGET_NAMES } = require('../../lib/recruiting-target-allowlist');
const { filterBlockedRecruits, isBlockedRecruit } = require('../../lib/recruiting-blocked-players');

const TARGET_BOARD_PATH = path.join(__dirname, '../../data/recruiting/2027-target-board.json');
const RECRUITING_PLAYERS_PATH = path.join(__dirname, '../../data/recruiting/players.json');
const RIVALS_PREDICTIONS_PATH = path.join(__dirname, '../../data/war-room/rivals-predictions.json');
const MOVEMENT_WINDOW_DAYS = 7;

function isFloridaSchool(value: string | null | undefined): boolean {
  if (!value) return false;
  return /\bflorida\b|\bgators\b/i.test(String(value).replace(/\s+/g, ' ').trim());
}

function seedCommittedTo(seed: Record<string, unknown>): string | null {
  const raw = seed.committedTo ?? seed.committed_to ?? null;
  return raw != null ? String(raw) : null;
}

function loadRivalsCompetingSchools(): Map<string, { name: string; pct: number }[]> {
  try {
    const doc = JSON.parse(fs.readFileSync(RIVALS_PREDICTIONS_PATH, 'utf8')) as {
      predictions?: Array<{ playerSlug?: string; predictionSchool?: string; confidence?: number }>;
    };
    const bySlug = new Map<string, Map<string, number>>();
    for (const row of doc.predictions ?? []) {
      const slug = String(row.playerSlug || '').toLowerCase();
      const school = String(row.predictionSchool || '').trim();
      if (!slug || !school) continue;
      const schools = bySlug.get(slug) ?? new Map<string, number>();
      schools.set(school, Math.max(schools.get(school) ?? 0, Number(row.confidence) || 0));
      bySlug.set(slug, schools);
    }
    const out = new Map<string, { name: string; pct: number }[]>();
    for (const [slug, schools] of bySlug) {
      const entries = [...schools.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
      const total = entries.reduce((sum, [, score]) => sum + score, 0) || 1;
      out.set(
        slug,
        entries.map(([name, score]) => ({ name, pct: Math.round((score / total) * 100) }))
      );
    }
    return out;
  } catch {
    return new Map();
  }
}

function rivalsPredictors(
  slug: string,
  schools: { name: string; pct: number }[]
): Array<{ name: string; score: number }> {
  return schools.map((s) => ({ name: s.name, score: s.pct }));
}

export type FutureCastPriority = 'high' | 'medium' | 'low';

export interface FutureCastBoardPlayer {
  id: string;
  slug: string;
  name: string;
  classYear: 2027;
  position: string;
  school?: string | null;
  hometown?: string | null;
  state?: string | null;
  composite: number;
  stars: number;
  natlRank?: number | null;
  posRank?: number | null;
  stateRank?: number | null;
  /** UF % (Likelihood) — FutureCast commit likelihood for Florida. */
  ufConfidence: number;
  /** Fit % (Scheme Match) — scheme, roster, and athletic fit. */
  fitScore: number;
  trendDelta7d: number;
  volatility7d: number;
  /** Priority tier tag; numeric Priority Score is on high-priority API. */
  priority: FutureCastPriority;
  committedTo?: string | null;
  predictors?: Array<{ name: string; score: number }>;
  competingSchools?: Array<{ name: string; pct: number }>;
}

export interface MovementHeatmapData {
  upCount: number;
  downCount: number;
  flatCount: number;
  windowDays: number;
}

function toPercent(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value)) return 0;
  const n = Number(value);
  return n <= 1 ? Math.round(n * 1000) / 10 : Math.round(n * 10) / 10;
}

function resolvePriority(ufConfidence: number, fitScore: number): FutureCastPriority {
  const score = ufConfidence * 0.6 + fitScore * 0.4;
  if (score >= 55 || ufConfidence >= 60) return 'high';
  if (score >= 35 || ufConfidence >= 40) return 'medium';
  return 'low';
}

function loadSeedMeta(): Map<string, Record<string, unknown>> {
  const map = new Map<string, Record<string, unknown>>();
  try {
    const board = JSON.parse(fs.readFileSync(TARGET_BOARD_PATH, 'utf8')) as {
      targets?: Array<Record<string, unknown>>;
    };
    for (const t of board.targets ?? []) {
      const slug = String(t.slug || '').toLowerCase();
      if (slug) map.set(slug, t);
    }
  } catch {
    /* optional */
  }
  try {
    const players = JSON.parse(fs.readFileSync(RECRUITING_PLAYERS_PATH, 'utf8')) as Array<
      Record<string, unknown>
    >;
    for (const p of players) {
      const slug = String(p.slug || '').toLowerCase();
      if (slug && !map.has(slug)) map.set(slug, p);
    }
  } catch {
    /* optional */
  }
  return map;
}

function buildHeatmap(players: FutureCastBoardPlayer[]): MovementHeatmapData {
  let upCount = 0;
  let downCount = 0;
  let flatCount = 0;
  for (const p of players) {
    if (p.trendDelta7d > 0) upCount += 1;
    else if (p.trendDelta7d < 0) downCount += 1;
    else flatCount += 1;
  }
  return { upCount, downCount, flatCount, windowDays: MOVEMENT_WINDOW_DAYS };
}

/** Sync allow-list slug set — use for filtering other FutureCast endpoints. */
export function getAllowlistSlugSet(): Set<string> {
  return new Set(
    filterBlockedRecruits(ALLOWLIST_2027.map((slug: string) => ({ slug }))).map((p) =>
      String(p.slug).toLowerCase()
    )
  );
}

export function buildHeatmapResponse(players: FutureCastBoardPlayer[]) {
  const heatmap = buildHeatmap(players);
  return {
    buckets: [
      { label: 'Up', count: heatmap.upCount },
      { label: 'Down', count: heatmap.downCount },
      { label: 'Flat', count: heatmap.flatCount },
    ],
    windowDays: heatmap.windowDays,
    movementHeatmap: {
      upCount: heatmap.upCount,
      downCount: heatmap.downCount,
      flatCount: heatmap.flatCount,
    },
  };
}

export async function buildAllowlistHeatmapPayload() {
  const players = await loadAllowlistedBoardPlayers();
  return buildHeatmapResponse(players);
}

export async function loadAllowlistedBoardPlayers(): Promise<FutureCastBoardPlayer[]> {
  const allowedSlugs = filterBlockedRecruits(
    ALLOWLIST_2027.map((slug: string) => ({ slug, name: CANONICAL_TARGET_NAMES[slug] }))
  ).map((p) => String(p.slug).toLowerCase());

  const allowedSet = new Set(allowedSlugs);
  const rankings = loadRecruitingRankings();
  const seedMeta = loadSeedMeta();
  const rivalsSchools = loadRivalsCompetingSchools();

  const [stockRowsRaw, predictionRows] = await Promise.all([
    listStockBoardRows(MOVEMENT_WINDOW_DAYS, {
      lifecycle: 'HS',
      class_year: FUTURECAST_CLASS_YEAR,
    }),
    listPredictions({
      class_year: FUTURECAST_CLASS_YEAR,
      status: 'ACTIVE',
      lifecycle: 'HS',
      limit: 500,
    }),
  ]);

  const stockRows = filterMovementIntelStockRows(stockRowsRaw).filter((row) =>
    allowedSet.has(String(row.slug || '').toLowerCase())
  );
  const stockBySlug = new Map(stockRows.map((row) => [String(row.slug).toLowerCase(), row]));

  const modelRows = dedupeFeedRows(filterModelPredictionsOnly(predictionRows)).filter((row) =>
    allowedSet.has(String(row.slug || '').toLowerCase())
  );
  const serialized = await serializeFeedRowsWithVolatility(modelRows);
  const predictionBySlug = new Map(
    serialized.map((row) => [String(row.playerSlug || '').toLowerCase(), row])
  );

  const playerIds = serialized.map((p) => p.playerId).filter(Boolean);
  const historyMap = await listMovementHistoryByPlayerIds(playerIds, VOLATILITY_WINDOW_DAYS);

  const players: FutureCastBoardPlayer[] = [];

  for (const slug of allowedSlugs) {
    if (isBlockedRecruit({ slug })) continue;

    const seed = seedMeta.get(slug) ?? {};
    const rank = rankings.get(slug);
    const stock = stockBySlug.get(slug);
    const model = predictionBySlug.get(slug);

    const name =
      String(seed.name || CANONICAL_TARGET_NAMES[slug] || slug).trim() ||
      CANONICAL_TARGET_NAMES[slug] ||
      slug;

    const trendDelta7d = stock?.window_delta ?? model?.delta ?? 0;
    const history = model?.playerId ? historyMap.get(model.playerId) ?? [] : [];
    const volatility7d =
      history.length > 0
        ? Math.round(calculateVolatility(history) * 100) / 100
        : Math.round(Math.abs(trendDelta7d) * 100) / 100;

    const committedTo = seedCommittedTo(seed) ?? model?.committedTo ?? null;
    const ufCommitted = isFloridaSchool(committedTo);
    let ufConfidence = toPercent(model?.confidence ?? model?.ufProbability ?? seed.ufProbability);
    if (ufCommitted) ufConfidence = 100;

    const competingSchools = rivalsSchools.get(slug) ?? [];
    const predictors = rivalsPredictors(slug, competingSchools);
    const fitScore = Math.round(
      model?.ufFitScore ?? Number(seed.rating ?? rank?.compositeScore ?? 0)
    );

    players.push({
      id: model?.playerId ?? slug,
      slug,
      name,
      classYear: FUTURECAST_CLASS_YEAR as 2027,
      position: String(
        seed.pos || seed.position || model?.position || rank?.position || '—'
      ).toUpperCase(),
      school: (seed.school as string) ?? model?.school ?? null,
      hometown: (seed.hometown as string) ?? null,
      state: (seed.state as string) ?? rank?.state ?? null,
      composite: Math.round((rank?.compositeScore ?? Number(seed.rating ?? 0)) * 100) / 100,
      stars: Number(rank?.stars ?? seed.stars ?? 0) || 0,
      natlRank: rank?.nationalRank ?? (seed.natlRank as number) ?? null,
      posRank: rank?.positionRank ?? (seed.posRank as number) ?? null,
      stateRank: rank?.stateRank ?? (seed.stateRank as number) ?? null,
      ufConfidence,
      fitScore,
      trendDelta7d: Math.round(trendDelta7d * 1000) / 1000,
      volatility7d,
      priority: resolvePriority(ufConfidence, fitScore),
      committedTo,
      predictors,
      competingSchools,
    });
  }

  return players.sort((a, b) => b.ufConfidence - a.ufConfidence);
}

export async function buildMasterBoardPayload() {
  const players = await loadAllowlistedBoardPlayers();
  const heatmap = buildHeatmap(players);

  const trendingUp = [...players]
    .filter((p) => p.trendDelta7d > 0)
    .sort((a, b) => b.trendDelta7d - a.trendDelta7d);

  const trendingDown = [...players]
    .filter((p) => p.trendDelta7d < 0)
    .sort((a, b) => a.trendDelta7d - b.trendDelta7d);

  const activeTargets = players.filter((p) => !isFloridaSchool(p.committedTo ?? null));

  const highVolatility = [...activeTargets]
    .filter((p) => p.volatility7d >= 0.15)
    .sort((a, b) => b.volatility7d - a.volatility7d);

  const highPriority = [...players]
    .filter((p) => p.priority === 'high')
    .sort((a, b) => b.ufConfidence - a.ufConfidence);

  const commitWatch = [...players]
    .filter((p) => p.ufConfidence >= 50 && p.trendDelta7d > 0)
    .sort((a, b) => b.ufConfidence + b.trendDelta7d - (a.ufConfidence + a.trendDelta7d))
    .slice(0, 3)
    .map((p) => ({
      playerId: p.id,
      slug: p.slug,
      name: p.name,
      ufConfidence: p.ufConfidence,
      recentMovement: p.trendDelta7d,
    }));

  const ufConfidenceAverage =
    players.length > 0
      ? Math.round((players.reduce((sum, p) => sum + p.ufConfidence, 0) / players.length) * 10) / 10
      : 0;

  const confidenceSparkline = players
    .slice(0, 12)
    .map((p) => p.ufConfidence);

  return {
    classYear: FUTURECAST_CLASS_YEAR,
    updatedAt: new Date().toISOString(),
    movementHeatmap: {
      upCount: heatmap.upCount,
      downCount: heatmap.downCount,
      flatCount: heatmap.flatCount,
    },
    heatmap: {
      buckets: [
        { label: 'Up', count: heatmap.upCount },
        { label: 'Down', count: heatmap.downCount },
        { label: 'Flat', count: heatmap.flatCount },
      ],
      windowDays: heatmap.windowDays,
    },
    ufConfidenceAverage,
    confidenceSparkline,
    commitWatch,
    highPriority: {
      playerIds: highPriority.map((p) => p.id),
      players: highPriority.slice(0, 10),
    },
    movementSummary: {
      risers: trendingUp.slice(0, 8).map((p) => p.id),
      fallers: trendingDown.slice(0, 8).map((p) => p.id),
      highVolatility: highVolatility.slice(0, 8).map((p) => p.id),
      riserPlayers: trendingUp.slice(0, 8),
      fallerPlayers: trendingDown.slice(0, 8),
      volatilePlayers: highVolatility.slice(0, 8),
    },
    players,
  };
}

export async function buildTrendingBoardPayload() {
  const players = await loadAllowlistedBoardPlayers();
  return {
    classYear: FUTURECAST_CLASS_YEAR,
    updatedAt: new Date().toISOString(),
    trendingUp: players.filter((p) => p.trendDelta7d > 0).sort((a, b) => b.trendDelta7d - a.trendDelta7d),
    trendingDown: players.filter((p) => p.trendDelta7d < 0).sort((a, b) => a.trendDelta7d - b.trendDelta7d),
  };
}

export async function buildMovementIntelPayload() {
  const players = await loadAllowlistedBoardPlayers();
  const activeTargets = players.filter((p) => !isFloridaSchool(p.committedTo ?? null));
  const heatmap = buildHeatmap(activeTargets);

  const risers = activeTargets.filter((p) => p.trendDelta7d > 0).sort((a, b) => b.trendDelta7d - a.trendDelta7d);
  const fallers = activeTargets.filter((p) => p.trendDelta7d < 0).sort((a, b) => a.trendDelta7d - b.trendDelta7d);
  const highVolatility = [...activeTargets]
    .filter((p) => p.volatility7d >= 0.15)
    .sort((a, b) => b.volatility7d - a.volatility7d);
  const stable = activeTargets
    .filter((p) => p.volatility7d < 0.1 && Math.abs(p.trendDelta7d) < 0.05)
    .sort((a, b) => b.ufConfidence - a.ufConfidence);
  const fitScoreLeaders = [...activeTargets].sort((a, b) => b.fitScore - a.fitScore);
  const fitScoreRisks = [...activeTargets].sort((a, b) => a.fitScore - b.fitScore);

  let alerts: { id: string; message: string; createdAt: string }[] = [];
  try {
    const { listAlerts } = await import('../../models/alerts');
    const raw = await listAlerts(8, FUTURECAST_CLASS_YEAR);
    const allowedSet = new Set(ALLOWLIST_2027);
    alerts = raw
      .filter((a) => !a.playerSlug || allowedSet.has(String(a.playerSlug).toLowerCase()))
      .map((a) => ({
        id: a.id,
        message: a.message || a.title || 'Movement alert',
        createdAt: a.createdAt || new Date().toISOString(),
      }));
  } catch {
    /* optional */
  }

  return {
    classYear: FUTURECAST_CLASS_YEAR,
    updatedAt: new Date().toISOString(),
    movementHeatmap: {
      upCount: heatmap.upCount,
      downCount: heatmap.downCount,
      flatCount: heatmap.flatCount,
    },
    heatmap: {
      buckets: [
        { label: 'Up', count: heatmap.upCount },
        { label: 'Down', count: heatmap.downCount },
        { label: 'Flat', count: heatmap.flatCount },
      ],
      windowDays: heatmap.windowDays,
    },
    risers,
    fallers,
    highVolatility,
    stable,
    fitScoreLeaders,
    fitScoreRisks,
    alerts,
  };
}

export async function findAllowlistedPlayer(idOrSlug: string): Promise<FutureCastBoardPlayer | null> {
  const key = String(idOrSlug || '').toLowerCase();
  const players = await loadAllowlistedBoardPlayers();
  return players.find((p) => p.id === idOrSlug || p.slug === key) ?? null;
}
