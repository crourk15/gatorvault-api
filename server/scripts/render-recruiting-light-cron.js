#!/usr/bin/env node
/**
 * Render cron — light On3 + beat-writer + hub refresh for elite board freshness.
 * Heavy portal / lab-promote stay on the 2h recruiting-ingest cron (Starter OOM guard).
 */
require('./render-cron-env');

const { runIngestSteps } = require('../lib/ingest-cron-client');

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || process.env.API_BASE || 'https://gatorvault-api.onrender.com').replace(
  /\/$/,
  ''
);
const CRON_SECRET = process.env.MONITORING_CRON_SECRET || process.env.INGEST_CRON_SECRET || process.env.CRON_SECRET || '';

const STEPS = [
  {
    name: 'on3',
    path: '/api/recruiting/ingest',
    summarize: (r) => ({ fired: r?.fired?.length ?? 0 }),
  },
  {
    // Keep beat intel flowing into recruiting/FutureCast without waiting on the 2h heavy cron.
    name: 'beat-writer',
    path: '/api/recruiting/beat-writer/ingest',
    summarize: (r) => ({
      processedCount: r?.processedCount ?? r?.processed?.length ?? null,
      softFailure: r?.softFailure === true,
    }),
  },
  {
    name: 'allowlist-intel',
    path: '/api/recruiting/allowlist-intel/sweep',
    summarize: (r) => ({
      createdCount: r?.createdCount ?? null,
      coveragePct: r?.coverage?.coveragePct ?? null,
      missing: Array.isArray(r?.coverage?.missing) ? r.coverage.missing.length : null,
    }),
  },
  {
    name: 'hub-refresh',
    path: '/api/recruiting/hub/refresh?geoBackfill=true',
    summarize: (r) => ({ enrichedPlayerCount: r?.enrichedPlayerCount ?? null }),
  },
];

async function runIngest() {
  if (!CRON_SECRET) {
    console.error('[recruiting-light-cron] MONITORING_CRON_SECRET or INGEST_CRON_SECRET is not set');
    return { ok: false, error: 'missing_cron_secret' };
  }

  return runIngestSteps({
    apiBase: API_BASE,
    cronSecret: CRON_SECRET,
    steps: STEPS,
    warm: true,
    logPrefix: 'recruiting-light-cron',
  });
}

(async () => {
  try {
    const summary = await runIngest();
    console.log('[recruiting-light-cron] complete', JSON.stringify(summary, null, 0));
  } catch (err) {
    console.error('[recruiting-light-cron] unhandled error:', err.message);
    if (err.stack) console.error(err.stack);
  }
  process.exit(0);
})();
