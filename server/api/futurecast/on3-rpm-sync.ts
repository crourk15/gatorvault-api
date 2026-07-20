/**
 * POST /api/futurecast/on3-rpm/sync — On3 RPM UF % for allowlist + UF-active inventory.
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

export const handlePostOn3RpmSync = asyncHandler(async (req: Request, res: Response) => {
  if (!isAuthorized(req)) {
    res.status(403).json({ ok: false, error: 'Forbidden' });
    return;
  }
  const dryRun =
    req.query.dryRun === 'true' ||
    req.query.dryRun === '1' ||
    req.body?.dryRun === true;
  const fetchProfiles =
    req.query.fetch !== 'false' &&
    req.query.fetch !== '0' &&
    req.body?.fetch !== false;
  const classYearRaw = req.query.year ?? req.body?.classYear;
  const classYear =
    typeof classYearRaw === 'string' || typeof classYearRaw === 'number'
      ? parseInt(String(classYearRaw), 10)
      : undefined;
  const scope =
    typeof req.query.scope === 'string'
      ? req.query.scope
      : typeof req.body?.scope === 'string'
        ? req.body.scope
        : undefined;
  const maxInventoryRaw = req.query.maxInventory ?? req.body?.maxInventory;
  const maxInventory =
    maxInventoryRaw != null ? parseInt(String(maxInventoryRaw), 10) : undefined;
  const { syncAllowlistOn3Rpm } = require('../../lib/on3-rpm-allowlist');
  const result = await syncAllowlistOn3Rpm({
    dryRun,
    fetch: fetchProfiles,
    classYear: Number.isFinite(classYear) ? classYear : undefined,
    scope,
    maxInventory: Number.isFinite(maxInventory) ? maxInventory : undefined,
    writePlayers: req.body?.writePlayers !== false,
  });
  res.json({ ok: true, ...result });
});