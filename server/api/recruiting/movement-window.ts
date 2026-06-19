/**
 * GET /api/recruiting/movement-window — rolling 7-day UF% movement board.
 */
import type { Request, Response } from 'express';
import { createRequire } from 'node:module';
import { listRollingMovement, ROLLING_MOVEMENT_WINDOW_DAYS } from '../../models/predictions';
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

export type MovementWindowItem = Awaited<ReturnType<typeof listRollingMovement>>[number];

export async function buildMovementWindowPayload(): Promise<{
  items: MovementWindowItem[];
  lastUpdated: string;
  windowDays: number;
}> {
  const boosts = await listCompetingVolatilityBoosts(ROLLING_MOVEMENT_WINDOW_DAYS).catch(
    () => new Map<string, number>()
  );
  const items = await filterMovementRowsToLiveTargets(
    filterMovementIntelRollingRows(await listRollingMovement(MOVEMENT_FILTERS, boosts)),
    2027
  );
  return {
    items,
    lastUpdated: new Date().toISOString(),
    windowDays: ROLLING_MOVEMENT_WINDOW_DAYS,
  };
}

export const handleGetMovementWindow = asyncHandler(async (_req: Request, res: Response) => {
  try {
    res.json(await buildMovementWindowPayload());
  } catch (err) {
    if (isFutureCastDataError(err)) {
      respondDatabaseUnavailable(
        res,
        { items: [], lastUpdated: new Date().toISOString(), windowDays: ROLLING_MOVEMENT_WINDOW_DAYS },
        err
      );
      return;
    }
    handlePredictionsApiError(res, err);
  }
});
