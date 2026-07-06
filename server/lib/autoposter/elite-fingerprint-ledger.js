/**
 * Per-player elite compose fingerprint ledger — tracks last sent/rebuilt stack.
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.X_AUTOPOST_DETECTIVES_DATA_DIR
  ? path.resolve(process.env.X_AUTOPOST_DETECTIVES_DATA_DIR)
  : path.join(__dirname, '..', '..', 'data', 'autoposter');
const LEDGER_PATH = path.join(DATA_DIR, 'elite-fingerprint-ledger.json');
const MAX_ENTRIES = parseInt(process.env.X_ELITE_FINGERPRINT_LEDGER_MAX || '2000', 10);

function nowIso() {
  return new Date().toISOString();
}

function normalizeSlug(slug) {
  return String(slug || '')
    .trim()
    .toLowerCase();
}

function defaultDoc() {
  return { version: 1, updatedAt: nowIso(), players: {} };
}

function loadLedger() {
  try {
    const raw = JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf8'));
    if (!raw.players || typeof raw.players !== 'object') return defaultDoc();
    return { ...defaultDoc(), ...raw, players: raw.players };
  } catch {
    return defaultDoc();
  }
}

function saveLedger(doc) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  doc.version = 1;
  doc.updatedAt = nowIso();
  const keys = Object.keys(doc.players || {});
  if (keys.length > MAX_ENTRIES) {
    const sorted = keys
      .map((k) => ({ k, at: doc.players[k]?.recordedAt || '' }))
      .sort((a, b) => String(a.at).localeCompare(String(b.at)));
    for (let i = 0; i < sorted.length - MAX_ENTRIES; i += 1) {
      delete doc.players[sorted[i].k];
    }
  }
  fs.writeFileSync(LEDGER_PATH, JSON.stringify(doc, null, 2));
  return doc;
}

function getEliteFingerprint(slug) {
  const key = normalizeSlug(slug);
  if (!key) return null;
  const row = loadLedger().players[key];
  if (!row?.hash) return null;
  return { slug: key, ...row };
}

function recordEliteFingerprint(slug, fingerprint = {}, meta = {}) {
  const key = normalizeSlug(slug);
  if (!key || !fingerprint?.hash) return null;
  const doc = loadLedger();
  const row = {
    slug: key,
    hash: fingerprint.hash,
    payload: fingerprint.payload || null,
    ok: fingerprint.ok === true,
    recordedAt: nowIso(),
    source: meta.source || 'unknown',
    queueItemId: meta.queueItemId || null,
    tweetId: meta.tweetId || null,
    intelFingerprint: meta.intelFingerprint || null
  };
  doc.players[key] = row;
  saveLedger(doc);
  return row;
}

function listRecordedSlugs() {
  const doc = loadLedger();
  return Object.keys(doc.players || {});
}

module.exports = {
  LEDGER_PATH,
  loadLedger,
  saveLedger,
  getEliteFingerprint,
  recordEliteFingerprint,
  listRecordedSlugs
};
