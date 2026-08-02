/**
 * GET /api/uf-fit/watchlist — UF Fit candidates / Big Board Top Targets.
 * Top Targets (sort=chase) uses Hottest Targets composite:
 * staff heat × must-get fit × positional need × FL geo × market pressure.
 * Campus UV stacks do not own the board. UF commits are excluded.
 */
import type { Request, Response } from 'express';
import { createRequire } from 'node:module';
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
import { enrichWithRankings } from '../futurecast/ranking-enrichment';
import { isUfCommitRow } from '../futurecast/eligibility';

const require = createRequire(import.meta.url);

export const handleGetUfFitWatchlist = asyncHandler(async (req: Request, res: Response) => {
  try {
    const class_year = parseOptionalInt(req.query.class_year, 'class_year');
    const position = parsePosition(req.query.position);
    const tier = parseFitTier(req.query.tier);
    const minScore = parseScoreBound(req.query.minScore, 'minScore');
    const maxScore = parseScoreBound(req.query.maxScore, 'maxScore');
    const limit = parseLimit(req.query.limit, 100, 500);
    const sort = parseUfFitSort(req.query.sort);

    const { getUfCommitSlugSet } = require('../../lib/recruiting-uf-commit-slugs');
    const { scoreHotTargetBoard } = require('../../lib/hot-florida-targets');
    const commitSlugs: Set<string> =
      class_year != null ? await getUfCommitSlugSet(class_year) : new Set();

    const rows = (await listUfFitCandidates({ class_year, position })).filter((row) => {
      const slug = String(row.slug || '').toLowerCase();
      if (slug && commitSlugs.has(slug)) return false;
      // FutureCast player.status is the lifecycle (HS/COLLEGE/PORTAL).
      if (
        isUfCommitRow({
          lifecycle: row.status || 'HS',
          committed_to: row.committed_to,
          uf_status: row.uf_status,
        })
      ) {
        return false;
      }
      return true;
    });

    const intelBySlug = new Map(
      rows.map((row) => [String(row.slug || '').toLowerCase(), computeUfFitIntel(ufFitRowToEngineInput(row))])
    );

    // Identity/fit/geo come from recruiting-store enrich inside scoreHotTargetBoard.
    const hotBoard = scoreHotTargetBoard(
      rows.map((row) => {
        const intel = intelBySlug.get(String(row.slug || '').toLowerCase());
        return {
          id: row.id,
          slug: row.slug,
          name: row.full_name,
          pos: row.position,
          position: row.position,
          classYear: row.class_year,
          fitScore: intel?.ufFitScore ?? 0,
          uf_status: row.uf_status,
          evaluation_notes: row.evaluation_notes,
          signals: row.signals,
          delta7d: intel?.fitDelta ?? 0,
        };
      }),
      { classYear: class_year }
    );
    const hotBySlug = new Map(hotBoard.map((p: { slug?: string }) => [String(p.slug || '').toLowerCase(), p]));

    let enriched = rows.map((row) => {
      const intel = intelBySlug.get(String(row.slug || '').toLowerCase()) || computeUfFitIntel(ufFitRowToEngineInput(row));
      const hot = hotBySlug.get(String(row.slug || '').toLowerCase());
      return {
        id: row.id,
        fullName: row.full_name,
        slug: row.slug,
        position: row.position,
        classYear: row.class_year,
        committedTo: row.committed_to,
        ufFitScore: intel.ufFitScore,
        fitTier: intel.fitTier,
        fitDelta: intel.fitDelta,
        fitVolatility: intel.fitVolatility,
        chaseScore: hot?.chaseScore ?? 0,
        chase: hot?.chase || null,
        hotScore: hot?.hotScore ?? 0,
        hotLanes: hot?.hotLanes || null,
        hotBadges: hot?.hotBadges || null,
        priorityScore: hot?.hotScore ?? 0,
      };
    });

    if (tier) {
      enriched = enriched.filter((p) => p.fitTier === tier);
    }

    // Chase sort = Top Targets hottest composite: keep real traction / hunt-list presence.
    // Do not gate the board on UF Fit/RPM minScore for that mode.
    if (sort === 'chase') {
      enriched = enriched.filter(
        (p) =>
          p.hotScore > 0 ||
          p.chaseScore > 0 ||
          Boolean(p.chase?.allowlisted) ||
          Boolean(p.chase?.headliner) ||
          p.chase?.ufStatus === 'PRIORITY' ||
          p.chase?.ufStatus === 'TARGET'
      );
    } else {
      if (minScore != null) {
        enriched = enriched.filter((p) => p.ufFitScore >= minScore);
      }
      if (maxScore != null) {
        enriched = enriched.filter((p) => p.ufFitScore <= maxScore);
      }
    }

    enriched.sort((a, b) => {
      switch (sort) {
        case 'fitDelta':
          return b.fitDelta - a.fitDelta;
        case 'fitVolatility':
          return b.fitVolatility - a.fitVolatility;
        case 'chase':
          if (b.hotScore !== a.hotScore) return b.hotScore - a.hotScore;
          if (b.chaseScore !== a.chaseScore) return b.chaseScore - a.chaseScore;
          return b.ufFitScore - a.ufFitScore;
        default:
          return b.ufFitScore - a.ufFitScore;
      }
    });

    const players = enriched.slice(0, limit).map((p, index) =>
      enrichWithRankings({
        ...p,
        rank: index + 1,
      })
    );

    res.json({ players });
  } catch (err) {
    handleUfFitApiError(res, err);
  }
});
