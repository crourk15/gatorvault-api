#!/usr/bin/env node
/** PR-5 prod recovery — send queue, re-handoff Robinson/Willingham, validate v2 trace. */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { parseBeatPostForVisitIntel } = require('../lib/beat-writer-ingest');
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

const BEATS = [
  {
    id: 'recover-drakeford',
    handle: 'Blake_Alderman',
    writerName: 'Blake Alderman',
    publishedAt: '2026-07-03T20:15:13.000Z',
    text:
      'NEW: Florida made a big impression on 2028 safety Ryan Drakeford during his first trip to The Swamp. "Florida is one of those schools at the top of my board." Intel: https://t.co/hIgSlmKKqM'
  },
  {
    id: 'recover-robinson',
    handle: 'Blake_Alderman',
    writerName: 'Blake Alderman',
    publishedAt: '2026-07-03T19:24:14.000Z',
    text:
      'NEW: Man Robinson says Florida has "all three" of their DB coaches texting him — and after his first visit to Gainesville, the Gators just cracked his early leaderboard.'
  },
  {
    id: 'recover-willingham',
    handle: 'ttjharden8',
    writerName: 'Tyler Harden',
    publishedAt: '2026-07-03T17:41:09.000Z',
    text:
      'Florida has given 2028 CB Bryce Willingham a lot to like as of late. He was on campus this spring to watch the Gators in spring practice, and they are in a strong position early on with the cornerback out of Atlanta. "Definitely one of my top schools."'
  }
];

const WATCH = /drakeford|robinson|willingham|voice_promote|detectives/i;

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function getJson(path) {
  const res = await fetch(`${API}${path}`, { headers: ADMIN_H });
  return res.json();
}

async function postJson(path, body = {}) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: ADMIN_H,
    body: JSON.stringify(body)
  });
  return res.json();
}

function summarizeQueue(items) {
  return (items || [])
    .filter((i) => WATCH.test(JSON.stringify(i)))
    .map((i) => ({
      status: i.status,
      player: i.playerName,
      path: i.validationMeta?.detectivesPath,
      strategyEngine: i.validationMeta?.strategyTrace?.engine || null,
      confidence: i.validationMeta?.strategyTrace?.confidence || null,
      templateId: i.validationMeta?.strategyTrace?.templateId || null,
      strategyPreview: i.validationMeta?.strategyTrace?.strategyLine?.slice(0, 120) || null,
      textPreview: String(i.text || '').slice(0, 220)
    }));
}

function summarizeCases(cases) {
  return (cases || [])
    .filter((c) => WATCH.test(JSON.stringify(c)))
    .map((c) => ({
      status: c.status,
      player: c.playerName,
      skipCode: c.skipCode,
      resolvedPath: c.resolvedPath,
      preview: c.resolvedPreview?.slice(0, 180)
    }));
}

async function main() {
  console.log('[recover-v2] warming API…');
  await warmApi(API);

  const health = await getJson('/api/health');
  console.log('[recover-v2] deploy', health.deploy?.apiVersion, 'strategyEngine=', health.deploy?.strategyEngine);

  const queueBefore = await getJson('/api/x/autoposter/queue');
  const itemsBefore = queueBefore.items || queueBefore.queue || [];
  console.log('[recover-v2] queue before', summarizeQueue(itemsBefore));

  console.log('[recover-v2] force autoposter run…');
  const runOut = await postJson('/api/x/autoposter/run', { force: true, refill: true, limit: 3, pin: PIN });
  console.log('[recover-v2] run', JSON.stringify({ processed: runOut.processed, posted: runOut.posted, reason: runOut.reason }));

  const ingestResults = [];
  for (const beat of BEATS) {
    const row = parseBeatPostForVisitIntel(beat, { logSkips: false });
    if (!row?.playerName) {
      ingestResults.push({ beat: beat.id, ok: false, reason: 'parse_failed' });
      continue;
    }
    row.fingerprint = `${row.fingerprint}_recover_${Date.now()}`;
    console.log(`[recover-v2] ingest ${row.playerName}`);
    try {
      const out = await postIngest(API, SECRET, '/api/recruiting/beat-writer/ingest', { row }, { timeoutMs: 180000, attempts: 2 });
      ingestResults.push({
        beat: beat.id,
        player: row.playerName,
        ok: true,
        autopost: out.autopost,
        detectives: out.detectives
      });
    } catch (err) {
      ingestResults.push({ beat: beat.id, player: row.playerName, ok: false, error: err.message });
    }
  }

  for (let round = 1; round <= 2; round += 1) {
    console.log(`[recover-v2] detectives process round ${round}`);
    await postJson('/api/x/autoposter/detectives/process', { limit: 5 });
    await sleep(45000);
  }

  const det = await getJson('/api/x/autoposter/detectives?limit=100');
  const queue = await getJson('/api/x/autoposter/queue');
  const items = queue.items || queue.queue || [];

  console.log(
    JSON.stringify(
      {
        at: new Date().toISOString(),
        deploy: health.deploy,
        runOut: { processed: runOut.processed, posted: runOut.posted, reason: runOut.reason },
        ingestResults,
        pileCounts: det.counts,
        watchedCases: summarizeCases(det.cases),
        watchedQueue: summarizeQueue(items)
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error('[recover-v2] fatal:', err.message);
  process.exit(1);
});
