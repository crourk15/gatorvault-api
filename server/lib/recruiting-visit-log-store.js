/**
 * Append-only visit log — dedupe via fingerprint (player + school + type + date).
 */
const fs = require('fs');
const path = require('path');
const { normalizeIntelTimestamp } = require('./commit-fingerprint');

const DATA_DIR = process.env.RECRUITING_TEST_DATA_DIR
  ? path.resolve(process.env.RECRUITING_TEST_DATA_DIR)
  : path.join(__dirname, '..', 'data', 'recruiting');
const VISIT_LOGS_PATH = path.join(DATA_DIR, 'visit_logs.json');

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
  return readJson(VISIT_LOGS_PATH, { version: 1, updatedAt: null, items: [] });
}

function saveDoc(doc) {
  doc.updatedAt = nowIso();
  writeJson(VISIT_LOGS_PATH, doc);
  return doc;
}

function visitLogFingerprint(raw) {
  if (raw.fingerprint) return raw.fingerprint;
  const slug = String(raw.playerSlug || '').trim().toLowerCase();
  const school = String(raw.school || 'Florida').trim().toLowerCase();
  const visitType = String(raw.visitType || raw.eventType || 'visit').trim().toLowerCase();
  const date = normalizeIntelTimestamp(raw.date || raw.reportedAt || raw.timestamp);
  if (!slug || !visitType) return null;
  return `visit|${slug}|${school}|${visitType}|${date}`;
}

function normalizeVisitLog(raw) {
  const fingerprint = visitLogFingerprint(raw);
  const playerSlug = String(raw.playerSlug || '').trim();
  const visitType = String(raw.visitType || raw.eventType || 'visit').trim().toLowerCase();
  const reportedAt = raw.reportedAt || raw.timestamp || nowIso();
  return {
    id: raw.id || `vlog_${playerSlug}_${visitType}_${normalizeIntelTimestamp(raw.date || reportedAt)}`,
    playerSlug,
    playerId: raw.playerId != null ? String(raw.playerId) : raw.on3Id != null ? String(raw.on3Id) : null,
    playerName: raw.playerName || null,
    school: raw.school || 'Florida',
    visitType,
    date: raw.date || normalizeIntelTimestamp(reportedAt),
    source: raw.source || 'manual',
    fingerprint,
    reportedAt,
    detail: raw.detail || null,
  };
}

function appendVisitLog(entry) {
  const row = normalizeVisitLog(entry);
  if (!row.playerSlug || !row.fingerprint) {
    return { item: null, created: false, duplicate: false, reason: 'invalid' };
  }

  const { isVerifiedVisitLogSource } = require('./visit-intel-utils');
  const isOfficial = String(row.visitType || '').includes('official');
  if (isOfficial && !isVerifiedVisitLogSource(row.source, entry)) {
    return { item: null, created: false, duplicate: false, reason: 'unverified_source' };
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

function listVisitLogs({ playerSlug = null, limit = 100, since = null } = {}) {
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
  VISIT_LOGS_PATH,
  visitLogFingerprint,
  normalizeVisitLog,
  appendVisitLog,
  listVisitLogs,
  loadDoc,
};
