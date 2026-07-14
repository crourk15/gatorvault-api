#!/usr/bin/env node
/**
 * Render cron — beat writer + visit intel + live dashboard refresh.
 * Production-hardened: API warm check, retries, soft per-step failures, always exit 0.
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
    // Light path only on Starter — full live-refresh / beat-writer ingest OOMs the API.
    name: 'beat-refresh',
    path: '/api/live/beat/refresh',
    summarize: (r) => ({
      beatPosts: r?.refreshed?.posts?.length ?? r?.beat?.posts?.length ?? null,
      beatError: r?.refreshed?.error ?? r?.error ?? null,
      source: r?.refreshed?.source ?? null,
    }),
  },
];

async function runIngest() {
  if (!CRON_SECRET) {
    console.error('[beat-ingest-cron] MONITORING_CRON_SECRET or INGEST_CRON_SECRET is not set');
    return { ok: false, error: 'missing_cron_secret' };
  }

  return runIngestSteps({
    apiBase: API_BASE,
    cronSecret: CRON_SECRET,
    steps: STEPS,
    warm: true,
    logPrefix: 'beat-ingest-cron',
  });
}

(async () => {
  try {
    const summary = await runIngest();
    console.log('[beat-ingest-cron] complete', JSON.stringify(summary, null, 0));
  } catch (err) {
    console.error('[beat-ingest-cron] unhandled error:', err.message);
    if (err.stack) console.error(err.stack);
  }
  process.exit(0);
})();
