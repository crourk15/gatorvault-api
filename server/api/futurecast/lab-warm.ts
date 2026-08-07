/**
 * Cron-only FutureCast Lab memory warm — Tier B refill without member GET rebuilds.
 */
import type { Request, Response } from 'express';
import { createRequire } from 'node:module';
import { warmFuturecastLabCaches } from './response-cache';

const require = createRequire(import.meta.url);

function isCronAuthorized(req: Request): boolean {
  const cronSecret = process.env.MONITORING_CRON_SECRET || process.env.CRON_SECRET || '';
  return Boolean(cronSecret && req.headers['x-monitoring-cron'] === cronSecret);
}

export async function handlePostFutureCastLabWarm(req: Request, res: Response): Promise<void> {
  if (!isCronAuthorized(req) && process.env.NODE_ENV === 'production') {
    res.status(403).json({ ok: false, error: 'Forbidden' });
    return;
  }

  try {
    const { stayGreenSkipPayload } = require('../../lib/api-stay-green');
    const skipped = stayGreenSkipPayload('futurecast-lab-warm');
    if (skipped) {
      console.log('[futurecast] stay-green skip lab-warm');
      res.json(skipped);
      return;
    }
  } catch {
    /* optional */
  }

  const yearsRaw = String(req.query.years || '2027,2028');
  const years = yearsRaw
    .split(',')
    .map((y) => parseInt(y.trim(), 10))
    .filter((y) => Number.isFinite(y));

  const yearsFinal = years.length ? years : [2027, 2028];
  const { runHeavyJob } = require('../../lib/heavy-job-gate');

  // Accept and continue — Lab warm is heavy; do not hold the cron HTTP open.
  void runHeavyJob('futurecast-lab-warm', () => warmFuturecastLabCaches(yearsFinal))
    .then((result: { warmed?: string[]; failed?: string[] }) => {
      console.log('[futurecast] lab-warm complete', JSON.stringify(result));
    })
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      console.warn('[futurecast] lab-warm failed:', message);
    });

  res.json({
    ok: true,
    accepted: true,
    years: yearsFinal,
  });
}
