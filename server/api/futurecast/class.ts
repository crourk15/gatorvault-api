/**
 * GET /api/futurecast/class?year=2027 — class analytics for homepage widget.
 */
import { createRequire } from 'node:module';
import type { Request, Response } from 'express';
import { asyncHandler, handlePredictionsApiError } from '../predictions/utils-api';
import { listPredictions } from '../../models/predictions';
import { FUTURECAST_CLASS_YEAR } from './feed-filters';
import { filterModelPredictionsOnly, dedupeFeedRows } from './feed-filters';
import { sendCachedJson } from './response-cache';

const require = createRequire(import.meta.url);

function parseYear(raw: unknown, fallback: number): number {
  const n = parseInt(String(raw ?? ''), 10);
  return Number.isFinite(n) ? n : fallback;
}

function avgRating(commits: { rating?: unknown }[]): number | null {
  const vals = commits
    .map((c) => (typeof c.rating === 'number' ? c.rating : Number(c.rating)))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (!vals.length) return null;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100;
}

export const handleGetFutureCastClass = asyncHandler(async (req: Request, res: Response) => {
  try {
    const classYear = parseYear(req.query.year ?? req.query.class_year, FUTURECAST_CLASS_YEAR);
    if (classYear !== FUTURECAST_CLASS_YEAR) {
      res.status(400).json({ error: `Only ${FUTURECAST_CLASS_YEAR} cycle is supported` });
      return;
    }
    const cacheKey = `futurecast:class:${classYear}`;

    await sendCachedJson(res, cacheKey, async () => {
    const store = require('../../lib/recruiting-store');
    const board = await store.getBoard(classYear);
    const allRankings = await store.getRankings();
    const rankings = (allRankings || []).find(
      (r: { classYear?: number }) => r.classYear === classYear
    );

    const commits = board.commits || [];
    const inStateCount = commits.filter((c: { inState?: boolean }) => c.inState).length;
    const blueChips = commits.filter((c: { stars?: unknown }) => (Number(c.stars) || 0) >= 4).length;

    const classImpactScore =
      rankings?.classScore != null ? Math.round(Number(rankings.classScore) * 100) / 100 : null;

    let teamImpactScore = avgRating(commits);
    if (teamImpactScore == null) {
      const rows = dedupeFeedRows(
        filterModelPredictionsOnly(
          await listPredictions({ class_year: classYear, status: 'ACTIVE', limit: 80 })
        )
      );
      const fits = rows
        .map((r) => r.uf_fit_score)
        .filter((n): n is number => n != null && Number.isFinite(n));
      if (fits.length) {
        teamImpactScore = Math.round((fits.reduce((a, b) => a + b, 0) / fits.length) * 100) / 100;
      }
    }

    return {
      classYear,
      commitCount: commits.length,
      targetCount: (board.targets || []).length,
      blueChips,
      inStatePct: commits.length ? Math.round((inStateCount / commits.length) * 100) : 0,
      rankings: rankings
        ? {
            nationalRank: rankings.nationalRank ?? null,
            secRank: rankings.secRank ?? null,
            classScore: rankings.classScore ?? null,
            source: rankings.source ?? null,
            updatedAt: rankings.updatedAt ?? null,
          }
        : null,
      classImpactScore,
      teamImpactScore,
    };
    });
  } catch (err) {
    handlePredictionsApiError(res, err);
  }
});
