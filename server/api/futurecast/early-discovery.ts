/**
 * GET /api/futurecast/early-discovery — underclassmen ranked by discovery score.
 */
import type { Request, Response } from 'express';
import { createRequire } from 'node:module';
import { asyncHandler, handlePredictionsApiError } from '../predictions/utils-api';
import { enrichWithRankings } from './ranking-enrichment';

const require = createRequire(import.meta.url);

function parseOptionalInt(raw: unknown, field: string): number | undefined {
  if (raw == null || raw === '') return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error(`${field} must be a number`);
  return Math.floor(n);
}

function parseLimit(raw: unknown, fallback = 100, max = 500): number {
  const n = parseOptionalInt(raw, 'limit');
  if (n == null) return fallback;
  return Math.min(Math.max(n, 1), max);
}

export async function listEarlyDiscoveryPlayers(opts: {
  classYearGte?: number;
  minDiscoveryScore?: number;
  minUfFitScore?: number;
  limit?: number;
}) {
  const {
    classYearGte = 2028,
    minDiscoveryScore = 0,
    minUfFitScore = 0,
    limit = 100,
  } = opts;
  const { db } = require('../../models/db.ts');

  const { rows } = await db.query(
    `
    SELECT
      p.id,
      p.slug,
      p.full_name,
      p.class_year,
      p.position,
      p.state,
      p.stars,
      COALESCE(hs.discovery_score, 0)::int AS discovery_score,
      uf.uf_fit_score,
      uf.uf_status,
      COALESCE(sig.signal_count, 0)::int AS signal_count
    FROM futurecast.players p
    LEFT JOIN futurecast.high_school_profiles hs ON hs.player_id = p.id
    LEFT JOIN futurecast.uf_specific_profiles uf ON uf.player_id = p.id
    LEFT JOIN (
      SELECT player_id, COUNT(*)::int AS signal_count
      FROM futurecast.discovery_signals
      GROUP BY player_id
    ) sig ON sig.player_id = p.id
    WHERE p.class_year >= $1
      AND p.status = 'HS'
      AND COALESCE(hs.discovery_score, 0) >= $2
      AND COALESCE(uf.uf_fit_score, 0) >= $3
    ORDER BY hs.discovery_score DESC NULLS LAST, p.stars DESC NULLS LAST, p.full_name ASC
    LIMIT $4
    `,
    [classYearGte, minDiscoveryScore, minUfFitScore, limit]
  );

  return rows.map((row: Record<string, unknown>, index: number) =>
    enrichWithRankings({
      id: row.id,
      slug: row.slug,
      fullName: row.full_name,
      classYear: row.class_year,
      position: row.position,
      state: row.state,
      stars: row.stars,
      discoveryScore: Number(row.discovery_score) || 0,
      ufFitScore: row.uf_fit_score != null ? Number(row.uf_fit_score) : null,
      ufStatus: row.uf_status,
      signalCount: Number(row.signal_count) || 0,
      rank: index + 1,
    })
  );
}

export const handleGetEarlyDiscovery = asyncHandler(async (req: Request, res: Response) => {
  try {
    const classYearGte =
      parseOptionalInt(req.query.class_year_gte ?? req.query.classYearGte, 'class_year_gte') ?? 2028;
    const minDiscoveryScore =
      parseOptionalInt(req.query.min_discovery_score ?? req.query.minDiscoveryScore, 'min_discovery_score') ?? 0;
    const minUfFitScore =
      parseOptionalInt(req.query.min_uf_fit_score ?? req.query.minUfFitScore, 'min_uf_fit_score') ?? 0;
    const limit = parseLimit(req.query.limit);

    const players = await listEarlyDiscoveryPlayers({
      classYearGte,
      minDiscoveryScore,
      minUfFitScore,
      limit,
    });

    res.json({
      ok: true,
      classYearGte,
      count: players.length,
      players,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    handlePredictionsApiError(res, err);
  }
});
