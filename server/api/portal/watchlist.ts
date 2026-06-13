/**
 * GET /api/portal/watchlist — elevated portal likelihood candidates.
 */
import type { Request, Response } from 'express';
import {
  computeDepthChartRisk,
  computePortalLikelihood,
  computeSnapShareScore,
  computeVolatility,
} from './engine';
import {
  listPortalCandidates,
  portalRowToEngineInput,
} from '../../models/portal-intel';
import {
  asyncHandler,
  handlePortalApiError,
  parseLimit,
  parseLikelihoodMax,
  parseLikelihoodMin,
  parseOptionalInt,
  parsePosition,
  parseWatchlistSort,
} from './utils-api';

export interface PortalWatchlistPlayer {
  id: string;
  fullName: string;
  slug: string;
  position: string;
  classYear: number;
  lifecycle: 'PORTAL';
  ufInterest: boolean;
  portalLikelihood: number;
  depthChartRisk: number;
  snapShare: number | null;
  volatility: number;
  rank: number;
}

function hasUfInterest(ufStatus: string | null | undefined, ufFitScore: number | null | undefined): boolean {
  if (ufStatus && String(ufStatus).toUpperCase() !== 'NONE') return true;
  return (ufFitScore ?? 0) > 0;
}

export const handleGetPortalWatchlist = asyncHandler(async (req: Request, res: Response) => {
  try {
    const class_year = parseOptionalInt(req.query.class_year, 'class_year');
    const position = parsePosition(req.query.position);
    const limit = parseLimit(req.query.limit, 100, 500);
    const sort = parseWatchlistSort(req.query.sort);
    const likelihoodMin = parseLikelihoodMin(req.query.likelihood_min);
    const likelihoodMax = parseLikelihoodMax(req.query.likelihood_max);

    const rows = await listPortalCandidates({ class_year, position });
    const enriched = rows
      .filter((row) => hasUfInterest(row.uf_status, row.uf_fit_score))
      .map((row) => {
      const input = portalRowToEngineInput(row);
      const portalLikelihood = computePortalLikelihood(input);
      const snapShareRaw = input.college_snaps
        ? computeSnapShareScore(input) / 100
        : null;
      return {
        id: row.id,
        fullName: row.full_name,
        slug: row.slug,
        position: row.position,
        classYear: row.class_year,
        lifecycle: 'PORTAL' as const,
        ufInterest: true,
        portalLikelihood,
        depthChartRisk: computeDepthChartRisk(input),
        snapShare: snapShareRaw != null ? Math.round(snapShareRaw * 1000) / 1000 : null,
        volatility: computeVolatility(input),
      };
    });

    const filtered = enriched.filter(
      (p) => p.portalLikelihood >= likelihoodMin && p.portalLikelihood <= likelihoodMax
    );

    filtered.sort((a, b) => {
      switch (sort) {
        case 'volatility':
          return b.volatility - a.volatility;
        case 'depthChartRisk':
          return b.depthChartRisk - a.depthChartRisk;
        default:
          return b.portalLikelihood - a.portalLikelihood;
      }
    });

    const players: PortalWatchlistPlayer[] = filtered.slice(0, limit).map((p, index) => ({
      ...p,
      rank: index + 1,
    }));

    res.json({
      lifecycle: 'PORTAL',
      count: players.length,
      empty: players.length === 0,
      message: players.length === 0 ? 'No players found for this category yet.' : undefined,
      players,
    });
  } catch (err) {
    handlePortalApiError(res, err);
  }
});
