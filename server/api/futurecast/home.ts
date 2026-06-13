/**
 * GET /api/futurecast/home — grouped 2027-cycle homepage sections.
 */
import type { Request, Response } from 'express';
import {
  computeDepthChartRisk,
  computePortalLikelihood,
  computeVolatility,
} from '../portal/engine';
import { listPortalCandidates, portalRowToEngineInput } from '../../models/portal-intel';
import { listPredictions, listStockBoardRows } from '../../models/predictions';
import {
  asyncHandler,
  handlePredictionsApiError,
  serializeFeedRowsWithVolatility,
  serializeStockRowsWithVolatility,
} from '../predictions/utils-api';
import { isFutureCastEligible, isUfCommitRow } from './eligibility';
import {
  dedupeFeedRows,
  filterModelPredictionsOnly,
  filterTrendingStockRows,
  FUTURECAST_CLASS_YEAR,
  partitionHomepagePredictions,
} from './feed-filters';
import { isHsLifecycle, isTrendingEligibleRow } from './eligibility';
import { applyMomentumBoosts, loadSignalMomentumBoosts } from './momentum';
import { listRecruitingStoreCommits, mergeLiveCommits } from './live-commits';

const MOVEMENT_WINDOW_DAYS = 7;
const SECTION_LIMIT = 12;
const PORTAL_LIMIT = 8;

function normalizeSlug(value: string | null | undefined): string {
  if (!value) return '';
  try {
    return decodeURIComponent(String(value)).toLowerCase().trim();
  } catch {
    return String(value).toLowerCase().trim();
  }
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

function sortCommits(
  rows: Awaited<ReturnType<typeof serializeFeedRowsWithVolatility>>,
  sortBy: 'fit' | 'stability'
) {
  return [...rows].sort((a, b) => {
    if (sortBy === 'stability') {
      return (b.stabilityScore ?? 0) - (a.stabilityScore ?? 0);
    }
    return (b.ufFitScore ?? 0) - (a.ufFitScore ?? 0);
  });
}

function sortTargets(rows: Awaited<ReturnType<typeof serializeFeedRowsWithVolatility>>) {
  return [...rows].sort((a, b) => (b.ufProbability ?? b.confidence) - (a.ufProbability ?? a.confidence));
}

export const handleGetFutureCastHome = asyncHandler(async (req: Request, res: Response) => {
  try {
    const commitSort =
      req.query.commitSort === 'stability' ? ('stability' as const) : ('fit' as const);

    const [predictionRows, movementRows, portalRows] = await Promise.all([
      listPredictions({
        class_year: FUTURECAST_CLASS_YEAR,
        status: 'ACTIVE',
        lifecycle: 'HS',
        limit: 500,
      }),
      listStockBoardRows(MOVEMENT_WINDOW_DAYS, {
        lifecycle: 'HS',
        class_year: FUTURECAST_CLASS_YEAR,
      }),
      listPortalCandidates({ class_year: FUTURECAST_CLASS_YEAR }),
    ]);

    const modelRows = dedupeFeedRows(filterModelPredictionsOnly(predictionRows));
    const serialized = await serializeFeedRowsWithVolatility(modelRows);
    const { commits: modelCommits, topTargets } = partitionHomepagePredictions(serialized);
    const liveCommits = await listRecruitingStoreCommits(FUTURECAST_CLASS_YEAR);
    const commits = mergeLiveCommits(modelCommits, liveCommits);

    const commitSlugs = new Set<string>();
    for (const row of commits) {
      if (row.playerSlug) commitSlugs.add(normalizeSlug(row.playerSlug));
      if (row.playerId) commitSlugs.add(normalizeSlug(row.playerId));
    }
    const trendingMovement = filterTrendingStockRows(movementRows).filter(
      (row) => !commitSlugs.has(normalizeSlug(row.slug))
    );
    const playerIds = trendingMovement.map((row) => row.player_id);
    const signalBoosts = await loadSignalMomentumBoosts(MOVEMENT_WINDOW_DAYS, playerIds);
    const enrichedMovement = applyMomentumBoosts(trendingMovement, signalBoosts);

    const upRows = enrichedMovement
      .filter((row) => row.window_delta > 0)
      .sort((a, b) => b.window_delta - a.window_delta)
      .slice(0, SECTION_LIMIT);
    const downRows = enrichedMovement
      .filter((row) => row.window_delta < 0)
      .sort((a, b) => a.window_delta - b.window_delta)
      .slice(0, SECTION_LIMIT);

    const [trendingUp, trendingDown] = await Promise.all([
      serializeStockRowsWithVolatility(upRows),
      serializeStockRowsWithVolatility(downRows),
    ]);

    const hsTrendingUp = trendingUp.filter(
      (row) =>
        isHsLifecycle(row) &&
        isTrendingEligibleRow({
          lifecycle: row.lifecycle,
          committed_to: row.committedTo,
          uf_status: row.ufStatus,
        }) &&
        !commitSlugs.has(normalizeSlug(row.playerSlug)) &&
        !isUfCommitRow({
          lifecycle: row.lifecycle,
          committedTo: row.committedTo,
          ufStatus: row.ufStatus,
        })
    );
    const hsTrendingDown = trendingDown.filter(
      (row) =>
        isHsLifecycle(row) &&
        isTrendingEligibleRow({
          lifecycle: row.lifecycle,
          committed_to: row.committedTo,
          uf_status: row.ufStatus,
        }) &&
        !commitSlugs.has(normalizeSlug(row.playerSlug)) &&
        !isUfCommitRow({
          lifecycle: row.lifecycle,
          committedTo: row.committedTo,
          ufStatus: row.ufStatus,
        })
    );

    const portalWatchlist = portalRows
      .filter((row) => row.lifecycle === 'PORTAL' || row.lifecycle === 'COLLEGE')
      .filter((row) =>
        isFutureCastEligible({
          class_year: row.class_year,
          lifecycle: row.lifecycle,
          committed_to: row.committed_to,
        })
      )
      .map((row) => {
        const input = portalRowToEngineInput(row);
        return {
          id: row.id,
          fullName: row.full_name,
          slug: row.slug,
          position: row.position,
          classYear: row.class_year,
          portalLikelihood: computePortalLikelihood(input),
          depthChartRisk: computeDepthChartRisk(input),
          volatility: computeVolatility(input),
        };
      })
      .filter((p) => p.portalLikelihood >= 0.35)
      .sort((a, b) => b.portalLikelihood - a.portalLikelihood)
      .slice(0, PORTAL_LIMIT)
      .map((p, index) => ({
        ...p,
        portalLikelihood: Math.round(p.portalLikelihood * 100),
        rank: index + 1,
      }));

    res.json({
      classYear: FUTURECAST_CLASS_YEAR,
      commitSort,
      heatmap: {
        buckets: buildHeatmapBuckets(enrichedMovement),
        windowDays: MOVEMENT_WINDOW_DAYS,
      },
      commits: sortCommits(commits, commitSort).slice(0, SECTION_LIMIT),
      topTargets: sortTargets(topTargets).slice(0, SECTION_LIMIT),
      trendingUp: hsTrendingUp,
      trendingDown: hsTrendingDown,
      portalWatchlist,
    });
  } catch (err) {
    handlePredictionsApiError(res, err);
  }
});
