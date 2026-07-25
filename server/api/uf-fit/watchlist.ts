/**
 * GET /api/uf-fit/watchlist — UF Fit candidates / Big Board Top Targets.
 * Top Targets sorts by staff-chase traction (visits, offers, staff, beat intel),
 * not RPM/UF Fit alone and not star rank alone. UF commits are excluded.
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
    const { buildChaseFeatureIndex, computeChaseScore } = require('../../lib/uf-chase-score');
    const commitSlugs: Set<string> =
      class_year != null ? await getUfCommitSlugSet(class_year) : new Set();
    const chaseIndex = buildChaseFeatureIndex({ classYear: class_year });

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

    let enriched = rows.map((row) => {
      const intel = computeUfFitIntel(ufFitRowToEngineInput(row));
      const chase = computeChaseScore(
        {
          slug: row.slug,
          ufFitScore: intel.ufFitScore,
          uf_status: row.uf_status,
          evaluation_notes: row.evaluation_notes,
          signals: row.signals,
        },
        chaseIndex
      );
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
        chaseScore: chase.chaseScore,
        chase: chase.chase,
      };
    });

    if (tier) {
      enriched = enriched.filter((p) => p.fitTier === tier);
    }

    // Chase sort = Top Targets: keep players with real traction / hunt-list presence.
    // Do not gate the board on UF Fit/RPM minScore for that mode.
    if (sort === 'chase') {
      enriched = enriched.filter(
        (p) =>
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
