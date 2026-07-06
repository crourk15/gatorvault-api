/**
 * Compose angle history — last N recruiting posts for frequency suppression.
 * JSON ledger (slug-first); migrate to Postgres when volume warrants it.
 */
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./discovery-core');

const STORE_PATH = path.join(DATA_DIR, 'autoposter-compose-angle-history.json');
const HISTORY_WINDOW = parseInt(process.env.COMPOSE_ANGLE_HISTORY_WINDOW || '10', 10);
const HISTORY_TTL_MS = parseInt(
  process.env.COMPOSE_ANGLE_HISTORY_TTL_MS || String(30 * 24 * 60 * 60 * 1000),
  10
);

function enabled() {
  return process.env.COMPOSE_ANGLE_HISTORY !== 'false';
}

function normalizeSlug(raw) {
  return String(raw || '').trim().toLowerCase();
}

function readStore() {
  try {
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  } catch {
    return { entries: [] };
  }
}

function writeStore(doc) {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  doc.updatedAt = new Date().toISOString();
  fs.writeFileSync(STORE_PATH, JSON.stringify(doc, null, 2), 'utf8');
}

function pruneEntries(entries = []) {
  const cutoff = Date.now() - HISTORY_TTL_MS;
  return (entries || [])
    .filter((e) => new Date(e.createdAt || 0).getTime() >= cutoff)
    .slice(0, 200);
}

function getRecentComposeHistory(limit = HISTORY_WINDOW) {
  const entries = pruneEntries(readStore().entries || []);
  return entries.slice(0, limit);
}

function countAngleInHistory(angleBucket, history = null) {
  const rows = history || getRecentComposeHistory();
  const key = String(angleBucket || '').toLowerCase();
  return rows.filter((row) => String(row.angleUsed || '').toLowerCase() === key).length;
}

function recordComposeAngle({
  playerSlug = null,
  angleUsed = null,
  synonymUsed = null,
  templateId = null,
  dominantAngle = null
} = {}) {
  if (!enabled() || !angleUsed) return null;
  const row = {
    playerSlug: normalizeSlug(playerSlug),
    angleUsed: String(angleUsed).toLowerCase(),
    synonymUsed: synonymUsed ? String(synonymUsed) : null,
    templateId: templateId || null,
    dominantAngle: dominantAngle || null,
    createdAt: new Date().toISOString()
  };
  const doc = readStore();
  doc.entries = pruneEntries([row, ...(doc.entries || [])]);
  writeStore(doc);
  return row;
}

function clearComposeHistoryForTests() {
  writeStore({ entries: [] });
}

function getComposeHistorySummary() {
  const entries = getRecentComposeHistory(50);
  return {
    enabled: enabled(),
    window: HISTORY_WINDOW,
    recentCount: entries.length
  };
}

module.exports = {
  enabled,
  HISTORY_WINDOW,
  getRecentComposeHistory,
  countAngleInHistory,
  recordComposeAngle,
  clearComposeHistoryForTests,
  getComposeHistorySummary
};
