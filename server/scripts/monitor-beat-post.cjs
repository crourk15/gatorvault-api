#!/usr/bin/env node
/** Poll production for a beat tweet through ingest → intel → autoposter (read-only). */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { warmApi } = require('../lib/ingest-resilience');
const { primaryAdminPin } = require('../lib/admin-pin');

const API = (process.env.QA_API_URL || process.env.API_BASE_URL || 'https://gatorvault-api.onrender.com').replace(/\/$/, '');
const PIN =
  process.env.MONITORING_CRON_SECRET ||
  process.env.INGEST_CRON_SECRET ||
  process.env.OPS_ADMIN_PIN ||
  process.env.RECRUITING_ADMIN_PIN ||
  primaryAdminPin();
const HEADERS = PIN ? { 'X-Ops-Pin': PIN, 'X-Ingest-Secret': PIN } : {};

const NEEDLE = process.argv[2] || 'raheem-floyd|Raheem Floyd|floyd';
const NEEDLE_RE = new RegExp(NEEDLE, 'i');

async function getJson(path) {
  const res = await fetch(`${API}${path}`, { headers: HEADERS });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

function pickBeat(posts) {
  return (posts || []).filter((p) => NEEDLE_RE.test(JSON.stringify(p)));
}

function pickLogs(logs) {
  return (logs || []).filter((e) => NEEDLE_RE.test(JSON.stringify(e)));
}

async function poll() {
  await warmApi(API);
  const beat = await getJson('/api/live/beat?limit=50');
  const posts = beat.body?.posts || [];
  const beatHits = pickBeat(posts);

  const player = await getJson('/api/players/raheem-floyd');
  const intel = (player.body?.intel || []).filter((i) => NEEDLE_RE.test(JSON.stringify(i)));

  let opsHits = [];
  let cronHits = [];
  let apHits = [];
  let queueHits = [];
  let heartbeats = {};

  if (PIN) {
    const [opsBw, opsLate, apLogs, queue, status] = await Promise.all([
      getJson('/api/ops/logs?limit=80&subsystem=autoposter:beat-writer'),
      getJson('/api/ops/logs?limit=40&subsystem=cron:beat-late-ingest'),
      getJson('/api/x/autoposter/logs?limit=60'),
      getJson('/api/x/autoposter/queue'),
      getJson('/api/ops/status')
    ]);
    opsHits = pickLogs(opsBw.body?.logs || []);
    cronHits = pickLogs(opsLate.body?.logs || []);
    apHits = pickLogs(apLogs.body?.logs || []);
    queueHits = pickLogs(queue.body?.items || queue.body?.queue || []);
    heartbeats = status.body?.heartbeats?.subsystems || status.body?.subsystems || {};
  }

  const out = {
    at: new Date().toISOString(),
    api: API,
    beat: {
      inFeed: beatHits.length > 0,
      count: beatHits.length,
      latest: beatHits[0]
        ? {
            handle: beatHits[0].handle,
            publishedAt: beatHits[0].publishedAt,
            text: String(beatHits[0].text || '').slice(0, 220)
          }
        : null
    },
    player: {
      ok: player.body?.player?.name || null,
      intelCount: intel.length,
      intel: intel.slice(0, 3).map((i) => ({
        fingerprint: i.fingerprint,
        eventType: i.eventType,
        timestamp: i.timestamp,
        source: i.analystName || i.source,
        detail: String(i.detail || '').slice(0, 140)
      }))
    },
    ops: PIN
      ? {
          beatWriterHits: opsHits.length,
          beatWriterLatest: opsHits[0] || null,
          beatLateHits: cronHits.length,
          beatLateLatest: cronHits[0] || null,
          autoposterLogHits: apHits.length,
          autoposterLogLatest: apHits[0] || null,
          queueHits: queueHits.length,
          queueLatest: queueHits[0] || null,
          heartbeats: {
            beatLate: heartbeats['cron:beat-late-ingest'] || null,
            beatWriter: heartbeats['cron:beat-writer-ingest'] || null
          }
        }
      : { note: 'No ops pin configured — beat + player only' }
  };

  console.log(JSON.stringify(out, null, 2));
  return out;
}

const LOOP_MS = parseInt(process.env.MONITOR_INTERVAL_MS || '90000', 10);
const MAX_POLLS = parseInt(process.env.MONITOR_MAX_POLLS || '8', 10);

async function run() {
  for (let i = 0; i < MAX_POLLS; i += 1) {
    const out = await poll();
    const done = out.player.intelCount > 0 || out.ops?.queueHits > 0;
    if (done) {
      console.error(`\n[monitor] pipeline signal detected on poll ${i + 1}/${MAX_POLLS}`);
      return;
    }
    if (i < MAX_POLLS - 1) {
      console.error(`\n[monitor] poll ${i + 1}/${MAX_POLLS} — waiting ${LOOP_MS / 1000}s…`);
      await new Promise((r) => setTimeout(r, LOOP_MS));
    }
  }
  console.error(`\n[monitor] finished ${MAX_POLLS} polls — no intel/queue yet`);
}

run().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
