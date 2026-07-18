/**
 * Lab intel promote — auto-add verified Florida targets to FutureCast Lab.
 */
import { createRequire } from 'node:module';
import type { Request, Response } from 'express';
import { asyncHandler } from '../predictions/utils-api';

const require = createRequire(import.meta.url);

function isAuthorized(req: Request): boolean {
  const cronSecret = process.env.MONITORING_CRON_SECRET || process.env.CRON_SECRET || '';
  if (cronSecret && req.headers['x-monitoring-cron'] === cronSecret) return true;
  if (cronSecret && req.headers['x-ingest-secret'] === cronSecret) return true;
  if (process.env.NODE_ENV !== 'production') return true;
  return false;
}

export const handleGetLabIntelPromoteStatus = asyncHandler(async (_req: Request, res: Response) => {
  const { getLabPromotionStatus } = require('../../lib/lab-intel-promote');
  res.json(getLabPromotionStatus());
});

export const handlePostLabIntelPromote = asyncHandler(async (req: Request, res: Response) => {
  if (!isAuthorized(req)) {
    res.status(403).json({ ok: false, error: 'Forbidden' });
    return;
  }
  const dryRun = req.query.dryRun === 'true' || req.query.dryRun === '1' || req.body?.dryRun === true;
  const { runLabIntelPromote } = require('../../lib/lab-intel-promote');
  const result = await runLabIntelPromote({ dryRun });
  res.json(result);
});
