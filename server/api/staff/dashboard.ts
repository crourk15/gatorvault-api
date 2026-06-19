/**
 * GET /api/staff/dashboard — internal FutureCast control room aggregates.
 */
import type { Request, Response } from 'express';
import { createRequire } from 'node:module';
import { listAlerts } from '../../models/alerts';
import {
  listRollingMovement,
  MOVEMENT_VOLATILITY_THRESHOLD,
  ROLLING_MOVEMENT_WINDOW_DAYS,
  VOLATILITY_WINDOW_DAYS,
} from '../../models/predictions';
import { listCompetingVolatilityBoosts } from '../../models/competing-school-history';
import { db } from '../../models/db';
import {
  asyncHandler,
  handlePredictionsApiError,
} from '../predictions/utils-api';
import { isFutureCastDataError, respondDatabaseUnavailable } from '../futurecast/db-fallback';
import { MOVEMENT_INTEL_MIN_CLASS_YEAR } from '../futurecast/eligibility';
import { filterMovementIntelRollingRows } from '../futurecast/feed-filters';

const require = createRequire(import.meta.url);
const { filterMovementRowsToLiveTargets } = require('../../lib/live-board-targets');

const LIST_LIMIT = 10;
const MOVEMENT_FILTERS = {
  lifecycle: 'HS' as const,
  min_class_year: MOVEMENT_INTEL_MIN_CLASS_YEAR,
};

export interface StaffDashboardPlayer {
  id: string;
  slug: string;
  name: string;
  delta?: number;
  delta7d?: number;
  volatilityScore?: number;
  ufFitScore?: number | null;
}

function movementPlayers(
  rows: Awaited<ReturnType<typeof listRollingMovement>>,
  direction: 'up' | 'down',
  limit: number
): StaffDashboardPlayer[] {
  const filtered =
    direction === 'up'
      ? rows.filter((row) => row.delta7d >= 5)
      : rows.filter((row) => row.delta7d <= -5);

  const sorted =
    direction === 'up'
      ? filtered.sort((a, b) => b.delta7d - a.delta7d)
      : filtered.sort((a, b) => a.delta7d - b.delta7d);

  return sorted.slice(0, limit).map((row) => ({
    id: row.playerId,
    slug: row.slug,
    name: row.fullName,
    delta: row.delta7d,
    delta7d: row.delta7d,
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
      AND p.class_year >= $2
    ORDER BY uf.uf_fit_score ${order === 'desc' ? 'DESC' : 'ASC'}
    LIMIT $1
    `,
    [limit, MOVEMENT_INTEL_MIN_CLASS_YEAR]
  );

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.full_name,
    ufFitScore: row.uf_fit_score,
  }));
}

function volatilityPlayersFromRolling(
  rows: Awaited<ReturnType<typeof listRollingMovement>>,
  direction: 'high' | 'low',
  limit: number
): StaffDashboardPlayer[] {
  const sorted = [...rows].sort((a, b) =>
    direction === 'high'
      ? b.volatilityScore - a.volatilityScore
      : a.volatilityScore - b.volatilityScore
  );

  const out: StaffDashboardPlayer[] = [];
  for (const row of sorted) {
    if (out.some((p) => p.id === row.playerId)) continue;
    out.push({
      id: row.playerId,
      slug: row.slug,
      name: row.fullName,
      volatilityScore: row.volatilityScore,
      delta7d: row.delta7d,
    });
    if (out.length >= limit) break;
  }
  return out;
}

function buildHeatmapBuckets(rows: Awaited<ReturnType<typeof listRollingMovement>>) {
  let upCount = 0;
  let downCount = 0;
  let flatCount = 0;

  for (const row of rows) {
    if (row.delta7d >= 5) upCount += 1;
    else if (row.delta7d <= -5) downCount += 1;
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
    const boosts = await listCompetingVolatilityBoosts(ROLLING_MOVEMENT_WINDOW_DAYS).catch(
      () => new Map<string, number>()
    );
    const movementRowsRaw = await listRollingMovement(MOVEMENT_FILTERS, boosts);
    const movementRowsFiltered = filterMovementIntelRollingRows(movementRowsRaw);
    const movementRows = await filterMovementRowsToLiveTargets(movementRowsFiltered, 2027);
    const [fitLeaders, fitRisks] = await Promise.all([
      listFitScorePlayers('desc', LIST_LIMIT),
      listFitScorePlayers('asc', LIST_LIMIT),
    ]);
    const volatilityHigh = volatilityPlayersFromRolling(movementRows, 'high', LIST_LIMIT);
    const volatilityLow = volatilityPlayersFromRolling(movementRows, 'low', LIST_LIMIT);

    let alerts: Awaited<ReturnType<typeof listAlerts>> = [];
    try {
      alerts = await listAlerts(LIST_LIMIT, MOVEMENT_INTEL_MIN_CLASS_YEAR);
    } catch (alertErr) {
      if (!isFutureCastDataError(alertErr)) throw alertErr;
    }

    res.json({
      topRisers: movementPlayers(movementRows, 'up', LIST_LIMIT),
      topFallers: movementPlayers(movementRows, 'down', LIST_LIMIT),
      highVolatility: volatilityHigh,
      lowVolatility: volatilityLow,
      fitLeaders,
      fitRisks,
      heatmap: {
        buckets: buildHeatmapBuckets(movementRows),
        windowDays: ROLLING_MOVEMENT_WINDOW_DAYS,
      },
      alerts,
      movementWindowDays: ROLLING_MOVEMENT_WINDOW_DAYS,
      volatilityWindowDays: VOLATILITY_WINDOW_DAYS,
      lastUpdated: new Date().toISOString(),
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
        heatmap: { buckets: [], windowDays: ROLLING_MOVEMENT_WINDOW_DAYS },
        alerts: [],
        movementWindowDays: ROLLING_MOVEMENT_WINDOW_DAYS,
        volatilityWindowDays: VOLATILITY_WINDOW_DAYS,
        lastUpdated: new Date().toISOString(),
      }, err);
      return;
    }
    handlePredictionsApiError(res, err);
  }
});
