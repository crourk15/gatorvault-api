/**
 * GM 2.0 — quarantine store for corrupted identity, invalid intel, malformed records.
 */
const fs = require('fs');
const path = require('path');
const decisionLog = require('./decision-log');

const QUARANTINE_PATH = path.join(__dirname, '..', '..', 'data', 'recruiting', 'gm2-quarantine.json');

function readDoc() {
  try {
    return JSON.parse(fs.readFileSync(QUARANTINE_PATH, 'utf8'));
  } catch {
    return { version: 1, players: {}, signals: [], updatedAt: null };
  }
}

function writeDoc(doc) {
  fs.mkdirSync(path.dirname(QUARANTINE_PATH), { recursive: true });
  doc.updatedAt = new Date().toISOString();
  fs.writeFileSync(QUARANTINE_PATH, JSON.stringify(doc, null, 2));
}

function quarantinePlayer(slug, { reason, errors = [], source = 'gm2', repairHint = null } = {}) {
  if (!slug) return null;
  const doc = readDoc();
  doc.players = doc.players || {};
  doc.players[slug] = {
    slug,
    reason: reason || 'identity_invalid',
    errors,
    source,
    repairHint,
    quarantinedAt: new Date().toISOString(),
    repairedAt: null
  };
  writeDoc(doc);
  decisionLog.logDecision({
    layer: 'quarantine',
    action: 'quarantine',
    playerSlug: slug,
    reason,
    errors
  });
  return doc.players[slug];
}

function quarantineSignal(signal, { reason, errors = [], layer = 'sil' } = {}) {
  const doc = readDoc();
  doc.signals = doc.signals || [];
  const entry = {
    id: `qsig_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    signal,
    reason,
    errors,
    layer,
    quarantinedAt: new Date().toISOString()
  };
  doc.signals.unshift(entry);
  doc.signals = doc.signals.slice(0, 300);
  writeDoc(doc);
  decisionLog.logDecision({
    layer: 'quarantine',
    action: 'quarantine',
    reason,
    errors,
    fingerprint: signal?.fingerprint,
    playerSlug: signal?.playerSlug,
    source: signal?.source
  });
  return entry;
}

function isPlayerQuarantined(slug) {
  if (!slug) return false;
  const doc = readDoc();
  const row = doc.players?.[slug];
  return !!(row && !row.repairedAt);
}

function listQuarantinedPlayers() {
  const doc = readDoc();
  return Object.values(doc.players || {}).filter((p) => !p.repairedAt);
}

function listQuarantinedSignals({ limit = 50 } = {}) {
  return (readDoc().signals || []).slice(0, limit);
}

function releasePlayer(slug) {
  const doc = readDoc();
  if (!doc.players?.[slug]) return null;
  doc.players[slug].repairedAt = new Date().toISOString();
  writeDoc(doc);
  decisionLog.logDecision({ layer: 'quarantine', action: 'allow', playerSlug: slug, reason: 'player_released' });
  return doc.players[slug];
}

function clearPlayerQuarantine(slug) {
  const doc = readDoc();
  if (doc.players?.[slug]) {
    delete doc.players[slug];
    writeDoc(doc);
  }
}

function getStatus() {
  const doc = readDoc();
  const players = Object.values(doc.players || {}).filter((p) => !p.repairedAt);
  return {
    quarantinedPlayers: players.length,
    quarantinedSignals: (doc.signals || []).length,
    players: players.slice(0, 20),
    updatedAt: doc.updatedAt
  };
}

module.exports = {
  QUARANTINE_PATH,
  quarantinePlayer,
  quarantineSignal,
  isPlayerQuarantined,
  listQuarantinedPlayers,
  listQuarantinedSignals,
  releasePlayer,
  clearPlayerQuarantine,
  getStatus
};
