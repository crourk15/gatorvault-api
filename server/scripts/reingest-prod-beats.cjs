#!/usr/bin/env node
/** Re-ingest specific UF beat tweets on production + run Detectives pile. */
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

const WATCH = /drakeford|robinson|willingham|woodruff|voice_promote|detectives/i;

async function getJson(path) {
  const res = await fetch(`${API}${path}`, { headers: ADMIN_H });
  return res.json();
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log('[reingest] warming API…');
  await warmApi(API);

  const ingestResults = [];
  for (const beat of BEATS) {
    const row = parseBeatPostForVisitIntel(beat, { logSkips: false });
    if (!row?.playerName) {
      ingestResults.push({ beat: beat.id, ok: false, reason: 'parse_failed' });
      continue;
    }
    row.fingerprint = `${row.fingerprint}_reingest_${Date.now()}`;
    console.log(`[reingest] POST manual row ${row.playerName} (${beat.id})`);
    try {
      const out = await postIngest(API, SECRET, '/api/recruiting/beat-writer/ingest', { row }, { timeoutMs: 180000, attempts: 2 });
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
      ingestResults.push({ beat: beat.id, player: row.playerName, ok: false, error: err.message, payload: err.payload });
    }
  }

  console.log('[reingest] triggering detectives process…');
  let processOut = null;
  try {
    const res = await fetch(`${API}/api/x/autoposter/detectives/process`, {
      method: 'POST',
      headers: ADMIN_H,
      body: JSON.stringify({ limit: 5 })
    });
    processOut = await res.json();
  } catch (err) {
    processOut = { error: err.message };
  }

  console.log('[reingest] waiting 45s for async investigation…');
  await sleep(45000);

  const det = await getJson('/api/x/autoposter/detectives?limit=100');
  const queue = await getJson('/api/x/autoposter/queue');
  const items = queue.items || queue.queue || [];

  const watchedCases = (det.cases || []).filter((c) => WATCH.test(JSON.stringify(c)));
  const watchedQueue = items.filter((i) => WATCH.test(JSON.stringify(i)));

  console.log(
    JSON.stringify(
      {
        at: new Date().toISOString(),
        ingestResults,
        processOut: {
          started: processOut?.started,
          reason: processOut?.reason,
          counts: processOut?.dashboard?.counts
        },
        pileCounts: det.counts,
        watchedCases: watchedCases.map((c) => ({
          status: c.status,
          player: c.playerName,
          skipCode: c.skipCode,
          attempts: c.attempts,
          lastPhase: c.lastPhase,
          resolvedPath: c.resolvedPath,
          voicePromoted: c.voicePromoted,
          salvageable: c.salvageable,
          preview: c.resolvedPreview?.slice(0, 160)
        })),
        watchedQueue: watchedQueue.map((i) => ({
          status: i.status,
          player: i.playerName,
          path: i.validationMeta?.detectivesPath,
          voice: i.validationMeta?.voiceEngine,
          line1: String(i.text || '').split('\n')[0],
          textPreview: String(i.text || '').slice(0, 200)
        }))
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error('[reingest] fatal:', err.message);
  process.exit(1);
});
