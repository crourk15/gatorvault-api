/**
 * GET /api/uf-fit/watchlist — high or rising UF Fit candidates.
 */
import type { Request, Response } from 'express';
import { computeUfFitIntel } from './engine';
import { listUfFitCandidates, ufFitRowToEngineInput } from '../../models/uf-fit-intel';
import {
  asyncHandler,
  handleUfFitApiError,
  parseFitTier,
  parseLimit,
  parseOptionalInt,
  parsePosition,
  parseScoreBound,
  parseUfFitSort,
} from './utils-api';

export const handleGetUfFitWatchlist = asyncHandler(async (req: Request, res: Response) => {
  try {
    const class_year = parseOptionalInt(req.query.class_year, 'class_year');
    const position = parsePosition(req.query.position);
    const tier = parseFitTier(req.query.tier);
    const minScore = parseScoreBound(req.query.minScore, 'minScore');
    const maxScore = parseScoreBound(req.query.maxScore, 'maxScore');
    const limit = parseLimit(req.query.limit, 100, 500);
    const sort = parseUfFitSort(req.query.sort);

    const rows = await listUfFitCandidates({ class_year, position });
    let enriched = rows.map((row) => {
      const intel = computeUfFitIntel(ufFitRowToEngineInput(row));
      return {
        id: row.id,
        fullName: row.full_name,
        slug: row.slug,
        position: row.position,
        classYear: row.class_year,
        ufFitScore: intel.ufFitScore,
        fitTier: intel.fitTier,
        fitDelta: intel.fitDelta,
        fitVolatility: intel.fitVolatility,
      };
    });

    if (tier) {
      enriched = enriched.filter((p) => p.fitTier === tier);
    }
    if (minScore != null) {
      enriched = enriched.filter((p) => p.ufFitScore >= minScore);
    }
    if (maxScore != null) {
      enriched = enriched.filter((p) => p.ufFitScore <= maxScore);
    }

    enriched.sort((a, b) => {
      switch (sort) {
        case 'fitDelta':
          return b.fitDelta - a.fitDelta;
        case 'fitVolatility':
          return b.fitVolatility - a.fitVolatility;
        default:
          return b.ufFitScore - a.ufFitScore;
      }
    });

    const players = enriched.slice(0, limit).map((p, index) => ({
      ...p,
      rank: index + 1,
    }));

    res.json({ players });
  } catch (err) {
    handleUfFitApiError(res, err);
  }
});
