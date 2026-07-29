/**
 * GET /api/futurecast/early-discovery — underclassmen ranked by discovery score.
 */
import type { Request, Response } from 'express';
import { createRequire } from 'node:module';
import { asyncHandler, handlePredictionsApiError } from '../predictions/utils-api';
import { enrichWithRankings } from './ranking-enrichment';
import { expandPositionFilter, parsePositionFilter } from './position-filter';
import { earlyDiscoveryCacheKey, sendCachedJson } from './response-cache';
import { isFutureCastDataError } from './db-fallback';

const require = createRequire(import.meta.url);

/** Stay under Netlify's ~26s proxy window; fall back to allowlist-only if DB is slow/cold. */
const EARLY_DISCOVERY_QUERY_MS = Math.max(
  5_000,
  Number(process.env.EARLY_DISCOVERY_QUERY_MS || 12_000) || 12_000
);

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label}_timeout_${ms}ms`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

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
  position?: string;
  limit?: number;
}) {
  const {
    classYearGte = 2028,
    minDiscoveryScore = 0,
    minUfFitScore = 0,
    position,
    limit = 100,
  } = opts;
  const { db } = require('../../models/db.ts');

  const params: unknown[] = [classYearGte, minDiscoveryScore, minUfFitScore];
  let positionClause = '';
  if (position) {
    params.push(expandPositionFilter(position));
    positionClause = ` AND upper(COALESCE(p.position, '')) = ANY($${params.length}::text[])`;
  }
  params.push(limit);
  const limitParam = `$${params.length}`;

  // Rank + limit first, then attach signal counts only for the page — full-table
  // discovery_signals GROUP BY was blowing the Netlify proxy window on cold Render.
  const { rows } = await db.query(
    `
    WITH ranked AS (
      SELECT
        p.id,
        p.slug,
        p.full_name,
        p.class_year,
        p.position,
        p.state,
        p.stars,
        p.committed_to,
        COALESCE(hs.discovery_score, 0)::int AS discovery_score,
        uf.uf_fit_score,
        uf.uf_status
      FROM futurecast.players p
      LEFT JOIN futurecast.high_school_profiles hs ON hs.player_id = p.id
      LEFT JOIN futurecast.uf_specific_profiles uf ON uf.player_id = p.id
      WHERE p.class_year >= $1
        AND p.status = 'HS'
        AND COALESCE(hs.discovery_score, 0) >= $2
        AND COALESCE(uf.uf_fit_score, 0) >= $3
        AND (p.committed_to IS NULL OR p.committed_to !~* '\\yflorida\\y')
        ${positionClause}
      ORDER BY hs.discovery_score DESC NULLS LAST, p.stars DESC NULLS LAST, p.full_name ASC
      LIMIT ${limitParam}
    )
    SELECT
      r.*,
      COALESCE(sig.signal_count, 0)::int AS signal_count
    FROM ranked r
    LEFT JOIN (
      SELECT player_id, COUNT(*)::int AS signal_count
      FROM futurecast.discovery_signals
      WHERE player_id IN (SELECT id FROM ranked)
      GROUP BY player_id
    ) sig ON sig.player_id = r.id
    ORDER BY r.discovery_score DESC NULLS LAST, r.stars DESC NULLS LAST, r.full_name ASC
    `,
    params
  );

  const { mergeAllowlistIntoDiscovery } = require('../../lib/early-discovery-allowlist-merge');
  const { getUfCommitSlugSet } = require('../../lib/recruiting-uf-commit-slugs');
  const commitSlugs: Set<string> = await getUfCommitSlugSet(classYearGte);

  const mergedRows = mergeAllowlistIntoDiscovery(
    rows.map((row: Record<string, unknown>) => ({
      id: row.id,
      slug: row.slug,
      fullName: row.full_name,
      classYear: row.class_year,
      position: row.position,
      state: row.state,
      stars: row.stars,
      committedTo: row.committed_to ?? null,
      discoveryScore: Number(row.discovery_score) || 0,
      ufFitScore: row.uf_fit_score != null ? Number(row.uf_fit_score) : null,
      ufStatus: row.uf_status,
      signalCount: Number(row.signal_count) || 0,
    })),
    { classYearGte, minDiscoveryScore, minUfFitScore, position, limit }
  ).filter((row: { slug?: string; committedTo?: string | null }) => {
    const slug = String(row.slug || '').toLowerCase();
    if (slug && commitSlugs.has(slug)) return false;
    return true;
  });

  return mergedRows.map((row) => enrichWithRankings(row));
}

function allowlistOnlyPlayers(opts: {
  classYearGte?: number;
  minDiscoveryScore?: number;
  minUfFitScore?: number;
  position?: string;
  limit?: number;
}) {
  const { mergeAllowlistIntoDiscovery } = require('../../lib/early-discovery-allowlist-merge');
  const classYearGte = opts.classYearGte ?? 2028;
  const minDiscoveryScore = opts.minDiscoveryScore ?? 0;
  const minUfFitScore = opts.minUfFitScore ?? 0;
  const position = opts.position;
  const limit = opts.limit ?? 100;
  return mergeAllowlistIntoDiscovery([], {
    classYearGte,
    minDiscoveryScore,
    minUfFitScore,
    position,
    limit,
  }).map((row: Record<string, unknown>) => enrichWithRankings(row));
}

export async function buildEarlyDiscoveryPayload(opts: {
  classYearGte?: number;
  minDiscoveryScore?: number;
  minUfFitScore?: number;
  position?: string;
  limit?: number;
}) {
  const classYearGte = opts.classYearGte ?? 2028;
  const minDiscoveryScore = opts.minDiscoveryScore ?? 0;
  const minUfFitScore = opts.minUfFitScore ?? 0;
  const position = opts.position;
  const limit = opts.limit ?? 100;
  try {
    const players = await withTimeout(
      listEarlyDiscoveryPlayers({
        classYearGte,
        minDiscoveryScore,
        minUfFitScore,
        position,
        limit,
      }),
      EARLY_DISCOVERY_QUERY_MS,
      'early_discovery'
    );
    return {
      ok: true,
      classYearGte,
      position: position ?? null,
      count: players.length,
      players,
      updatedAt: new Date().toISOString(),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const soft =
      isFutureCastDataError(err) || /timeout|ECONNRESET|ECONNREFUSED|connection/i.test(msg);
    if (!soft) throw err;
    console.warn('[early-discovery] soft-fallback allowlist-only:', msg);
    const players = allowlistOnlyPlayers({
      classYearGte,
      minDiscoveryScore,
      minUfFitScore,
      position,
      limit,
    });
    return {
      ok: true,
      classYearGte,
      position: position ?? null,
      count: players.length,
      players,
      unavailable: true,
      degraded: 'allowlist_only',
      updatedAt: new Date().toISOString(),
    };
  }
}

export const handleGetEarlyDiscovery = asyncHandler(async (req: Request, res: Response) => {
  try {
    const classYearGte =
      parseOptionalInt(req.query.class_year_gte ?? req.query.classYearGte, 'class_year_gte') ?? 2028;
    const minDiscoveryScore =
      parseOptionalInt(req.query.min_discovery_score ?? req.query.minDiscoveryScore, 'min_discovery_score') ?? 0;
    const minUfFitScore =
      parseOptionalInt(req.query.min_uf_fit_score ?? req.query.minUfFitScore, 'min_uf_fit_score') ?? 0;
    const position = parsePositionFilter(req.query.position);
    const limit = parseLimit(req.query.limit);
    const cacheKey = earlyDiscoveryCacheKey({
      classYearGte,
      minDiscoveryScore,
      minUfFitScore,
      position,
      limit,
    });

    await sendCachedJson(res, cacheKey, () =>
      buildEarlyDiscoveryPayload({
        classYearGte,
        minDiscoveryScore,
        minUfFitScore,
        position,
        limit,
      })
    );
  } catch (err) {
    // Last-resort 200 so TestFlight never sticks on bare "Load failed" HTML 502s.
    try {
      const classYearGte = Number(req.query.class_year_gte ?? req.query.classYearGte) || 2028;
      const minDiscoveryScore =
        Number(req.query.min_discovery_score ?? req.query.minDiscoveryScore) || 0;
      const minUfFitScore = Number(req.query.min_uf_fit_score ?? req.query.minUfFitScore) || 0;
      const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
      let position: string | undefined;
      try {
        position = parsePositionFilter(req.query.position);
      } catch {
        position = undefined;
      }
      const players = allowlistOnlyPlayers({
        classYearGte,
        minDiscoveryScore,
        minUfFitScore,
        position,
        limit,
      });
      res.status(200).json({
        ok: true,
        classYearGte,
        position: position ?? null,
        count: players.length,
        players,
        unavailable: true,
        degraded: 'allowlist_only',
        updatedAt: new Date().toISOString(),
      });
      return;
    } catch {
      handlePredictionsApiError(res, err);
    }
  }
});
