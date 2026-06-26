/**
 * Admin engine triggers — spec §3.5
 */
import type { Express, Request, Response } from 'express';
import { createRequire } from 'node:module';
import { asyncHandler } from '../../predictions/utils-api';
import { runEarlyDiscovery } from '../../../engines/futurecast/early-discovery';
import { runPortalIntelJob } from '../../../engines/futurecast/portal-intel/pipeline';
import { runUfFitRecompute } from '../../../engines/futurecast/uf-fit';

const require = createRequire(import.meta.url);
const { verifyAdminPin, pinFromReq } = require('../../../lib/admin-pin.js');

function isEngineAuthorized(req: Request): boolean {
  const cronSecret = process.env.MONITORING_CRON_SECRET || process.env.CRON_SECRET || '';
  if (cronSecret && req.headers['x-monitoring-cron'] === cronSecret) return true;
  if (verifyAdminPin(pinFromReq(req))) return true;
  if (process.env.NODE_ENV !== 'production') return true;
  return false;
}

function parseDryRun(req: Request): boolean {
  return req.query.dryRun === 'true' || req.query.dryRun === '1' || req.body?.dryRun === true;
}

export const handleRunEarlyDiscovery = asyncHandler(async (req: Request, res: Response) => {
  if (!isEngineAuthorized(req)) {
    res.status(403).json({ ok: false, error: 'Forbidden' });
    return;
  }
  const classYearGte = Number(req.body?.classYearGte ?? req.query.class_year_gte ?? 2028) || 2028;
  const result = await runEarlyDiscovery({ classYearGte, dryRun: parseDryRun(req) });
  res.json({ ok: true, result });
});

export const handleRunPortalIntel = asyncHandler(async (req: Request, res: Response) => {
  if (!isEngineAuthorized(req)) {
    res.status(403).json({ ok: false, error: 'Forbidden' });
    return;
  }
  const result = await runPortalIntelJob({
    limit: Number(req.body?.limit ?? req.query.limit ?? 200) || 200,
    dryRun: parseDryRun(req),
  });
  res.json({ ok: true, result });
});

export const handleRunAllowlistOn3Sync = asyncHandler(async (req: Request, res: Response) => {
  if (!isEngineAuthorized(req)) {
    res.status(403).json({ ok: false, error: 'Forbidden' });
    return;
  }
  const { syncAllowlistTargetsFromOn3 } = require('../../../lib/allowlist-target-sync.js');
  const classYear = Number(req.body?.classYear ?? req.query.class_year ?? 2028) || 2028;
  const limit = Number(req.body?.limit ?? req.query.limit ?? 0) || 0;
  const result = await syncAllowlistTargetsFromOn3({
    classYear,
    limit: limit > 0 ? limit : undefined,
  });
  res.json({ ok: true, classYear, result });
});

export const handleRunUfFitRecompute = asyncHandler(async (req: Request, res: Response) => {
  if (!isEngineAuthorized(req)) {
    res.status(403).json({ ok: false, error: 'Forbidden' });
    return;
  }
  const playerId = typeof req.body?.player_id === 'string' ? req.body.player_id : undefined;
  const classYear = Number(req.body?.classYear ?? req.query.class_year ?? 2028) || 2028;
  if (!playerId && (req.body?.seed === true || req.query.seed === 'true')) {
    const yearsRaw = req.body?.classYears ?? req.query.class_years;
    const classYears = yearsRaw
      ? String(yearsRaw)
          .split(',')
          .map((y: string) => Number(y.trim()))
          .filter((n: number) => Number.isFinite(n) && n > 0)
      : [2027, 2028];
    const results = [];
    for (const year of classYears) {
      results.push(await runUfFitRecompute({ classYear: year, dryRun: parseDryRun(req) }));
    }
    res.json({ ok: true, mode: 'seed', classYears, results });
    return;
  }
  const result = await runUfFitRecompute({ playerId, classYear, dryRun: parseDryRun(req) });
  res.json({ ok: true, result });
});

export function mountAdminEngineRoutes(app: Express): void {
  app.post('/api/admin/engines/early-discovery/run', handleRunEarlyDiscovery);
  app.post('/api/admin/engines/portal-intelligence/run', handleRunPortalIntel);
  app.post('/api/admin/engines/allowlist-on3/sync', handleRunAllowlistOn3Sync);
  app.post('/api/admin/engines/uf-fit/recompute', handleRunUfFitRecompute);
  console.log('[admin-engines] mounted /api/admin/engines/*');
}
