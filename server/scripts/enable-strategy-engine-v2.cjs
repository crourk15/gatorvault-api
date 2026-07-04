#!/usr/bin/env node
/** Enable PR-5 strategy engine v2 on Render + redeploy + optional golden beat re-ingest. */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { parseBeatPostForVisitIntel } = require('../lib/beat-writer-ingest');
const { postIngest } = require('../lib/ingest-cron-client');
const { warmApi } = require('../lib/ingest-resilience');
const { primaryAdminPin } = require('../lib/admin-pin');

const API = 'https://api.render.com/v1';
const SERVICE_NAME = 'gatorvault-api';
const PROD = (process.env.QA_API_URL || 'https://gatorvault-api.onrender.com').replace(/\/$/, '');
const TARGET_COMMIT = process.argv[2] || '9ba33cd';
const SKIP_REINGEST = process.argv.includes('--no-reingest');

const renderKey = process.env.RENDER_API_KEY;
if (!renderKey) {
  console.error('Missing RENDER_API_KEY in server/.env');
  process.exit(1);
}

const renderHeaders = {
  Authorization: `Bearer ${renderKey}`,
  'Content-Type': 'application/json',
  Accept: 'application/json'
};

const SECRET =
  process.env.MONITORING_CRON_SECRET ||
  process.env.INGEST_CRON_SECRET ||
  process.env.CRON_SECRET ||
  primaryAdminPin();
const PIN = primaryAdminPin();
const ADMIN_H = { 'X-Ops-Pin': PIN, 'X-Ingest-Secret': PIN, 'Content-Type': 'application/json' };

const BEATS = [
  {
    id: 'reingest-drakeford',
    handle: 'Blake_Alderman',
    writerName: 'Blake Alderman',
    publishedAt: '2026-07-03T20:15:13.000Z',
    text:
      'NEW: Florida made a big impression on 2028 safety Ryan Drakeford during his first trip to The Swamp. "Florida is one of those schools at the top of my board." Intel: https://t.co/hIgSlmKKqM'
  },
  {
    id: 'reingest-robinson',
    handle: 'Blake_Alderman',
    writerName: 'Blake Alderman',
    publishedAt: '2026-07-03T19:24:14.000Z',
    text:
      'NEW: Man Robinson says Florida has "all three" of their DB coaches texting him — and after his first visit to Gainesville, the Gators just cracked his early leaderboard.'
  },
  {
    id: 'reingest-willingham',
    handle: 'ttjharden8',
    writerName: 'Tyler Harden',
    publishedAt: '2026-07-03T17:41:09.000Z',
    text:
      'Florida has given 2028 CB Bryce Willingham a lot to like as of late. He was on campus this spring to watch the Gators in spring practice, and they are in a strong position early on with the cornerback out of Atlanta. "Definitely one of my top schools."'
  }
];

async function renderApi(pathname, opts = {}) {
  const res = await fetch(`${API}${pathname}`, { ...opts, headers: { ...renderHeaders, ...opts.headers } });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    throw new Error(`${opts.method || 'GET'} ${pathname} → ${res.status}: ${typeof body === 'string' ? body : JSON.stringify(body)}`);
  }
  return body;
}

async function findService() {
  const rows = await renderApi(`/services?name=${encodeURIComponent(SERVICE_NAME)}&limit=20`);
  const found = (rows || []).find((row) => (row.service || row).name === SERVICE_NAME);
  return found ? found.service || found : null;
}

