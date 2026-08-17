#!/usr/bin/env node
/**
 * Render cron — 2028+ vault feed at 7am / 7pm Eastern.
 * Schedule fires hourly; script no-ops unless America/New_York hour is 7 or 19
 * (handles EDT/EST). Set VAULT_FEED_FORCE=true to run outside the window (ops).
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
        summarize: (r) => ({
          createdCount: r?.summary?.createdCount ?? r?.created?.length ?? null,
          updatedCount: r?.summary?.updatedCount ?? r?.updated?.length ?? null,
          unresolvedCount: r?.summary?.unresolvedCount ?? null,
          blockedStaffCount: r?.summary?.blockedStaffCount ?? null,
          skipped2027Count: r?.summary?.skipped2027Count ?? null,
          coveragePct: r?.summary?.allowlistCoveragePct ?? null,
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
