/**
 * Self-Runner 2.0 — structured logging to logs/self-runner.log + ops store.
 */
const fs = require('fs');
const path = require('path');

const SERVER_ROOT = path.join(__dirname, '..', '..');
const LOG_DIR = path.join(SERVER_ROOT, 'logs');
const LOG_FILE = path.join(LOG_DIR, 'self-runner.log');
const JSON_LOG = path.join(SERVER_ROOT, 'data', 'ops', 'self-runner-v2-log.json');
const MAX_JSON_ENTRIES = parseInt(process.env.SELF_RUNNER_LOG_MAX || '2000', 10);

function ensureLogDir() {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function readJsonLog() {
  try {
    return JSON.parse(fs.readFileSync(JSON_LOG, 'utf8'));
  } catch {
    return { entries: [] };
  }
}

function writeJsonLog(doc) {
  fs.mkdirSync(path.dirname(JSON_LOG), { recursive: true });
  fs.writeFileSync(JSON_LOG, JSON.stringify(doc, null, 2));
}

function append(level, event, meta = {}) {
  const entry = {
    at: new Date().toISOString(),
    level,
    event,
    ...meta
  };

  ensureLogDir();
  const line = JSON.stringify(entry);
  try {
    fs.appendFileSync(LOG_FILE, line + '\n');
  } catch {
    /* optional */
  }

  try {
    const doc = readJsonLog();
    doc.entries = Array.isArray(doc.entries) ? doc.entries : [];
    doc.entries.unshift(entry);
    if (doc.entries.length > MAX_JSON_ENTRIES) doc.entries.length = MAX_JSON_ENTRIES;
    doc.updatedAt = entry.at;
    writeJsonLog(doc);
  } catch {
    /* optional */
  }

  const prefix = `[self-runner:${level}]`;
  if (level === 'error') console.error(prefix, event, meta.detail || meta.message || '');
  else if (level === 'warn') console.warn(prefix, event, meta.detail || '');
  else console.log(prefix, event, meta.detail || meta.scanId || '');

  return entry;
}

const log = {
  scan: (meta) => append('info', 'scan', meta),
  issue: (meta) => append('info', 'issue_detected', meta),
  patch: (meta) => append('info', 'patch_proposed', meta),
  apply: (meta) => append('info', 'patch_applied', meta),
  approve: (meta) => append('info', 'patch_approved', meta),
  reject: (meta) => append('info', 'patch_rejected', meta),
  dedupe: (meta) => append('info', 'dedupe_rule', meta),
  schema: (meta) => append('warn', 'schema_violation', meta),
  critical: (meta) => append('error', 'critical', meta),
  guard: (meta) => append('error', 'guard_blocked', meta),
  restore: (meta) => append('warn', 'snapshot_restore', meta),
  multiPatch: (meta) => append('info', 'multi_file_patch', meta),
  warn: (event, meta) => append('warn', event, meta),
  error: (event, meta) => append('error', event, meta),
  info: (event, meta) => append('info', event, meta)
};

function listRecent(limit = 50) {
  const doc = readJsonLog();
  return (doc.entries || []).slice(0, limit);
}

module.exports = {
  LOG_FILE,
  JSON_LOG,
  log,
  listRecent,
  readJsonLog
};
