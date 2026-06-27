const fs = require('fs');
const path = require('path');

const target = path.join(__dirname, '../api/futurecast/visit-intel-reconcile.ts');
const lines = [
  '/**',
  ' * POST /api/futurecast/visit-intel/reconcile — expire stale OV fields in recruiting store.',
  ' * Cron-auth in production; supports ?dryRun=true for smoke checks.',
  ' */',
  "import { createRequire } from 'node:module';",
  "import type { Request, Response } from 'express';",
  "import { asyncHandler } from '../predictions/utils-api';",
  '',
  'const require = createRequire(import.meta.url);',
  '',
  'function isAuthorized(req: Request): boolean {',
  "  const cronSecret = process.env.MONITORING_CRON_SECRET || process.env.CRON_SECRET || '';",
  "  if (cronSecret && req.headers['x-monitoring-cron'] === cronSecret) return true;",
  "  if (process.env.NODE_ENV !== 'production') return true;",
  '  return false;',
  '}',
  '',
  'export const handlePostVisitIntelReconcile = asyncHandler(async (req: Request, res: Response) => {',
  '  if (!isAuthorized(req)) {',
  "    res.status(403).json({ ok: false, error: 'Forbidden' });",
  '    return;',
  '  }',
  '',
  "  const dryRun = req.query.dryRun === 'true' || req.query.dryRun === '1';",
  "  const asOf = typeof req.query.asOf === 'string' ? req.query.asOf : undefined;",
  "  const { reconcileVisitIntelInStore } = require('../../lib/expire-stale-visit-intel');",
  '  const result = await reconcileVisitIntelInStore({ dryRun, asOf });',
  '',
  '  res.json({ ok: true, ...result });',
  '});',
  '',
];

fs.writeFileSync(target, lines.join('\n'), 'utf8');
console.log('wrote', target);
