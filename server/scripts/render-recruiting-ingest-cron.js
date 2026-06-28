#!/usr/bin/env node
/**
 * Render cron — trigger On3/Rivals ingest + hub cache refresh on schedule.
 * Production-hardened: API warm check, retries, soft per-step failures, always exit 0.
 */
require('./render-cron-env');

const { runIngestSteps } = require('../lib/ingest-cron-client');

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || process.env.API_BASE || 'https://gatorvault-api.onrender.com').replace(
  /\/$/,
  ''
);
const CRON_SECRET = process.env.MONITORING_CRON_SECRET || process.env.INGEST_CRON_SECRET || process.env.CRON_SECRET || '';

function buildSteps() {
  const steps = [
    {
      name: 'on3',
      path: '/api/recruiting/ingest',
      summarize: (r) => ({ fired: r?.fired?.length ?? 0 }),
    },
  ];
  if (process.env.RIVALS_PM_INGEST_ENABLED !== 'false') {
    steps.push({
      name: 'rivals-pm',
      path: '/api/recruiting/rivals-pm/ingest',
      summarize: (r) => ({ processedCount: r?.processedCount ?? null }),
    });
  }
  steps.push({
    name: 'hub-refresh',
    path: '/api/recruiting/hub/refresh?geoBackfill=true',
    summarize: (r) => ({ enrichedPlayerCount: r?.enrichedPlayerCount ?? null }),
  });
  steps.push({
    name: 'portal-sync',
    path: '/api/recruiting/portal/sync',
    summarize: (r) => ({ synced: r?.synced ?? r?.portal?.count ?? null }),
  });
  steps.push({
    name: 'beat-writer',
    path: '/api/recruiting/beat-writer/ingest',
    summarize: (r) => ({
      processedCount: r?.processedCount ?? r?.processed?.length ?? null,
      softFailure: r?.softFailure === true,
    }),
  });
  return steps;
}

async function runIngest() {
  if (!CRON_SECRET) {
    console.error('[recruiting-ingest-cron] MONITORING_CRON_SECRET or INGEST_CRON_SECRET is not set');
    return { ok: false, error: 'missing_cron_secret' };
  }

  return runIngestSteps({
    apiBase: API_BASE,
    cronSecret: CRON_SECRET,
    steps: buildSteps(),
    warm: true,
    logPrefix: 'recruiting-ingest-cron',
  });
}

(async () => {
  try {
    const summary = await runIngest();
    console.log('[recruiting-ingest-cron] complete', JSON.stringify(summary, null, 0));
  } catch (err) {
    console.error('[recruiting-ingest-cron] unhandled error:', err.message);
    if (err.stack) console.error(err.stack);
  }
  process.exit(0);
})();
