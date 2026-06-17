/**
 * GET /api/recruiting/competing-deltas — competing school rank changes.
 */
import type { Request, Response } from 'express';
import {
  listCompetingSchoolDeltas,
  type CompetingSchoolDelta,
} from '../../models/competing-school-history';
import { ROLLING_MOVEMENT_WINDOW_DAYS } from '../../models/predictions';
import { asyncHandler, handlePredictionsApiError } from '../predictions/utils-api';
import { isFutureCastDataError, respondDatabaseUnavailable } from '../futurecast/db-fallback';

export type { CompetingSchoolDelta };

export async function buildCompetingDeltasPayload(): Promise<{
  items: CompetingSchoolDelta[];
  lastUpdated: string;
}> {
  const items = await listCompetingSchoolDeltas(ROLLING_MOVEMENT_WINDOW_DAYS);
  return {
    items,
    lastUpdated: new Date().toISOString(),
  };
}

export const handleGetCompetingDeltas = asyncHandler(async (_req: Request, res: Response) => {
  try {
    res.json(await buildCompetingDeltasPayload());
  } catch (err) {
    if (isFutureCastDataError(err)) {
      respondDatabaseUnavailable(
        res,
        { items: [], lastUpdated: new Date().toISOString() },
        err
      );
      return;
    }
    handlePredictionsApiError(res, err);
  }
});
