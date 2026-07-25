/**
 * GET /api/big-board — ranked Big Board intelligence feed.
 */
import type { Request, Response } from 'express';
import { createRequire } from 'node:module';
import { listBigBoardPlayers } from '../../models/big-board';
import { buildBigBoard } from './engine';
import {
  asyncHandler,
  handleApiError,
  parseLifecycle,
  parseLimit,
  parseOptionalInt,
  parseOrder,
  parsePosition,
  parseSort,
} from './utils-api';
import { enrichFeedPlayers } from '../futurecast/ranking-enrichment';
import {
  boardFetchMultiplier,
  filterBoardEligiblePlayers,
  rerankBoardPlayers,
} from './board-filters';
import { isUfCommitRow } from '../futurecast/eligibility';

const require = createRequire(import.meta.url);

export const handleGetBigBoard = asyncHandler(async (req: Request, res: Response) => {
  try {
    const class_year = parseOptionalInt(req.query.class_year, 'class_year');
    const position = parsePosition(req.query.position);
    const lifecycle = parseLifecycle(req.query.lifecycle) ?? 'HS';
    const sort = parseSort(req.query.sort);
    const order = parseOrder(req.query.order);
    const limit = parseLimit(req.query.limit, 200, 500);

    const raw = await listBigBoardPlayers({ class_year, position, lifecycle });
    const built = buildBigBoard(raw, sort, order, boardFetchMultiplier(limit));

    // HS Intelligence Rank should not list locked UF commits as open board targets.
    let enriched = enrichFeedPlayers(built);
    if (lifecycle === 'HS') {
      const { getUfCommitSlugSet } = require('../../lib/recruiting-uf-commit-slugs');
      const commitSlugs: Set<string> =
        class_year != null ? await getUfCommitSlugSet(class_year) : new Set();
      enriched = enriched.filter((p) => {
        const slug = String(p.slug || '').toLowerCase();
        if (slug && commitSlugs.has(slug)) return false;
        if (
          isUfCommitRow({
            lifecycle: p.lifecycle || 'HS',
            committed_to: p.committedTo,
            uf_status: null,
          })
        ) {
          return false;
        }
        return true;
      });
    }

    const eligible = filterBoardEligiblePlayers(enriched);
    const players = rerankBoardPlayers(eligible).slice(0, limit);

    res.json({ players });
  } catch (err) {
    handleApiError(res, err);
  }
});
