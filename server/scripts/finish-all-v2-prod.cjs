#!/usr/bin/env node
/** Send pending v2 queue + finish Robinson/Willingham Detectives cases. */
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
const WATCH = /drakeford|robinson|willingham|ham/i;
const TIMEOUT = 600000;

const BEATS = [
  {
    id: 'finish-robinson',
    handle: 'Blake_Alderman',
    writerName: 'Blake Alderman',
    publishedAt: '2026-07-03T19:24:14.000Z',
    text:
      'NEW: Man Robinson says Florida has "all three" of their DB coaches texting him — and after his first visit to Gainesville, the Gators just cracked his early leaderboard.'
  },
  {
    id: 'finish-willingham',
    handle: 'ttjharden8',
    writerName: 'Tyler Harden',
    publishedAt: '2026-07-03T17:41:09.000Z',
    text:
      'Florida has given 2028 CB Bryce Willingham a lot to like as of late. He was on campus this spring to watch the Gators in spring practice, and they are in a strong position early on with the cornerback out of Atlanta. "Definitely one of my top schools."'
  }
];

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function getJson(path) {
  const res = await fetch(`${API}${path}`, { headers: ADMIN_H, signal: AbortSignal.timeout(120000) });
  return res.json();
}

async function postJson(path, body = {}) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: ADMIN_H,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT)
  });
  const text = await res.text();
  try {
    return { status: res.status, ok: res.ok, body: JSON.parse(text) };
  } catch {
    return { status: res.status, ok: res.ok, body: text };
  }
}

function summarizeQueue(items) {
  return (items || [])
    .filter((i) => WATCH.test(JSON.stringify(i)))
    .map((i) => ({
      status: i.status,
      player: i.playerName,
      tweetId: i.tweetId || i.xPostId || null,
      path: i.validationMeta?.detectivesPath,
      confidence: i.validationMeta?.strategyTrace?.confidence,
      templateId: i.validationMeta?.strategyTrace?.templateId,
      strategy: i.validationMeta?.strategyTrace?.strategyLine?.slice(0, 100),
      text: String(i.text || '').slice(0, 160)
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
      preview: c.resolvedPreview?.slice(0, 140)
    }));
}

async function runAutoposter(label, limit = 2) {
  console.log(`[finish-all] ${label} (limit=${limit})…`);
  const out = await postJson('/api/x/autoposter/run', { force: true, refill: false, limit, pin: PIN });
  console.log(
    `[finish-all] ${label} status=${out.status}`,
    typeof out.body === 'object'
      ? JSON.stringify({ processed: out.body.processed, posted: out.body.posted, reason: out.body.reason || out.body.cadence?.reason, lastPostAt: out.body.lastPostAt })
      : String(out.body).slice(0, 200)
  );
  return out;
}

async function runDetectives(round) {
  console.log(`[finish-all] detectives round ${round}…`);
  const out = await postJson('/api/x/autoposter/detectives/process', { limit: 5 });
  console.log(
    `[finish-all] detectives ${round}`,
    typeof out.body === 'object'
      ? JSON.stringify({ started: out.body.started, reason: out.body.reason, counts: out.body.dashboard?.counts })
      : String(out.body).slice(0, 120)
  );
  return out;
}

async function main() {
  await warmApi(API);

  let queue = await getJson('/api/x/autoposter/queue');
  let items = queue.items || queue.queue || [];
  console.log('[finish-all] queue start', summarizeQueue(items));

  await runAutoposter('autoposter send pass 1', 2);
  await sleep(15000);

  for (let round = 1; round <= 5; round += 1) {
    await runDetectives(round);
    await sleep(60000);
    const det = await getJson('/api/x/autoposter/detectives?limit=100');
    const pending = (det.cases || []).filter((c) => WATCH.test(JSON.stringify(c)) && c.status === 'pending');
    console.log('[finish-all] pending watched cases', pending.map((c) => c.playerName));
    if (!pending.length) break;
  }

  for (const beat of BEATS) {
    const row = parseBeatPostForVisitIntel(beat, { logSkips: false });
    if (!row?.playerName) continue;
    row.fingerprint = `${row.fingerprint}_finish_${Date.now()}`;
    console.log(`[finish-all] re-ingest ${row.playerName}`);
    try {
      await postIngest(API, SECRET, '/api/recruiting/beat-writer/ingest', { row }, { timeoutMs: 180000, attempts: 2 });
    } catch (err) {
      console.log(`[finish-all] ingest err ${row.playerName}:`, err.message);
    }
  }

  for (let round = 6; round <= 8; round += 1) {
    await runDetectives(round);
    await sleep(60000);
  }

  await runAutoposter('autoposter send pass 2', 3);
  await sleep(15000);

  const det = await getJson('/api/x/autoposter/detectives?limit=100');
  queue = await getJson('/api/x/autoposter/queue');
  items = queue.items || queue.queue || [];
  const status = await getJson('/api/autoposter/status');

  console.log(
    JSON.stringify(
      {
        at: new Date().toISOString(),
        lastPostAt: status.lastPostAt,
        lastPostLabel: status.lastPostLabel,
        pileCounts: det.counts,
        watchedCases: summarizeCases(det.cases),
        watchedQueue: summarizeQueue(items),
        sent: summarizeQueue(items).filter((i) => i.status === 'sent')
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error('[finish-all] fatal:', err.message);
  process.exit(1);
});