async function upsertEnvVar(serviceId, key, value) {
  await renderApi(`/services/${serviceId}/env-vars/${encodeURIComponent(key)}`, {
    method: 'PUT',
    body: JSON.stringify({ value: String(value) })
  });
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForDeploy() {
  for (let i = 0; i < 40; i += 1) {
    try {
      const health = await fetch(`${PROD}/api/health`).then((r) => r.json());
      const version = health.deploy?.apiVersion || '';
      const engine = health.deploy?.strategyEngine || '';
      console.log('[enable-v2] deploy', version, 'strategyEngine=', engine || '(missing)');
      if (version.startsWith(TARGET_COMMIT.slice(0, 7)) && engine === 'v2') {
        return health;
      }
    } catch (err) {
      console.log('[enable-v2] health err', err.message);
    }
    await sleep(15000);
  }
  throw new Error(`deploy wait timeout (target ${TARGET_COMMIT}, strategyEngine=v2)`);
}

async function reingestGoldenBeats() {
  console.log('[enable-v2] warming API for re-ingest…');
  await warmApi(PROD);

  const ingestResults = [];
  for (const beat of BEATS) {
    const row = parseBeatPostForVisitIntel(beat, { logSkips: false });
    if (!row?.playerName) {
      ingestResults.push({ beat: beat.id, ok: false, reason: 'parse_failed' });
      continue;
    }
    row.fingerprint = `${row.fingerprint}_v2_${Date.now()}`;
    console.log(`[enable-v2] ingest ${row.playerName} (${beat.id})`);
    try {
      const out = await postIngest(PROD, SECRET, '/api/recruiting/beat-writer/ingest', { row }, { timeoutMs: 180000, attempts: 2 });
      ingestResults.push({
        beat: beat.id,
        player: row.playerName,
        ok: true,
        processed: out.processed,
        skipped: out.skipped,
        reason: out.reason,
        autopost: out.autopost,
        detectives: out.detectives
      });
    } catch (err) {
      ingestResults.push({ beat: beat.id, player: row.playerName, ok: false, error: err.message });
    }
  }

  await fetch(`${PROD}/api/x/autoposter/detectives/process`, {
    method: 'POST',
    headers: ADMIN_H,
    body: JSON.stringify({ limit: 5 })
  }).then((r) => r.json()).catch((err) => ({ error: err.message }));

  console.log('[enable-v2] waiting 45s for detectives…');
  await sleep(45000);

  const det = await fetch(`${PROD}/api/x/autoposter/detectives?limit=100`, { headers: ADMIN_H }).then((r) => r.json());
  const queue = await fetch(`${PROD}/api/x/autoposter/queue`, { headers: ADMIN_H }).then((r) => r.json());
  const items = queue.items || queue.queue || [];
  const watch = /drakeford|robinson|willingham|voice_promote|detectives/i;

  return {
    ingestResults,
    pileCounts: det.counts,
    watchedCases: (det.cases || []).filter((c) => watch.test(JSON.stringify(c))).map((c) => ({
      status: c.status,
      player: c.playerName,
      skipCode: c.skipCode,
      resolvedPath: c.resolvedPath,
      preview: c.resolvedPreview?.slice(0, 180)
    })),
    watchedQueue: items.filter((i) => watch.test(JSON.stringify(i))).map((i) => ({
      status: i.status,
      player: i.playerName,
      path: i.validationMeta?.detectivesPath,
      strategyEngine: i.validationMeta?.strategyTrace?.engine || null,
      confidence: i.validationMeta?.strategyTrace?.confidence || null,
      templateId: i.validationMeta?.strategyTrace?.templateId || null,
      strategyPreview: i.validationMeta?.strategyTrace?.strategyLine?.slice(0, 120) || null,
      textPreview: String(i.text || '').slice(0, 220)
    }))
  };
}

async function main() {
  const svc = await findService();
  if (!svc) throw new Error(`Service ${SERVICE_NAME} not found`);

  console.log('[enable-v2] service', svc.id);
  await upsertEnvVar(svc.id, 'X_AUTOPOST_STRATEGY_ENGINE', 'v2');
  console.log('[enable-v2] set X_AUTOPOST_STRATEGY_ENGINE=v2');

  const deploy = await renderApi(`/services/${svc.id}/deploys`, {
    method: 'POST',
    body: JSON.stringify({ clearCache: 'clear' })
  });
  const row = deploy.deploy || deploy;
  console.log('[enable-v2] deploy triggered', row.id, row.status || 'started');

  const health = await waitForDeploy();
  const summary = {
    at: new Date().toISOString(),
    deploy: health.deploy,
    reingest: SKIP_REINGEST ? { skipped: true } : await reingestGoldenBeats()
  };
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error('[enable-v2] fatal:', err.message);
  process.exit(1);
});
