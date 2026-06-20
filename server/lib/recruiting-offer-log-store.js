/**
 * Append-only offer log — dedupe via fingerprint (player + school + date).
 */
const fs = require('fs');
const path = require('path');
const { normalizeIntelTimestamp } = require('./commit-fingerprint');

const DATA_DIR = process.env.RECRUITING_TEST_DATA_DIR
  ? path.resolve(process.env.RECRUITING_TEST_DATA_DIR)
  : path.join(__dirname, '..', 'data', 'recruiting');
const OFFER_LOGS_PATH = path.join(DATA_DIR, 'offer_logs.json');

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

function loadDoc() {
  return readJson(OFFER_LOGS_PATH, { version: 1, updatedAt: null, items: [] });
}

function saveDoc(doc) {
  doc.updatedAt = nowIso();
  writeJson(OFFER_LOGS_PATH, doc);
  return doc;
}

function offerLogFingerprint(raw) {
  if (raw.fingerprint) return raw.fingerprint;
  const slug = String(raw.playerSlug || '').trim().toLowerCase();
  const school = String(raw.school || 'Florida').trim().toLowerCase();
  const offerType = String(raw.offerType || 'offer').trim().toLowerCase();
  const date = normalizeIntelTimestamp(raw.date || raw.reportedAt || raw.timestamp);
  if (!slug || !school) return null;
  return `offer|${slug}|${school}|${offerType}|${date}`;
}

function normalizeOfferLog(raw) {
  const fingerprint = offerLogFingerprint(raw);
  const playerSlug = String(raw.playerSlug || '').trim();
  const reportedAt = raw.reportedAt || raw.timestamp || nowIso();
  return {
    id: raw.id || `olog_${playerSlug}_${normalizeIntelTimestamp(raw.date || reportedAt)}`,
    playerSlug,
    playerId: raw.playerId != null ? String(raw.playerId) : raw.on3Id != null ? String(raw.on3Id) : null,
    school: raw.school || 'Florida',
    offerType: raw.offerType || null,
    date: raw.date || normalizeIntelTimestamp(reportedAt),
    source: raw.source || 'manual',
    fingerprint,
    reportedAt,
    detail: raw.detail || null,
  };
}

function appendOfferLog(entry) {
  const row = normalizeOfferLog(entry);
  if (!row.playerSlug || !row.fingerprint) {
    return { item: null, created: false, duplicate: false, reason: 'invalid' };
  }

  const doc = loadDoc();
  doc.items = doc.items || [];
  if (doc.items.some((i) => i.fingerprint === row.fingerprint)) {
    return { item: doc.items.find((i) => i.fingerprint === row.fingerprint), created: false, duplicate: true };
  }

  doc.items.unshift(row);
  saveDoc(doc);
  return { item: row, created: true, duplicate: false };
}

function listOfferLogs({ playerSlug = null, limit = 100, since = null } = {}) {
  const doc = loadDoc();
  let items = [...(doc.items || [])];
  if (playerSlug) {
    const key = String(playerSlug).toLowerCase();
    items = items.filter((i) => String(i.playerSlug || '').toLowerCase() === key);
  }
  if (since) {
    const cutoff = new Date(since).getTime();
    items = items.filter((i) => new Date(i.reportedAt || i.date).getTime() >= cutoff);
  }
  items.sort((a, b) => new Date(b.reportedAt || b.date) - new Date(a.reportedAt || a.date));
  return items.slice(0, limit);
}

module.exports = {
  OFFER_LOGS_PATH,
  offerLogFingerprint,
  normalizeOfferLog,
  appendOfferLog,
  listOfferLogs,
  loadDoc,
};
