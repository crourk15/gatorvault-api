#!/usr/bin/env node
/** Trigger production beat-writer ingest (force). */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { postIngest } = require('../lib/ingest-cron-client');
const { primaryAdminPin } = require('../lib/admin-pin');

const api = (process.env.QA_API_URL || process.env.NEXT_PUBLIC_API_BASE || 'https://gatorvault-api.onrender.com').replace(
  /\/$/,
  ''
);
const secret =
  process.env.MONITORING_CRON_SECRET ||
  process.env.INGEST_CRON_SECRET ||
  process.env.CRON_SECRET ||
  primaryAdminPin();

const timeoutMs = parseInt(process.env.BEAT_INGEST_TRIGGER_TIMEOUT_MS || '900000', 10);

async function main() {
  console.log(`[trigger] POST ${api}/api/recruiting/beat-writer/ingest force=true timeout=${timeoutMs}ms`);
  const result = await postIngest(
    api,
    secret,
    '/api/recruiting/beat-writer/ingest',
    { force: true },
    { timeoutMs, attempts: 1 }
  );
  const all = [...(result.processed || []), ...(result.skipped || [])];
  const floyd = all.filter((x) => /floyd|raheem|intelDuplicate/i.test(JSON.stringify(x)));
  const summary = {
    ok: result.ok,
    processed: (result.processed || []).length,
    skipped: (result.skipped || []).length,
    errors: (result.errors || []).length,
    floydRelated: floyd,
    sampleProcessed: (result.processed || []).slice(0, 5),
    sampleSkipped: (result.skipped || [])
      .slice(0, 10)
      .map((s) => ({
        reason: s.reason,
        player: s.player,
        fingerprint: s.fingerprint,
        intelDuplicateRetry: s.intelDuplicateRetry,
        autopost: s.autopost
      }))
  };
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error('[trigger] failed:', err.message);
  if (err.payload) console.error(JSON.stringify(err.payload, null, 2));
  process.exit(1);
});
