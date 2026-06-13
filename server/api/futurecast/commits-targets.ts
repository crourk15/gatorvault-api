/**
 * GET /api/futurecast/commits — HS commits only
 * GET /api/futurecast/targets — HS top targets only
 */
import type { Request, Response } from 'express';
import { listPredictions } from '../../models/predictions';
import {
  asyncHandler,
  handlePredictionsApiError,
  serializeFeedRowsWithVolatility,
} from '../predictions/utils-api';
import {
  dedupeFeedRows,
  filterModelPredictionsOnly,
  FUTURECAST_CLASS_YEAR,
  partitionHomepagePredictions,
} from './feed-filters';

const DEFAULT_LIMIT = 50;

function parseLimit(raw: unknown): number {
  const n = Number(raw ?? DEFAULT_LIMIT);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_LIMIT;
  return Math.min(Math.floor(n), 200);
}

function parseClassYear(raw: unknown): number {
  const n = Number(raw ?? FUTURECAST_CLASS_YEAR);
  return Number.isFinite(n) ? n : FUTURECAST_CLASS_YEAR;
}

async function loadHsPredictions(classYear: number) {
  const rows = await listPredictions({
    class_year: classYear,
    status: 'ACTIVE',
    lifecycle: 'HS',
    limit: 500,
  });
  const modelRows = dedupeFeedRows(filterModelPredictionsOnly(rows));
  return serializeFeedRowsWithVolatility(modelRows);
}

export const handleGetFutureCastCommits = asyncHandler(async (req: Request, res: Response) => {
  try {
    const classYear = parseClassYear(req.query.class_year ?? req.query.classYear);
    const limit = parseLimit(req.query.limit);
    const serialized = await loadHsPredictions(classYear);
    const { commits } = partitionHomepagePredictions(serialized);
    const sorted = [...commits].sort((a, b) => (b.ufFitScore ?? 0) - (a.ufFitScore ?? 0));
    const slice = sorted.slice(0, limit);
    res.json({
      classYear,
      lifecycle: 'HIGH_SCHOOL',
      count: slice.length,
      empty: slice.length === 0,
      message: slice.length === 0 ? 'No players found for this category yet.' : undefined,
      commits: slice,
    });
  } catch (err) {
    handlePredictionsApiError(res, err);
  }
});

export const handleGetFutureCastTargets = asyncHandler(async (req: Request, res: Response) => {
  try {
    const classYear = parseClassYear(req.query.class_year ?? req.query.classYear);
    const limit = parseLimit(req.query.limit);
    const serialized = await loadHsPredictions(classYear);
    const { topTargets } = partitionHomepagePredictions(serialized);
    const sorted = [...topTargets].sort(
      (a, b) => (b.ufProbability ?? b.confidence) - (a.ufProbability ?? a.confidence)
    );
    const slice = sorted.slice(0, limit);
    res.json({
      classYear,
      lifecycle: 'HIGH_SCHOOL',
      count: slice.length,
      empty: slice.length === 0,
      message: slice.length === 0 ? 'No players found for this category yet.' : undefined,
      targets: slice,
    });
  } catch (err) {
    handlePredictionsApiError(res, err);
  }
});
