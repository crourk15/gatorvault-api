/**
 * Server-side Vault Points ledger — keyed by user email.
 */
const fs = require('fs');
const path = require('path');
const { pointsTierFromPoints, nextPointsTierInfo } = require('./access-config');

const DATA_PATH = path.join(__dirname, '..', 'data', 'users-points.json');

function readDoc() {
  try {
    return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  } catch {
    return { version: 1, updatedAt: null, users: {} };
  }
}

function writeDoc(doc) {
  fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
  doc.updatedAt = new Date().toISOString();
  fs.writeFileSync(DATA_PATH, JSON.stringify(doc, null, 2));
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

module.exports = {
  getUserPoints,
  awardPoints,
  setPoints
};
