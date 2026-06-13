/**
 * GET /api/staff/dashboard — internal FutureCast control room aggregates.
 */
import type { Request, Response } from 'express';
import { listAlerts } from '../../models/alerts';
import {
  calculateVolatility,
  listMovementHistoryByPlayerIds,
  listPredictions,
  listStockBoardRows,
  VOLATILITY_WINDOW_DAYS,
} from '../../models/predictions';
import { db } from '../../models/db';
import {
  asyncHandler,
  handlePredictionsApiError,
} from '../predictions/utils-api';
import { isFutureCastDataError, respondDatabaseUnavailable } from '../futurecast/db-fallback';

const LIST_LIMIT = 10;
const MOVEMENT_WINDOW_DAYS = 7;

export interface StaffDashboardPlayer {
  id: string;
  slug: string;
  name: string;
  delta?: number;
  volatilityScore?: number;
  ufFitScore?: number | null;
}

function movementPlayers(
  rows: Awaited<ReturnType<typeof listStockBoardRows>>,
  direction: 'up' | 'down',
  limit: number
): StaffDashboardPlayer[] {
  const filtered =
    direction === 'up'
      ? rows.filter((row) => row.window_delta > 0)
      : rows.filter((row) => row.window_delta < 0);

  const sorted =
    direction === 'up'
      ? filtered.sort((a, b) => b.window_delta - a.window_delta)
      : filtered.sort((a, b) => a.window_delta - b.window_delta);

  return sorted.slice(0, limit).map((row) => ({
    id: row.player_id,
    slug: row.slug,
    name: row.full_name,
    delta: row.window_delta,
  }));
}

async function listFitScorePlayers(order: 'asc' | 'desc', limit: number): Promise<StaffDashboardPlayer[]> {
  const { rows } = await db.query<{
    id: string;
    slug: string;
    full_name: string;
    uf_fit_score: number | null;
  }>(
    `
    SELECT p.id, p.slug, p.full_name, uf.uf_fit_score
    FROM futurecast.players p
    JOIN futurecast.uf_specific_profiles uf ON uf.player_id = p.id
    WHERE uf.uf_fit_score IS NOT NULL
      AND p.status = 'HS'
    ORDER BY uf.uf_fit_score ${order === 'desc' ? 'DESC' : 'ASC'}
    LIMIT $1
    `,
    [limit]
  );

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.full_name,
    ufFitScore: row.uf_fit_score,
  }));
}

async function volatilityPlayers(
  direction: 'high' | 'low',
  limit: number
): Promise<StaffDashboardPlayer[]> {
  const rows = await listPredictions({ status: 'ACTIVE', lifecycle: 'HS', limit: 500 });
  const playerIds = [...new Set(rows.map((row) => row.player_id))];
  const historyMap = await listMovementHistoryByPlayerIds(playerIds, VOLATILITY_WINDOW_DAYS);

  const scored = rows.map((row) => ({
    row,
    volatilityScore: calculateVolatility(historyMap.get(row.player_id) ?? []),
  }));

  scored.sort((a, b) =>
    direction === 'high'
      ? b.volatilityScore - a.volatilityScore
      : a.volatilityScore - b.volatilityScore
  );

  const seen = new Set<string>();
  const out: StaffDashboardPlayer[] = [];

  for (const entry of scored) {
    if (seen.has(entry.row.player_id)) continue;
    seen.add(entry.row.player_id);
    out.push({
      id: entry.row.player_id,
      slug: entry.row.slug,
      name: entry.row.full_name,
      volatilityScore: entry.volatilityScore,
    });
    if (out.length >= limit) break;
  }

  return out;
}

function buildHeatmapBuckets(rows: Awaited<ReturnType<typeof listStockBoardRows>>) {
  let upCount = 0;
  let downCount = 0;
  let flatCount = 0;

  for (const row of rows) {
    if (row.window_delta > 0) upCount += 1;
    else if (row.window_delta < 0) downCount += 1;
    else flatCount += 1;
  }

  return [
    { label: 'Up', count: upCount },
    { label: 'Down', count: downCount },
    { label: 'Flat', count: flatCount },
  ];
}

export const handleGetStaffDashboard = asyncHandler(async (_req: Request, res: Response) => {
  try {
    const [movementRows, fitLeaders, fitRisks, alerts, volatilityHigh, volatilityLow] =
      await Promise.all([
        listStockBoardRows(MOVEMENT_WINDOW_DAYS, { lifecycle: 'HS' }),
        listFitScorePlayers('desc', LIST_LIMIT),
        listFitScorePlayers('asc', LIST_LIMIT),
        listAlerts(LIST_LIMIT),
        volatilityPlayers('high', LIST_LIMIT),
        volatilityPlayers('low', LIST_LIMIT),
      ]);

    res.json({
      topRisers: movementPlayers(movementRows, 'up', LIST_LIMIT),
      topFallers: movementPlayers(movementRows, 'down', LIST_LIMIT),
      highVolatility: volatilityHigh,
      lowVolatility: volatilityLow,
      fitLeaders,
      fitRisks,
      heatmap: {
        buckets: buildHeatmapBuckets(movementRows),
        windowDays: MOVEMENT_WINDOW_DAYS,
      },
      alerts,
      movementWindowDays: MOVEMENT_WINDOW_DAYS,
      volatilityWindowDays: VOLATILITY_WINDOW_DAYS,
    });
  } catch (err) {
    if (isFutureCastDataError(err)) {
      respondDatabaseUnavailable(res, {
        topRisers: [],
        topFallers: [],
        highVolatility: [],
        lowVolatility: [],
        fitLeaders: [],
        fitRisks: [],
        heatmap: { buckets: [], windowDays: MOVEMENT_WINDOW_DAYS },
        alerts: [],
        movementWindowDays: MOVEMENT_WINDOW_DAYS,
        volatilityWindowDays: VOLATILITY_WINDOW_DAYS,
      });
      return;
    }
    handlePredictionsApiError(res, err);
  }
});
