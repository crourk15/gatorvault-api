/**
 * Build enriched recruit payloads for /api/recruits.
 */
import { createRequire } from 'node:module';
import {
  listMovementHistoryByPlayerIds,
  listPredictions,
  VOLATILITY_WINDOW_DAYS,
} from '../../models/predictions';
import {
  dedupeFeedRows,
  filterFutureCastFeedRows,
  filterModelPredictionsOnly,
  FUTURECAST_CLASS_YEAR,
} from '../futurecast/feed-filters';
import { enrichWithRankings } from '../futurecast/ranking-enrichment';
import {
  serializeFeedRowsWithVolatility,
} from '../predictions/utils-api';

const require = createRequire(import.meta.url);

export interface RecruitRecord {
  id: string;
  slug: string;
  name: string;
  position: string | null;
  classYear: number;
  school: string | null;
  stars: number | null;
  category: string | null;
  committedTo: string | null;
  compositeScore: number;
  nationalRank: number | null;
  positionRank: number | null;
  stateRank: number | null;
  rating: number | null;
  natlRank: number | null;
  posRank: number | null;
  ufProbability: number;
  fitScore: number;
  stability: number | null;
  stabilityScore: number | null;
  movementDelta: number;
  delta: number;
  movement: number;
  classScoreImpact: number | null;
  trendHistory: Array<{ date: string; confidence: number }>;
}

function toPercent(value: unknown): number {
  if (value == null || !Number.isFinite(Number(value))) return 0;
  const n = Number(value);
  return n <= 1 ? Math.round(n * 1000) / 10 : Math.round(n * 10) / 10;
}

async function loadPredictionMaps(classYear: number) {
  try {
    let rows = await listPredictions({
      class_year: classYear,
      status: 'ACTIVE',
      lifecycle: 'HS',
      limit: 500,
    });
    rows = filterFutureCastFeedRows(filterModelPredictionsOnly(rows));
    rows = dedupeFeedRows(rows);
    const serialized = await serializeFeedRowsWithVolatility(rows);

    const bySlug = new Map<string, (typeof serialized)[number]>();
    for (const row of serialized) {
      if (row.playerSlug) bySlug.set(row.playerSlug, row);
    }

    const playerIds = serialized.map((r) => r.playerId);
    const historyMap = await listMovementHistoryByPlayerIds(playerIds, VOLATILITY_WINDOW_DAYS);

    return { bySlug, historyMap };
  } catch {
    return {
      bySlug: new Map<string, never>(),
      historyMap: new Map<string, Array<{ date: string; confidence: number }>>(),
    };
  }
}

function buildRecruitRecord(
  player: Record<string, unknown>,
  classScoreImpact: number | null,
  bySlug: Map<string, { playerId: string; confidence: number; ufFitScore?: number | null; delta?: number; stabilityScore?: number }>,
  historyMap: Map<string, Array<{ date: string; confidence: number }>>
): RecruitRecord {
  const slug = String(player.slug || player.id || '');
  const model = bySlug.get(slug);
  const enriched = enrichWithRankings({
    slug,
    id: player.id ?? slug,
    name: player.name,
    rating: player.rating,
    natlRank: player.natlRank,
    posRank: player.posRank,
    stateRank: player.stateRank,
  });

  const ufProbability = toPercent(model?.confidence ?? player.ufProbability);
  const movementDelta = model?.delta ?? 0;

  return {
    id: String(player.id ?? slug),
    slug,
    name: String(player.name ?? ''),
    position: (player.pos as string) ?? (player.position as string) ?? null,
    classYear: Number(player.classYear) || FUTURECAST_CLASS_YEAR,
    school: (player.school as string) ?? null,
    stars: player.stars != null ? Number(player.stars) : null,
    category: (player.category as string) ?? null,
    committedTo: (player.committedTo as string) ?? null,
    compositeScore: enriched.compositeScore,
    nationalRank: enriched.nationalRank,
    positionRank: enriched.positionRank,
    stateRank: enriched.stateRank,
    rating: enriched.rating ?? null,
    natlRank: enriched.natlRank ?? null,
    posRank: enriched.posRank ?? null,
    ufProbability,
    fitScore: Math.round(model?.ufFitScore ?? Number(player.fitScore) ?? enriched.compositeScore ?? 0),
    stability: model?.stabilityScore ?? null,
    stabilityScore: model?.stabilityScore ?? null,
    movementDelta,
    delta: movementDelta,
    movement: movementDelta,
    classScoreImpact,
    trendHistory: (historyMap.get(model?.playerId ?? '') ?? []).map((h) => ({
      date: h.date,
      confidence: h.confidence,
    })),
  };
}

export async function listRecruitsForClassYear(classYear: number): Promise<{
  classYear: number;
  classScoreImpact: number | null;
  recruits: RecruitRecord[];
}> {
  const store = require('../../lib/recruiting-store');
  const board = await store.getBoard(classYear);
  const players = [...(board.commits || []), ...(board.targets || [])];
  const classScoreImpact =
    board.rankings?.classScore != null
      ? Math.round(Number(board.rankings.classScore) * 100) / 100
      : null;

  const { bySlug, historyMap } = await loadPredictionMaps(classYear);
  const recruits = players.map((p: Record<string, unknown>) =>
    buildRecruitRecord(p, classScoreImpact, bySlug, historyMap)
  );

  return { classYear, classScoreImpact, recruits };
}

export async function getRecruitById(idOrSlug: string): Promise<RecruitRecord | null> {
  const store = require('../../lib/recruiting-store');
  const key = decodeURIComponent(idOrSlug).toLowerCase().trim();

  let player =
    (await store.getPlayerBySlug(key)) ||
    (await store.getAllPlayers()).find(
      (p: { id?: string; slug?: string }) =>
        String(p.id || '').toLowerCase() === key || String(p.slug || '').toLowerCase() === key
    );

  if (!player) return null;

  const classYear = Number(player.classYear) || FUTURECAST_CLASS_YEAR;
  const board = await store.getBoard(classYear);
  const classScoreImpact =
    board.rankings?.classScore != null
      ? Math.round(Number(board.rankings.classScore) * 100) / 100
      : null;

  const { bySlug, historyMap } = await loadPredictionMaps(classYear);
  return buildRecruitRecord(player, classScoreImpact, bySlug, historyMap);
}
