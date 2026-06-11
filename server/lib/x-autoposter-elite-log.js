/**
 * Elite Autoposter — research + caption audit log (Admin Hub only).
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data', 'x');
const LOG_PATH = path.join(DATA_DIR, 'autoposter-elite-log.json');
const MAX_ENTRIES = 200;

function readDoc() {
  try {
    return JSON.parse(fs.readFileSync(LOG_PATH, 'utf8'));
  } catch {
    return { version: 1, updatedAt: null, entries: [] };
  }
}

function writeDoc(doc) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  doc.updatedAt = new Date().toISOString();
  fs.writeFileSync(LOG_PATH, JSON.stringify(doc, null, 2));
}

function logEliteCaption(entry) {
  const doc = readDoc();
  const row = {
    id: `elite_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    at: new Date().toISOString(),
    ...entry
  };
  doc.entries.unshift(row);
  if (doc.entries.length > MAX_ENTRIES) doc.entries.length = MAX_ENTRIES;
  writeDoc(doc);

  try {
    const opsMonitor = require('./ops-monitor');
    opsMonitor.logEvent({
      subsystem: 'autoposter:elite',
      status: entry.skipped ? 'skipped' : entry.pass === false ? 'error' : 'success',
      message: entry.skipped
        ? `Elite caption skipped: ${entry.skipReason || 'no signal'}`
        : `Elite ${entry.eventType || 'update'} — ${entry.playerName || 'n/a'}`,
      details: {
        eventType: entry.eventType,
        playerName: entry.playerName,
        sourcesUsed: (entry.sourcesUsed || []).map((s) => s.label || s.id),
        captionPreview: String(entry.finalCaption || '').slice(0, 120)
      }
    });
  } catch {
    /* optional */
  }

  return row;
}

function getDashboard({ limit = 50 } = {}) {
  const doc = readDoc();
  const entries = (doc.entries || []).slice(0, Math.min(limit, MAX_ENTRIES)).map((e) => ({
    ...e,
    timestamp: e.at || e.timestamp
  }));
  return {
    updatedAt: doc.updatedAt,
    entries
  };
}

module.exports = {
  logEliteCaption,
  getDashboard,
  LOG_PATH
};
