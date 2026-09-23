#!/usr/bin/env node
/**
 * Render cron — 2028+ vault feed at 7am / 7pm Eastern.
 * Schedule fires hourly; script no-ops unless America/New_York hour is 7–9
 * or 19–21 (8–9am / 8–9pm catch a missed 7 slot). Set VAULT_FEED_FORCE=true
 * to run outside the window (ops). The API accepts immediately and finishes
 * in the background — do not wait on the 30-minute pass.
 */
require('./render-cron-env');

const { runIngestSteps } = require('../lib/ingest-cron-client');
const { isVaultFeedEtWindow } = require('../lib/vault-feed-2028-sweep');

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || process.env.API_BASE || 'https://gatorvault-api.onrender.com').replace(
  /\/$/,
  ''
);
const CRON_SECRET = process.env.MONITORING_CRON_SECRET || process.env.INGEST_CRON_SECRET || process.env.CRON_SECRET || '';

async function runIngest() {
  if (!CRON_SECRET) {
    const err = new Error('MONITORING_CRON_SECRET or INGEST_CRON_SECRET is not set');
    console.error('[vault-feed-2028-cron]', err.message);
    // Non-zero exit so Render does not mark a silent miss as "successful".
    throw err;
  }

  const force = process.env.VAULT_FEED_FORCE === 'true';
  if (!force && !isVaultFeedEtWindow()) {
    console.log('[vault-feed-2028-cron] skip — outside 7am/7pm ET window');
    return { ok: true, skipped: true, reason: 'outside_et_window' };
  }

  return runIngestSteps({
    apiBase: API_BASE,
    cronSecret: CRON_SECRET,
    steps: [
      {
        name: 'vault-feed-2028',
        path: '/api/recruiting/vault-feed-2028/sweep',
        opts: { timeoutMs: 45000, attempts: 3 },
        summarize: (r) => ({
          accepted: r?.accepted === true || r?.started === true || r?.alreadyRunning === true || r?.alreadyDone === true,
          started: r?.started === true,
          alreadyRunning: r?.alreadyRunning === true,
          alreadyDone: r?.alreadyDone === true,
          window: r?.report?.window || r?.window || null,
          slotId: r?.report?.slotId || r?.slotId || null,
          status: r?.report?.status || r?.status || null,
          createdCount: r?.summary?.createdCount ?? r?.report?.summary?.createdCount ?? null,
          updatedCount: r?.summary?.updatedCount ?? r?.report?.summary?.updatedCount ?? null,
          unresolvedCount: r?.summary?.unresolvedCount ?? r?.report?.summary?.unresolvedCount ?? null,
          softFailure: r?.softFailure === true,
        }),
      },
    ],
    warm: true,
    logPrefix: 'vault-feed-2028-cron',
  });
}

(async () => {
  try {
    const summary = await runIngest();
    console.log('[vault-feed-2028-cron] complete', JSON.stringify(summary));
    process.exit(summary && summary.ok === false ? 1 : 0);
  } catch (err) {
    console.error('[vault-feed-2028-cron] unhandled error:', err.message);
    if (err.stack) console.error(err.stack);
    process.exit(1);
  }
})();
