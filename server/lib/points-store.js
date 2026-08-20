/**
 * Server-side Vault Points ledger — keyed by user email.
 * Prefer GV_POINTS_PATH on Render disk so redeploys do not wipe balances.
 */
const fs = require('fs');
const path = require('path');
const { pointsTierFromPoints, nextPointsTierInfo } = require('./access-config');

function defaultPointsPath() {
  return path.join(__dirname, '..', 'data', 'users-points.json');
}

function pointsPath() {
  return process.env.GV_POINTS_PATH || defaultPointsPath();
}

function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function atomicWriteJson(filePath, value) {
  ensureParentDir(filePath);
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), 'utf8');
  fs.renameSync(tmp, filePath);
}

function emptyDoc() {
  return { version: 1, updatedAt: null, users: {} };
}

function readJsonDoc(filePath) {
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!raw || typeof raw !== 'object') return emptyDoc();
    return {
      version: raw.version || 1,
      updatedAt: raw.updatedAt || null,
      users: raw.users && typeof raw.users === 'object' ? raw.users : {},
    };
  } catch {
    return emptyDoc();
  }
}

let migrateAttempted = false;

function migratePointsFromLegacyIfNeeded() {
  const dest = pointsPath();
  const legacy = defaultPointsPath();
  if (path.resolve(dest) === path.resolve(legacy)) return { migrated: false, reason: 'same_path' };
  if (fs.existsSync(dest)) {
    const existing = readJsonDoc(dest);
    if (Object.keys(existing.users || {}).length > 0) {
      return { migrated: false, reason: 'dest_has_points', count: Object.keys(existing.users).length };
    }
  }
  if (!fs.existsSync(legacy)) return { migrated: false, reason: 'no_legacy' };
  const legacyDoc = readJsonDoc(legacy);
  if (!Object.keys(legacyDoc.users || {}).length) return { migrated: false, reason: 'legacy_empty' };
  atomicWriteJson(dest, legacyDoc);
  return { migrated: true, count: Object.keys(legacyDoc.users).length, from: legacy, to: dest };
}

function readDoc() {
  if (!migrateAttempted) {
    migrateAttempted = true;
    try {
      const result = migratePointsFromLegacyIfNeeded();
      if (result.migrated) {
        console.log(
          `[points-store] migrated ${result.count} point ledger(s) from ephemeral path → ${result.to}`
        );
      }
    } catch (err) {
      console.warn('[points-store] migrate failed:', err instanceof Error ? err.message : err);
    }
  }
  return readJsonDoc(pointsPath());
}

function writeDoc(doc) {
  doc.updatedAt = new Date().toISOString();
  atomicWriteJson(pointsPath(), doc);
}

function normalizeEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase();
}

function getUserPoints(email) {
  const key = normalizeEmail(email);
  if (!key) return { points: 0, tier: 'scout', history: [] };
  const doc = readDoc();
  const row = doc.users[key] || { points: 0, history: [] };
  const points = Math.max(0, parseInt(row.points, 10) || 0);
  return {
    points,
    tier: pointsTierFromPoints(points),
    history: (row.history || []).slice(0, 50)
  };
}

function awardPoints(email, amount, reason = 'activity') {
  const key = normalizeEmail(email);
  if (!key) throw new Error('Email required');
  const delta = parseInt(amount, 10);
  if (!delta || Number.isNaN(delta)) throw new Error('Invalid points amount');

  const doc = readDoc();
  doc.users = doc.users || {};
  const row = doc.users[key] || { points: 0, history: [] };
  const prev = Math.max(0, parseInt(row.points, 10) || 0);
  const next = Math.max(0, prev + delta);
  row.points = next;
  row.history = row.history || [];
  row.history.unshift({
    delta,
    reason,
    at: new Date().toISOString(),
    balance: next
  });
  row.history = row.history.slice(0, 100);
  doc.users[key] = row;
  writeDoc(doc);

  const tier = pointsTierFromPoints(next);
  return {
    points: next,
    tier,
    awarded: delta,
    ...nextPointsTierInfo(next)
  };
}

function setPoints(email, points) {
  const key = normalizeEmail(email);
  if (!key) throw new Error('Email required');
  const next = Math.max(0, parseInt(points, 10) || 0);
  const doc = readDoc();
  doc.users = doc.users || {};
  const row = doc.users[key] || { points: 0, history: [] };
  row.points = next;
  doc.users[key] = row;
  writeDoc(doc);
  return { points: next, tier: pointsTierFromPoints(next), ...nextPointsTierInfo(next) };
}

function deleteUserPoints(email) {
  const key = normalizeEmail(email);
  if (!key) return false;
  const doc = readDoc();
  if (!doc.users?.[key]) return false;
  delete doc.users[key];
  writeDoc(doc);
  return true;
}

module.exports = {
  getUserPoints,
  awardPoints,
  setPoints,
  deleteUserPoints,
  get pointsPath() {
    return pointsPath();
  },
};
