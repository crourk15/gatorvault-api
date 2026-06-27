/**
 * GET /api/recruiting/movement-summary — rising / falling / volatile counts.
 */
import type { Request, Response } from 'express';
import { createRequire } from 'node:module';
import {
  listRollingMovement,
  MOVEMENT_VOLATILITY_THRESHOLD,
  ROLLING_MOVEMENT_WINDOW_DAYS,
} from '../../models/predictions';
import { listCompetingVolatilityBoosts } from '../../models/competing-school-history';
import { asyncHandler, handlePredictionsApiError } from '../predictions/utils-api';
import { isFutureCastDataError, respondDatabaseUnavailable } from '../futurecast/db-fallback';
import { MOVEMENT_INTEL_MIN_CLASS_YEAR } from '../futurecast/eligibility';
import { filterMovementIntelRollingRows } from '../futurecast/feed-filters';

const require = createRequire(import.meta.url);
const { filterMovementRowsToLiveTargets } = require('../../lib/live-board-targets');

const MOVEMENT_FILTERS = {
  lifecycle: 'HS' as const,
  min_class_year: MOVEMENT_INTEL_MIN_CLASS_YEAR,
};

function loadPublicIntelCount(): number {
  const gm2 = require('../../lib/gm2') as {
    getPublicIntel: (opts: { limit: number; subsystem: string }) => { intel: unknown[] };
  };
  const beatFilters = require('../../lib/beat-writer-filters') as {
    filterUfOnlyIntelRows: (rows: unknown[]) => unknown[];
  };
  const intel = gm2.getPublicIntel({ limit: 200, subsystem: 'recruiting-movement-intel' }).intel ?? [];
  return beatFilters.filterUfOnlyIntelRows(intel).length;
}

function groupIntelByPlayer(intel: Record<string, unknown>[]): Map<string, Record<string, unknown>[]> {
  const map = new Map<string, Record<string, unknown>[]>();
  for (const row of intel) {
    const slug = String(row.playerSlug || row.player_slug || '').toLowerCase();
    const id = String(row.playerId || row.player_id || slug).toLowerCase();
    for (const key of [slug, id].filter(Boolean)) {
      const list = map.get(key) ?? [];
      list.push(row);
      map.set(key, list);
    }
  }
  return map;
}

export async function buildMovementSummaryPayload(classYear = 2027): Promise<{
  rising: number;
  falling: number;
  volatile: number;
  lastUpdated: string;
}> {
  const year = Number(classYear) || 2027;
  const boosts = await listCompetingVolatilityBoosts(ROLLING_MOVEMENT_WINDOW_DAYS).catch(
    () => new Map<string, number>()
  );
  const items = await filterMovementRowsToLiveTargets(
    filterMovementIntelRollingRows(await listRollingMovement(MOVEMENT_FILTERS, boosts)),
    year
  );

  const gm2 = require('../../lib/gm2') as {
    getPublicIntel: (opts: { limit: number; subsystem: string }) => { intel: Record<string, unknown>[] };
  };
  const beatFilters = require('../../lib/beat-writer-filters') as {
    filterUfOnlyIntelRows: (rows: Record<string, unknown>[]) => Record<string, unknown>[];
  };
  const intel = beatFilters.filterUfOnlyIntelRows(
    gm2.getPublicIntel({ limit: 200, subsystem: 'recruiting-movement-intel' }).intel ?? []
  );
  const intelByPlayer = groupIntelByPlayer(intel);

  let rising = 0;
  let falling = 0;
  let volatile = 0;

  for (const item of items) {
    if (item.delta7d >= 5) rising += 1;
    if (item.delta7d <= -5) falling += 1;

    const events =
      intelByPlayer.get(item.slug.toLowerCase()) ??
      intelByPlayer.get(item.playerId.toLowerCase()) ??
      [];
    if (item.volatilityScore >= MOVEMENT_VOLATILITY_THRESHOLD || events.length > 0) {
      volatile += 1;
    }
  }

  return {
    rising,
    falling,
    volatile,
    lastUpdated: new Date().toISOString(),
  };
}

export const handleGetMovementSummary = asyncHandler(async (_req: Request, res: Response) => {
  try {
    res.json(await buildMovementSummaryPayload());
  } catch (err) {
    if (isFutureCastDataError(err)) {
      respondDatabaseUnavailable(
        res,
        {
          rising: 0,
          falling: 0,
          volatile: loadPublicIntelCount() > 0 ? 1 : 0,
          lastUpdated: new Date().toISOString(),
        },
        err
      );
      return;
    }
    handlePredictionsApiError(res, err);
  }
});
