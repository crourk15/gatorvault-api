/**
 * POST /api/futurecast/uf-trend/snapshot — daily UF % snapshots for movement narratives.
 */
import { createRequire } from 'node:module';
import type { Request, Response } from 'express';
import { asyncHandler } from '../predictions/utils-api';

const require = createRequire(import.meta.url);

function isAuthorized(req: Request): boolean {
  const cronSecret = process.env.MONITORING_CRON_SECRET || process.env.CRON_SECRET || '';
  if (cronSecret && req.headers['x-monitoring-cron'] === cronSecret) return true;
  if (process.env.NODE_ENV !== 'production') return true;
  return false;
}

export const handlePostUfTrendSnapshot = asyncHandler(async (req: Request, res: Response) => {
  if (!isAuthorized(req)) {
    res.status(403).json({ ok: false, error: 'Forbidden' });
    return;
  }
  const dryRun = req.query.dryRun === 'true' || req.query.dryRun === '1';
  const asOf = typeof req.query.asOf === 'string' ? req.query.asOf : undefined;
  const { runDailyUfTrendSnapshot } = require('../../lib/uf-trend-snapshot');
  const result = await runDailyUfTrendSnapshot({ dryRun, asOf });
  res.json({ ok: true, ...result });
});