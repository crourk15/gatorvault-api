/** Detectives pile — intel that failed filters waits here for investigation. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const DATA_DIR = path.join(__dirname, '..', '..', 'data', 'autoposter');
const PILE_PATH = path.join(DATA_DIR, 'detectives-pile.json');
const MAX_CASES = parseInt(process.env.X_AUTOPOST_DETECTIVES_MAX_CASES || '250', 10);
function nowIso() { return new Date().toISOString(); }
function newCaseId() { return 'det_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex'); }
function defaultDoc() { return { version: 1, updatedAt: nowIso(), cases: [] }; }
function loadPile() {
  try {
    const raw = JSON.parse(fs.readFileSync(PILE_PATH, 'utf8'));
    if (!Array.isArray(raw.cases)) return defaultDoc();
    return { ...defaultDoc(), ...raw, cases: raw.cases };
  } catch { return defaultDoc(); }
}
function savePile(doc) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  doc.version = 1; doc.updatedAt = nowIso();
  if (doc.cases.length > MAX_CASES) doc.cases = doc.cases.slice(-MAX_CASES);
  fs.writeFileSync(PILE_PATH, JSON.stringify(doc, null, 2));
  return doc;
}
function caseFingerprint(payload = {}) {
  const beat = payload.beatPost || {};
  const cand = payload.candidate || {};
  const key = [payload.skipReason || '', beat.id || beat.url || '', beat.text || cand.text || cand.beatText || '', cand.playerSlug || cand.playerName || '', payload.skipStage || ''].join('|');
  return crypto.createHash('sha256').update(key).digest('hex').slice(0, 20);
}
function addCase(payload = {}) {
  const doc = loadPile();
  const fp = caseFingerprint(payload);
  const existing = doc.cases.find((c) => c.fingerprint === fp && c.status !== 'resolved' && c.status !== 'expired');
  if (existing) {
    existing.updatedAt = nowIso();
    existing.lastSkipReason = payload.skipReason || existing.lastSkipReason;
    existing.hints = { ...(existing.hints || {}), ...(payload.hints || {}) };
    savePile(doc);
    return { case: existing, created: false, duplicate: true };
  }
  const row = { id: newCaseId(), fingerprint: fp, status: 'pending', createdAt: nowIso(), updatedAt: nowIso(), attempts: 0, maxAttempts: parseInt(process.env.X_AUTOPOST_DETECTIVES_MAX_ATTEMPTS || '8', 10), skipReason: payload.skipReason || 'filter_reject', skipStage: payload.skipStage || 'enqueue', beatPost: payload.beatPost || null, candidate: payload.candidate || null, hints: payload.hints || {}, investigationLog: [], resolvedCandidate: null, queueItemId: null, resolvedAt: null, resolvedPath: null };
  doc.cases.push(row); savePile(doc);
  return { case: row, created: true, duplicate: false };
}
function listCases({ status = null, limit = 50 } = {}) {
  const doc = loadPile();
  let rows = [...doc.cases];
  if (status) rows = rows.filter((c) => c.status === status);
  rows.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  return rows.slice(0, limit);
}
function getCase(id) { return loadPile().cases.find((c) => c.id === id) || null; }
function updateCase(id, patch = {}) {
  const doc = loadPile(); const idx = doc.cases.findIndex((c) => c.id === id);
  if (idx < 0) return null;
  doc.cases[idx] = { ...doc.cases[idx], ...patch, updatedAt: nowIso() };
  savePile(doc); return doc.cases[idx];
}
function appendLog(id, entry) {
  const doc = loadPile(); const idx = doc.cases.findIndex((c) => c.id === id);
  if (idx < 0) return null;
  const log = doc.cases[idx].investigationLog || [];
  log.push({ at: nowIso(), ...entry });
  doc.cases[idx].investigationLog = log.slice(-30);
  doc.cases[idx].updatedAt = nowIso();
  savePile(doc); return doc.cases[idx];
}
function countByStatus() {
  const doc = loadPile(); const out = { pending: 0, investigating: 0, resolved: 0, failed: 0, expired: 0 };
  for (const c of doc.cases) { const s = c.status || 'pending'; out[s] = (out[s] || 0) + 1; }
  return out;
}
module.exports = { PILE_PATH, loadPile, savePile, addCase, listCases, getCase, updateCase, appendLog, caseFingerprint, countByStatus };