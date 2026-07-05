/** Detectives pile — intel that failed filters waits here for investigation. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { beatTextFromPayload } = require('./detectives-handoff');

const DATA_DIR = process.env.X_AUTOPOST_DETECTIVES_DATA_DIR
  ? path.resolve(process.env.X_AUTOPOST_DETECTIVES_DATA_DIR)
  : path.join(__dirname, '..', '..', 'data', 'autoposter');
const PILE_PATH = path.join(DATA_DIR, 'detectives-pile.json');
const MAX_CASES = parseInt(process.env.X_AUTOPOST_DETECTIVES_MAX_CASES || '250', 10);

/** One open pile row per player + topic (commit day, visit, RPM pick, etc.). */
const CLUSTER_TOPICS = new Set([
  'commit',
  'flip',
  'decommit',
  'official_visit',
  'unofficial_visit',
  'prediction',
  'offer',
  'decision',
  'visit_cancelled',
  'ov_change'
]);

const OPEN_STATUSES = new Set(['pending', 'investigating', 'failed']);

const TERMINAL_STATUSES = new Set([
  'resolved',
  'resolved_publish',
  'resolved_archive',
  'failed_final',
  'expired'
]);

function nowIso() {
  return new Date().toISOString();
}

function newCaseId() {
  return 'det_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
}

function defaultDoc() {
  return { version: 1, updatedAt: nowIso(), cases: [] };
}

function loadPile() {
  try {
    const raw = JSON.parse(fs.readFileSync(PILE_PATH, 'utf8'));
    if (!Array.isArray(raw.cases)) return defaultDoc();
    return { ...defaultDoc(), ...raw, cases: raw.cases };
  } catch {
    return defaultDoc();
  }
}

function savePile(doc) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  doc.version = 1;
  doc.updatedAt = nowIso();
  if (doc.cases.length > MAX_CASES) doc.cases = doc.cases.slice(-MAX_CASES);
  fs.writeFileSync(PILE_PATH, JSON.stringify(doc, null, 2));
  return doc;
}

function hashKey(parts) {
  return crypto.createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 20);
}

function normalizeBeatText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/[^\w\s'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function resolvePlayerKey(payload = {}) {
  const cand = payload.candidate || {};
  const hints = payload.hints || {};
  const beat = payload.beatPost || {};

  if (cand.playerSlug) return String(cand.playerSlug).toLowerCase();
  if (hints.playerSlug) return String(hints.playerSlug).toLowerCase();
  if (beat.playerSlug) return String(beat.playerSlug).toLowerCase();

  let playerName = cand.playerName || hints.playerName || beat.playerName || null;
  if (!playerName) {
    try {
      const copy = require('../x-autoposter-copy');
      playerName = copy.extractPlayerFromText(beatTextFromPayload(payload));
      if (playerName && !copy.isValidPlayerName(playerName)) playerName = null;
    } catch {
      playerName = null;
    }
  }
  if (!playerName) return '';
  try {
    return require('../slug').slugify(playerName);
  } catch {
    return String(playerName).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }
}

function normalizeTopicKey(raw) {
  const t = String(raw || '').toLowerCase().trim();
  if (!t) return 'target_update';
  if (/commit|pledge/.test(t) && !/decommit|flip/.test(t)) return 'commit';
  if (/flip|decommit/.test(t)) return 'flip';
  if (/prediction|rpm|futurecast/.test(t)) return 'prediction';
  if (/official_visit|\bov\b/.test(t)) return 'official_visit';
  if (/unofficial_visit|\buv\b/.test(t)) return 'unofficial_visit';
  if (/offer|verbal/.test(t)) return 'offer';
  if (/decision/.test(t)) return 'decision';
  if (/visit_cancel|ov_change/.test(t)) return 'visit_cancelled';
  return t.replace(/[^a-z0-9_]+/g, '_') || 'target_update';
}

