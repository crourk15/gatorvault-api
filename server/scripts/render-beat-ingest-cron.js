#!/usr/bin/env node
/**
 * Render cron — beat writer + visit intel + live dashboard refresh.
 * Production-hardened: API warm check, retries, soft per-step failures, always exit 0.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { runIngestSteps } = require('../lib/ingest-cron-client');

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || process.env.API_BASE || 'https://gatorvault-api.onrender.com').replace(
  /\/$/,
  ''
);
const CRON_SECRET = process.env.MONITORING_CRON_SECRET || process.env.INGEST_CRON_SECRET || process.env.CRON_SECRET || '';

const STEPS = [
  {
    name: 'live-refresh',
    path: '/api/live/refresh',
    summarize: (r) => ({
      beatPosts: r?.result?.beat?.postCount ?? r?.dashboard?.beat?.posts?.length ?? null,
      beatError: r?.result?.beat?.error ?? null,
      podcastErrors: r?.result?.podcasts?.errors?.length ?? null,
    }),
  },
  {
    name: 'beat-writer',
    path: '/api/recruiting/beat-writer/ingest',
    summarize: (r) => ({
      processedCount: r?.processedCount ?? r?.processed?.length ?? null,
      errors: r?.errors?.length ?? 0,
      softFailure: r?.softFailure === true,
    }),
  },
  {
    name: 'beat-visit',
    path: '/api/recruiting/beat-visit/ingest',
    summarize: (r) => ({
      processedCount: r?.processedCount ?? r?.processed?.length ?? null,
      errors: r?.errors?.length ?? 0,
      softFailure: r?.softFailure === true,
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
