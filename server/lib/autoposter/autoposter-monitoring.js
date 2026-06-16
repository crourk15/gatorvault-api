/**
 * Autoposter monitoring — ops log, idle alerts, beat/on3/rewrite failure checks.
 */
const fs = require('fs');
const path = require('path');
const webhookClient = require('../monitoring-webhook');

const OPS_LOG_PATH = path.join(__dirname, '..', 'data', 'x', 'autoposter-ops-log.json');
const OPS_LOG_MAX = parseInt(process.env.X_AUTOPOST_OPS_LOG_MAX || '500', 10);

let consecutiveRewriteFailures = 0;

function readOpsDoc() {
  try {
    return JSON.parse(fs.readFileSync(OPS_LOG_PATH, 'utf8'));
  } catch {
    return { version: 1, entries: [] };
  }
}

function logAutoposterEvent(type, details = {}) {
  const entry = {
    type,
    action: type,
    details,
    timestamp: new Date().toISOString()
  };
  const doc = readOpsDoc();
  doc.entries = doc.entries || [];
  doc.entries.unshift({ ts: entry.timestamp, ...entry });
  doc.entries = doc.entries.slice(0, OPS_LOG_MAX);
  doc.updatedAt = new Date().toISOString();
  fs.mkdirSync(path.dirname(OPS_LOG_PATH), { recursive: true });
  fs.writeFileSync(OPS_LOG_PATH, JSON.stringify(doc, null, 2));
  return entry;
}

function trackRewriteOutcome(ok) {
  if (ok) {
    consecutiveRewriteFailures = 0;
    return;
  }
  consecutiveRewriteFailures += 1;
  if (consecutiveRewriteFailures >= 5) {
    checkRewriteFailures({ consecutiveRewriteFailures });
  }
}

function getRewriteFailureStats() {
  const doc = readOpsDoc();
  let consecutive = 0;
  for (const row of doc.entries || []) {
    const action = row.action || row.type;
    if (action === 'rewrite_success' || action === 'rewrite_regen') break;
    if (action === 'rewrite_failed' || action === 'rewrite_failure') consecutive += 1;
    else break;
  }
  return { consecutiveRewriteFailures: Math.max(consecutive, consecutiveRewriteFailures) };
}

async function alertIfIdle(status = {}) {
  const lastPost = status.lastPostSuccess || status.lastPostAttempt || status.lastPostAt;
  if (!lastPost) {
    await webhookClient.send('Autoposter has never posted. Check queue, OAuth, and GM2.');
    logAutoposterEvent('alert_autoposter_never_posted', {});
    return;
  }
  const diffMs = Date.now() - new Date(lastPost).getTime();
  const hours = diffMs / (1000 * 60 * 60);
  if (hours > 6) {
    await webhookClient.send(`Autoposter idle >6h. Check queue, OAuth, GM2, and policy.`);
    logAutoposterEvent('alert_autoposter_idle', { hours: Number(hours.toFixed(1)) });
  }
}

async function checkBeatFreshness(beatStatus = {}) {
  const fetchedAt = beatStatus.cache?.fetchedAt || beatStatus.fetchedAt;
  if (!fetchedAt) return;
  const diffMs = Date.now() - new Date(fetchedAt).getTime();
  const minutes = diffMs / (1000 * 60);
  if (minutes > 15) {
    await webhookClient.send(
      `Beat stream stale >15m. Check X_BEARER_TOKEN or Nitter fallback.`
    );
    logAutoposterEvent('alert_beat_stale', { minutes: Number(minutes.toFixed(1)) });
  }
}

async function checkOn3Ingest(ingestStatus = {}) {
  const lastParsedCount = ingestStatus.lastParsedCount ?? ingestStatus.parsedTotal ?? 0;
  const lastRunAgeHours =
    ingestStatus.lastRunAgeHours ??
    (ingestStatus.lastRun ? (Date.now() - new Date(ingestStatus.lastRun).getTime()) / 3600000 : Infinity);
  if (lastParsedCount === 0 && lastRunAgeHours > 2) {
    await webhookClient.send('On3 ingest idle >2h. Recruiting Hub may be stale.');
    logAutoposterEvent('alert_on3_idle', { lastRunAgeHours: Number(lastRunAgeHours.toFixed(1)) });
  }
}

async function checkRewriteFailures(stats = {}) {
  const count = stats.consecutiveRewriteFailures ?? getRewriteFailureStats().consecutiveRewriteFailures;
  if (count >= 5) {
    await webhookClient.send(
      'Rewrite engine failing repeatedly. Check GM2 prompt, identity matching, and quality checks.'
    );
    logAutoposterEvent('alert_rewrite_failures', { consecutiveRewriteFailures: count });
  }
}

module.exports = {
  OPS_LOG_PATH,
  logAutoposterEvent,
  trackRewriteOutcome,
  getRewriteFailureStats,
  alertIfIdle,
  checkBeatFreshness,
  checkOn3Ingest,
  checkRewriteFailures
};