function resolveTopicKey(payload = {}) {
  const cand = payload.candidate || {};
  const hints = payload.hints || {};
  const beat = payload.beatPost || {};
  const fromMeta =
    cand.sourceEventType ||
    cand.intelType ||
    hints.eventType ||
    beat.eventType ||
    payload.eventType ||
    null;
  if (fromMeta) return normalizeTopicKey(fromMeta);

  const text = beatTextFromPayload(payload);
  if (/\bdecision day\b|\bsets commitment date\b|\bcommitment date\b/i.test(text)) return 'decision';
  if (/\bcommitted to florida\b|\bcommits to florida\b|\bflips to florida\b/i.test(text)) return 'commit';
  if (/\bflip(?:ped|s)? to\b|\bdecommit/i.test(text)) return 'flip';
  if (/\brpm\b|\bprediction\b|\bfuturecast\b/i.test(text)) return 'prediction';
  if (/official\s+visit|\bov\b/i.test(text) && !/unofficial/i.test(text)) return 'official_visit';
  if (/unofficial\s+visit|\buv\b|on\s+campus|the\s+swamp|friday night lights|\bfnl\b/i.test(text)) {
    return 'unofficial_visit';
  }
  if (/\boffer(?:ed|s)?\b|\bverbal\b/i.test(text)) return 'offer';
  return 'target_update';
}

function semanticDedupeKey(payload = {}) {
  const player = resolvePlayerKey(payload);
  const topic = resolveTopicKey(payload);
  const text = normalizeBeatText(beatTextFromPayload(payload));

  if (player && CLUSTER_TOPICS.has(topic)) {
    return hashKey(['player-topic', player, topic]);
  }
  if (player && text) {
    return hashKey(['player-text', player, topic, text.slice(0, 160)]);
  }

  const beat = payload.beatPost || {};
  const url = String(beat.url || beat.id || '').trim();
  if (url && text) return hashKey(['url-text', url, text.slice(0, 200)]);
  if (text) return hashKey(['text-only', text.slice(0, 220)]);
  return hashKey(['empty', payload.skipReason || '', payload.skipStage || '']);
}

function caseFingerprint(payload = {}) {
  return semanticDedupeKey(payload);
}

function findTerminalBySemanticKey(doc, payload) {
  const sem = semanticDedupeKey(payload);
  return (
    doc.cases.find(
      (c) =>
        (c.fingerprint === sem || c.semanticKey === sem) &&
        TERMINAL_STATUSES.has(c.status)
    ) || null
  );
}

function findFailedFinalBySemanticKey(doc, payload) {
  const hit = findTerminalBySemanticKey(doc, payload);
  if (!hit) return null;
  if (hit.status === 'failed_final' || hit.status === 'resolved_archive') return hit;
  if (hit.status === 'resolved_publish' || hit.status === 'resolved') return hit;
  return null;
}

function mergeOpenCase(existing, payload = {}) {
  existing.updatedAt = nowIso();
  existing.lastSkipReason = payload.skipReason || existing.lastSkipReason;
  existing.hints = { ...(existing.hints || {}), ...(payload.hints || {}) };
  if (payload.beatPost) existing.beatPost = payload.beatPost;
  if (payload.candidate) existing.candidate = payload.candidate;
  if (payload.skipStage) existing.skipStage = payload.skipStage;
  const sem = semanticDedupeKey(payload);
  existing.semanticKey = sem;
  existing.fingerprint = sem;
}

function findOpenDuplicate(doc, payload) {
  const sem = semanticDedupeKey(payload);
  const exact = doc.cases.find((c) => c.fingerprint === sem && OPEN_STATUSES.has(c.status));
  if (exact) return exact;
  return doc.cases.find((c) => c.semanticKey === sem && OPEN_STATUSES.has(c.status)) || null;
}

function addCase(payload = {}) {
  const doc = loadPile();
  const terminal = findTerminalBySemanticKey(doc, payload);
  if (terminal) {
    return {
      case: terminal,
      created: false,
      duplicate: true,
      blocked: true,
      reason: terminal.status === 'resolved_archive' ? 'resolved_archive' : terminal.status
    };
  }
  const sem = semanticDedupeKey(payload);
  const existing = findOpenDuplicate(doc, payload);
  if (existing) {
    mergeOpenCase(existing, payload);
    savePile(doc);
    return { case: existing, created: false, duplicate: true, refreshed: true, semanticDuplicate: true };
  }

  const row = {
    id: newCaseId(),
    fingerprint: sem,
    semanticKey: sem,
    status: 'pending',
    createdAt: nowIso(),
    updatedAt: nowIso(),
    attempts: 0,
    maxAttempts: parseInt(process.env.X_AUTOPOST_DETECTIVES_MAX_ATTEMPTS || '8', 10),
    skipReason: payload.skipReason || 'filter_reject',
    skipReasonRaw: payload.skipReason || 'filter_reject',
    skipStage: payload.skipStage || 'enqueue',
    diagnosis: null,
    repairActions: [],
    finalSkipCode: null,
    beatPost: payload.beatPost || null,
    candidate: payload.candidate || null,
    hints: payload.hints || {},
    investigationLog: [],
    resolvedCandidate: null,
    queueItemId: null,
    resolvedAt: null,
    resolvedPath: null
  };
  doc.cases.push(row);
  savePile(doc);
  return { case: row, created: true, duplicate: false };
}

