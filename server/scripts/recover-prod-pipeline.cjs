#!/usr/bin/env node
/** Recover production pipeline after deploy — force beat ingest + detectives + queue poll. */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { postIngest } = require('../lib/ingest-cron-client');
const { warmApi } = require('../lib/ingest-resilience');
const { primaryAdminPin } = require('../lib/admin-pin');

const API = (process.env.QA_API_URL || 'https://gatorvault-api.onrender.com').replace(/\/$/, '');
const SECRET =
  process.env.MONITORING_CRON_SECRET ||
  process.env.INGEST_CRON_SECRET ||
  process.env.CRON_SECRET ||
  primaryAdminPin();
const PIN = primaryAdminPin();
const ADMIN_H = { 'X-Ops-Pin': PIN, 'X-Ingest-Secret': PIN, 'Content-Type': 'application/json' };

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForDeploy(targetPrefix) {
  for (let i = 0; i < 36; i += 1) {
    try {
      const health = await fetch(`${API}/api/health`).then((r) => r.json());
      const v = health.deploy?.apiVersion || '';
      console.log('[recover] deploy', v);
      if (v.startsWith(targetPrefix)) return v;
    } catch (e) {
      console.log('[recover] health err', e.message);
    }
    await sleep(10000);
  }
  throw new Error('deploy wait timeout');
}

async function main() {
  const target = process.argv[2] || '1c0721d';
  console.log('[recover] warming API…');
  await warmApi(API);
  await waitForDeploy(target);

  console.log('[recover] force beat-writer ingest…');
  const ingest = await postIngest(API, SECRET, '/api/recruiting/beat-writer/ingest', { force: true }, {
    timeoutMs: 600000,
    attempts: 2
  });

  const retried = (ingest.processed || []).filter((p) => p.retried || p.reason === 'intel_exists_autopost_retry');
  console.log('[recover] ingest processed', (ingest.processed || []).length, 'retried', retried.length);

  for (let round = 0; round < 3; round += 1) {
    console.log('[recover] detectives process round', round + 1);
    await fetch(`${API}/api/x/autoposter/detectives/process`, {
      method: 'POST',
      headers: ADMIN_H,
      body: JSON.stringify({ limit: 5 })
    }).then((r) => r.json()).then((j) => console.log(JSON.stringify({ counts: j.dashboard?.counts, results: j.results?.slice(0, 5) })));
    await sleep(90000);
  }

  const det = await fetch(`${API}/api/x/autoposter/detectives?limit=50`, { headers: ADMIN_H }).then((r) => r.json());
  const queue = await fetch(`${API}/api/x/autoposter/queue`, { headers: ADMIN_H }).then((r) => r.json());
  const items = queue.items || queue.queue || [];
  const watch = /drakeford|robinson|willingham|little|floyd|bender/i;

  console.log(
    JSON.stringify(
      {
        at: new Date().toISOString(),
        ingestSummary: {
          processed: (ingest.processed || []).length,
          skipped: (ingest.skipped || []).length,
          retried: retried.map((r) => ({
            player: r.player,
            autopost: r.autopost,
            detectives: r.detectivesHandoff?.case?.id || r.detectivesHandoff?.created
          }))
        },
        detCounts: det.counts,
        cases: (det.cases || [])
          .filter((c) => watch.test(JSON.stringify(c)))
          .map((c) => ({
            player: c.playerName,
            status: c.status,
            skip: c.skipCode,
            lastPhase: c.lastPhase,
            voicePromoted: c.voicePromoted,
            lastReject: c.lastReject,
            resolvedPath: c.resolvedPath
          })),
        queue: items
          .filter((i) => watch.test(JSON.stringify(i)) || i.status === 'pending')
          .slice(0, 10)
          .map((i) => ({
            status: i.status,
            player: i.playerName,
            path: i.validationMeta?.detectivesPath,
            voice: i.validationMeta?.voiceEngine,
            scheduledAt: i.scheduledAt,
            preview: String(i.text || '').slice(0, 160)
          })),
        queuePending: items.filter((i) => i.status === 'pending').length
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error('[recover] fatal:', err.message);
  process.exit(1);
});
