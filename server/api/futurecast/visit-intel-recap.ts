/**
 * POST /api/futurecast/visit-intel/recap — weekly verified OV recap + optional X queue.
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

export const handlePostVisitIntelRecap = asyncHandler(async (req: Request, res: Response) => {
  if (!isAuthorized(req)) {
    res.status(403).json({ ok: false, error: 'Forbidden' });
    return;
  }
  const dryRun = req.query.dryRun === 'true' || req.query.dryRun === '1';
  const queueX = req.query.queueX !== 'false' && req.query.queueX !== '0';
  const asOf = typeof req.query.asOf === 'string' ? req.query.asOf : undefined;
  const { runVisitIntelRecap } = require('../../lib/visit-intel-recap');
  const result = await runVisitIntelRecap({ dryRun, queueX, asOf });
  res.json({ ok: true, ...result });
});