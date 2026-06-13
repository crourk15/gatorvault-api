/**
 * GET /api/alerts — recent FutureCast alerts feed.
 */
import type { Request, Response } from 'express';
import { listAlerts } from '../../models/alerts';
import {
  asyncHandler,
  handlePredictionsApiError,
  parseLimit,
} from '../predictions/utils-api';
import { isDatabaseUnavailableError, respondDatabaseUnavailable } from '../futurecast/db-fallback';

export const handleListAlerts = asyncHandler(async (req: Request, res: Response) => {
  try {
    const limit = parseLimit(req.query.limit, 50, 200);
    const alerts = await listAlerts(limit);
    res.json({ alerts });
  } catch (err) {
    if (isDatabaseUnavailableError(err)) {
      respondDatabaseUnavailable(res, { alerts: [] });
      return;
    }
    handlePredictionsApiError(res, err);
  }
});
