/**
 * GV-OM central heartbeat and event log store.
 */
const fs = require('fs');
const path = require('path');

const OPS_DIR = path.join(__dirname, '..', 'data', 'ops');
const LOG_PATH = path.join(OPS_DIR, 'ops-log.json');
const HEARTBEAT_PATH = path.join(OPS_DIR, 'heartbeats.json');
const MAX_EVENTS = 2000;

function nowIso() {
  return new Date().toISOString();
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function loadLogDoc() {
  const doc = readJson(LOG_PATH, { version: 1, updatedAt: null, events: [] });
  if (!Array.isArray(doc.events)) doc.events = [];
  return doc;
}

function loadHeartbeatDoc() {
  const doc = readJson(HEARTBEAT_PATH, { version: 1, updatedAt: null, subsystems: {} });
  if (!doc.subsystems || typeof doc.subsystems !== 'object') doc.subsystems = {};
  return doc;
}

function sanitizeDetails(details) {
  if (!details || typeof details !== 'object') return details || null;
  const out = { ...details };
  const secretKeys = /token|secret|password|pin|key|authorization|bearer/i;
  for (const k of Object.keys(out)) {
    if (secretKeys.test(k)) out[k] = '[redacted]';
    if (typeof out[k] === 'string' && out[k].length > 2000) out[k] = out[k].slice(0, 2000) + '…';
  }
  return out;
}

function logEvent({ subsystem, status = 'success', message = '', details = null, counts = null } = {}) {
  if (!subsystem) return null;
  const ts = nowIso();
  const event = {
    id: `ops_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    subsystem,
    status,
    message: String(message || '').slice(0, 500),
    details: sanitizeDetails(details),
    counts: counts || null,
    timestamp: ts
  };

  const doc = loadLogDoc();
  doc.events.unshift(event);
  if (doc.events.length > MAX_EVENTS) doc.events.length = MAX_EVENTS;
  doc.updatedAt = ts;
  writeJson(LOG_PATH, doc);

  if (['success', 'warning', 'error', 'skipped', 'started'].includes(status)) {
    heartbeat({ subsystem, status, message, details, counts, timestamp: ts });
  }

  try {
    const alerts = require('./ops-alerts');
    alerts.evaluateEvent(event).catch(() => {});
  } catch {
    /* alerts optional at boot */
  }

  return event;
}

function heartbeat({
  subsystem,
  status = 'success',
  message = '',
  details = null,
  counts = null,
  timestamp = null
} = {}) {
  if (!subsystem) return null;
  const ts = timestamp || nowIso();
  const doc = loadHeartbeatDoc();
  const prev = doc.subsystems[subsystem] || {};
  const entry = {
    subsystem,
    lastRun: ts,
    lastStatus: status,
    lastMessage: String(message || '').slice(0, 300),
    lastDetails: sanitizeDetails(details),
    lastCounts: counts || null,
    lastSuccess: prev.lastSuccess || null,
    lastFailure: prev.lastFailure || null,
    lastWarning: prev.lastWarning || null,
    failureStreak: prev.failureStreak || 0
  };

  if (status === 'success') {
    entry.lastSuccess = ts;
    entry.failureStreak = 0;
  } else if (status === 'error') {
    entry.lastFailure = ts;
    entry.failureStreak = (prev.failureStreak || 0) + 1;
  } else if (status === 'warning') {
    entry.lastWarning = ts;
  } else if (status === 'started') {
    entry.lastStarted = ts;
  }

  doc.subsystems[subsystem] = entry;
  doc.updatedAt = ts;
  writeJson(HEARTBEAT_PATH, doc);
  return entry;
}

function getHeartbeats() {
  return loadHeartbeatDoc();
}

function getHeartbeat(subsystem) {
  return loadHeartbeatDoc().subsystems[subsystem] || null;
}

function getLogs({ subsystem = null, limit = 100, since = null, status = null } = {}) {
  const doc = loadLogDoc();
  let events = doc.events || [];
  if (subsystem) events = events.filter((e) => e.subsystem === subsystem || e.subsystem.startsWith(subsystem));
  if (status) events = events.filter((e) => e.status === status);
  if (since) {
    const t = new Date(since).getTime();
    events = events.filter((e) => new Date(e.timestamp).getTime() >= t);
  }
  const capped = events.slice(0, Math.min(Math.max(parseInt(limit, 10) || 100, 1), 500));
  return { updatedAt: doc.updatedAt, events: capped, total: events.length };
}

function countEventsSince(subsystem, msAgo, statusFilter = null) {
  const cutoff = Date.now() - msAgo;
  const events = loadLogDoc().events || [];
  return events.filter((e) => {
    if (subsystem && e.subsystem !== subsystem && !e.subsystem.startsWith(subsystem)) return false;
    if (statusFilter && e.status !== statusFilter) return false;
    return new Date(e.timestamp).getTime() >= cutoff;
  }).length;
}

function getErrorCount24h(subsystem = null) {
  return countEventsSince(subsystem, 24 * 3600000, 'error');
}

async function wrapJob(jobId, subsystem, fn, { message = '' } = {}) {
  logEvent({ subsystem, status: 'started', message: message || `${jobId} started` });
  try {
    const result = await fn();
    const counts =
      result && typeof result === 'object'
        ? {
            processed: result.processedCount ?? result.processed?.length ?? result.count ?? null,
            skipped: result.skipped?.length ?? result.skippedCount ?? null,
            errors: result.errors?.length ?? null
          }
        : null;
    const status =
      result?.ok === false || (Array.isArray(result?.errors) && result.errors.length)
        ? 'warning'
        : 'success';
    logEvent({
      subsystem,
      status,
      message: message || `${jobId} completed`,
      details: result && typeof result === 'object' ? { summary: summarizeResult(result) } : null,
      counts
    });
    return result;
  } catch (err) {
    logEvent({
      subsystem,
      status: 'error',
      message: err.message || `${jobId} failed`,
      details: { stack: String(err.stack || '').slice(0, 800) }
    });
    throw err;
  }
}

function summarizeResult(result) {
  if (!result || typeof result !== 'object') return null;
  const keys = [
    'ok',
    'processedCount',
    'skippedCount',
    'count',
    'fired',
    'lastRun',
    'queued',
    'reason'
  ];
  const out = {};
  for (const k of keys) {
    if (result[k] != null) {
      out[k] = Array.isArray(result[k]) ? result[k].length : result[k];
    }
  }
  return Object.keys(out).length ? out : null;
}

function ageMs(iso) {
  if (!iso) return null;
  return Date.now() - new Date(iso).getTime();
}

function statusFromAge(age, { warningMs, criticalMs }) {
  if (age == null) return 'red';
  if (age <= warningMs) return 'green';
  if (age <= criticalMs) return 'yellow';
  return 'red';
}

module.exports = {
  OPS_DIR,
  LOG_PATH,
  HEARTBEAT_PATH,
  logEvent,
  heartbeat,
  getHeartbeats,
  getHeartbeat,
  getLogs,
  countEventsSince,
  getErrorCount24h,
  wrapJob,
  ageMs,
  statusFromAge,
  sanitizeDetails
};