function listCases({ status = null, limit = 50, priority = false } = {}) {
  const doc = loadPile();
  let rows = [...doc.cases];
  if (status) rows = rows.filter((c) => c.status === status);
  if (status === 'pending' && priority) {
    try {
      const handoff = require('./detectives-handoff');
      rows = handoff.sortCasesForProcessing(rows);
    } catch {
      rows.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }
  } else {
    rows.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }
  return rows.slice(0, limit);
}

function getCase(id) {
  return loadPile().cases.find((c) => c.id === id) || null;
}

function updateCase(id, patch = {}) {
  const doc = loadPile();
  const idx = doc.cases.findIndex((c) => c.id === id);
  if (idx < 0) return null;
  doc.cases[idx] = { ...doc.cases[idx], ...patch, updatedAt: nowIso() };
  savePile(doc);
  return doc.cases[idx];
}

function appendLog(id, entry) {
  const doc = loadPile();
  const idx = doc.cases.findIndex((c) => c.id === id);
  if (idx < 0) return null;
  const log = doc.cases[idx].investigationLog || [];
  log.push({ at: nowIso(), ...entry });
  doc.cases[idx].investigationLog = log.slice(-30);
  doc.cases[idx].updatedAt = nowIso();
  savePile(doc);
  return doc.cases[idx];
}

function countByStatus() {
  const doc = loadPile();
  const out = {
    pending: 0,
    investigating: 0,
    resolved: 0,
    resolved_publish: 0,
    resolved_archive: 0,
    failed: 0,
    failed_final: 0,
    expired: 0
  };
  for (const c of doc.cases) {
    const s = c.status || 'pending';
    out[s] = (out[s] || 0) + 1;
  }
  return out;
}

function recoverStaleInvestigatingCases(maxAgeMs = null) {
  const ms = maxAgeMs || parseInt(process.env.X_AUTOPOST_DETECTIVES_STALE_MS || String(3 * 60 * 1000), 10);
  const doc = loadPile();
  const now = Date.now();
  let recovered = 0;
  for (const c of doc.cases) {
    if (c.status !== 'investigating') continue;
    const age = now - new Date(c.updatedAt || c.createdAt).getTime();
    if (age < ms) continue;
    const maxAttempts = c.maxAttempts || parseInt(process.env.X_AUTOPOST_DETECTIVES_MAX_ATTEMPTS || '8', 10);
    const log = c.investigationLog || [];
    if ((c.attempts || 0) >= maxAttempts) {
      c.status = 'resolved_archive';
      c.finalSkipCode = 'EXHAUSTED_PROMOTE';
      c.archiveReason = 'exhausted_promote';
      c.resolutionState = 'resolved_archive';
      c.resolvedAt = nowIso();
      c.updatedAt = nowIso();
      log.push({ at: nowIso(), phase: 'resolved_archive', reason: 'stale_exhausted', attempts: c.attempts, ageMs: age });
    } else {
      c.status = 'pending';
      c.updatedAt = nowIso();
      log.push({ at: nowIso(), phase: 'stale_reset', ageMs: age, reason: 'investigation_timeout' });
    }
    c.investigationLog = log.slice(-30);
    recovered += 1;
  }
  if (recovered) savePile(doc);
  return recovered;
}

function saveBackfillMeta(stats = {}) {
  const doc = loadPile();
  doc.lastBackfill = {
    at: nowIso(),
    scanned: stats.scanned || 0,
    created: stats.created || 0,
    refreshed: stats.refreshed || 0,
    handoffs: stats.handoffs || 0,
    notHandoffEligible: stats.notHandoffEligible || 0,
    beatPostCount: stats.beatPostCount || 0,
    beatError: stats.beatError || null,
    sources: stats.sources || null,
    blockedSkipReasons: stats.blockedSkipReasons || null,
  };
  savePile(doc);
  return doc.lastBackfill;
}

module.exports = {
  PILE_PATH,
  loadPile,
  savePile,
  addCase,
  listCases,
  getCase,
  updateCase,
  appendLog,
  caseFingerprint,
  semanticDedupeKey,
  resolvePlayerKey,
  resolveTopicKey,
  normalizeBeatText,
  countByStatus,
  recoverStaleInvestigatingCases,
  saveBackfillMeta,
  CLUSTER_TOPICS
};
