/**
 * Recruiting intel DB — visits, predictions, trending beat intel.
 * Dedupe key: player_id + event_type + timestamp (via commit-fingerprint.intelFingerprint).
 */
const fs = require('fs');
const path = require('path');
const { intelFingerprint, feedDedupeKeyForIntel } = require('./commit-fingerprint');
const { isVisitEventType } = require('./gv-classification');

const DATA_DIR = path.join(__dirname, '..', 'data', 'recruiting');
const INTEL_PATH = path.join(DATA_DIR, 'intel.json');

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

function loadIntelDoc() {
  return readJson(INTEL_PATH, { version: 1, updatedAt: null, items: [] });
}

function saveIntelDoc(doc) {
  doc.updatedAt = nowIso();
  writeJson(INTEL_PATH, doc);
  return doc;
}

function normalizeIntel(raw) {
  const playerId = String(raw.playerId || raw.on3Id || raw.player_id || '').trim();
  const eventType = String(raw.eventType || raw.event_type || '').trim().toLowerCase();
  const timestamp = raw.timestamp || raw.visitStart || raw.reportedAt || raw.createdAt || nowIso();
  const fingerprint = raw.fingerprint || intelFingerprint(playerId, eventType, timestamp);

  return {
    id: raw.id || `intel_${playerId}_${eventType}_${normalizeIntelTimestampDay(timestamp)}`,
    playerId,
    playerSlug: raw.playerSlug || raw.player_slug || null,
    playerName: raw.playerName || raw.player_name || null,
    classYear: raw.classYear || raw.class_year || null,
    pos: raw.pos || null,
    eventType,
    status: raw.status || null,
    visitStart: raw.visitStart || null,
    visitEnd: raw.visitEnd || null,
    timestamp,
    source: raw.source || 'manual',
    sourceHandle: raw.sourceHandle || raw.source_handle || null,
    detail: raw.detail || raw.summary || '',
    reportedAt: raw.reportedAt || nowIso(),
    fingerprint,
    alertPosted: !!raw.alertPosted,
    xPostQueued: !!raw.xPostQueued,
    analystName: raw.analystName || raw.analyst_name || null,
    confidencePct: raw.confidencePct != null ? Number(raw.confidencePct) : raw.confidence_pct != null ? Number(raw.confidence_pct) : null,
    stars: raw.stars != null ? Number(raw.stars) : null,
    natlRank: raw.natlRank != null ? Number(raw.natlRank) : raw.natl_rank != null ? Number(raw.natl_rank) : null,
    school: raw.school || null,
    highSchool: raw.highSchool || raw.high_school || null,
    hometownState: raw.hometownState || raw.hometown_state || null,
    ufRpmPct: raw.ufRpmPct != null ? Number(raw.ufRpmPct) : raw.uf_rpm_pct != null ? Number(raw.uf_rpm_pct) : null,
    htWt: raw.htWt || raw.ht_wt || null,
    articleUrl: raw.articleUrl || raw.article_url || null,
    rivalsPickKey: raw.rivalsPickKey || raw.rivals_pick_key || null,
    predictionSchool: raw.predictionSchool || raw.prediction_school || null,
    identityConfirmed: !!raw.identityConfirmed,
    identityConfirmationMode: raw.identityConfirmationMode || raw.identity_confirmation_mode || null,
    identityConfirmedAt: raw.identityConfirmedAt || raw.identity_confirmed_at || null,
    identitySources: raw.identitySources || raw.identity_sources || null,
    cancelledSchool: raw.cancelledSchool || raw.cancelled_school || null,
    nextVisitSchool: raw.nextVisitSchool || raw.next_visit_school || null,
    resolutionStatus: raw.resolutionStatus || raw.resolution_status || null,
    missingFields: Array.isArray(raw.missingFields) ? raw.missingFields : raw.missing_fields || null,
    resolutionAttemptedAt: raw.resolutionAttemptedAt || raw.resolution_attempted_at || null,
    surfaced: raw.surfaced !== false && raw.resolutionStatus !== 'needs_resolution',
    createdAt: raw.createdAt || nowIso()
  };
}

function normalizeIntelTimestampDay(ts) {
  const d = new Date(ts);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return String(ts).trim().slice(0, 10);
}

function listIntel({ limit = 100, since = null, eventType = null } = {}) {
  const doc = loadIntelDoc();
  let items = [...(doc.items || [])];
  if (eventType) items = items.filter((i) => i.eventType === eventType);
  if (since) {
    const cutoff = new Date(since).getTime();
    items = items.filter((i) => new Date(i.reportedAt || i.createdAt).getTime() >= cutoff);
  }
  items.sort((a, b) => new Date(b.reportedAt || b.createdAt) - new Date(a.reportedAt || a.createdAt));
  return items.slice(0, limit);
}

function hasIntelFingerprint(fp) {
  if (!fp) return false;
  const doc = loadIntelDoc();
  return (doc.items || []).some((i) => i.fingerprint === fp);
}

function saveNeedsResolution(raw) {
  const row = normalizeIntel({
    ...raw,
    resolutionStatus: 'needs_resolution',
    surfaced: false,
    identityConfirmed: false
  });
  row.missingFields = Array.isArray(raw.missingFields) ? raw.missingFields : [];
  row.resolutionAttemptedAt = raw.resolutionAttemptedAt || nowIso();
  if (!row.fingerprint) {
    throw new Error('Could not compute needs_resolution fingerprint');
  }

  const doc = loadIntelDoc();
  doc.items = doc.items || [];
  const idx = doc.items.findIndex((i) => i.fingerprint === row.fingerprint);
  if (idx >= 0) {
    doc.items[idx] = { ...doc.items[idx], ...row, updatedAt: nowIso() };
    saveIntelDoc(doc);
    return Promise.resolve({ item: doc.items[idx], created: false, duplicate: true, needs_resolution: true });
  }

  doc.items.unshift(row);
  saveIntelDoc(doc);
  return Promise.resolve({ item: row, created: true, duplicate: false, needs_resolution: true, player: null });
}

function listNeedsResolution({ limit = 50 } = {}) {
  const doc = loadIntelDoc();
  return (doc.items || [])
    .filter((i) => i.resolutionStatus === 'needs_resolution')
    .slice(0, limit);
}

function addIntel(raw) {
  const gm2 = require('./gm2');
  const decision = gm2.ingestIntel(raw, { subsystem: 'intel-store' });
  if (decision.action === 'reject' || decision.action === 'quarantine') {
    return Promise.resolve({
      item: null,
      created: false,
      skipped: true,
      reason: decision.reason,
      gm2: decision
    });
  }
  if (decision.action === 'needs_resolution') {
    return saveNeedsResolution({ ...raw, ...decision.normalized });
  }
  raw = { ...raw, ...decision.normalized };

  const row = normalizeIntel(raw);
  if (row.resolutionStatus === 'needs_resolution') {
    return saveNeedsResolution(raw);
  }
  if (!row.playerId || !row.eventType) {
    throw new Error('Intel requires playerId and eventType');
  }
  if (!row.fingerprint) {
    throw new Error('Could not compute intel fingerprint');
  }
  if (isVisitEventType(row.eventType) && /commit/i.test(String(row.status || ''))) {
    throw new Error('Visit intel cannot be labeled as a commit');
  }

  const doc = loadIntelDoc();
  doc.items = doc.items || [];
  const existing = doc.items.find((i) => i.fingerprint === row.fingerprint);
  if (existing) {
    return Promise.resolve({ item: existing, created: false, duplicate: true, player: null });
  }

  doc.items.unshift(row);
  saveIntelDoc(doc);

  if (isVisitEventType(row.eventType)) {
    const store = require('./recruiting-store');
    return store.upsertTargetFromVisitIntel(row).then((player) => ({
      item: row,
      created: true,
      duplicate: false,
      player
    }));
  }

  if (row.eventType === 'prediction' || row.eventType === 'rivals_futurecast') {
    const store = require('./recruiting-store');
    return store.upsertTargetFromVisitIntel(row).then((player) => ({
      item: row,
      created: true,
      duplicate: false,
      player
    }));
  }

  return Promise.resolve({ item: row, created: true, duplicate: false, player: null });
}

function markIntelXPostQueued(idOrFingerprint) {
  const doc = loadIntelDoc();
  const idx = doc.items.findIndex((i) => i.id === idOrFingerprint || i.fingerprint === idOrFingerprint);
  if (idx < 0) return null;
  doc.items[idx] = { ...doc.items[idx], xPostQueued: true, alertPosted: true };
  saveIntelDoc(doc);
  return doc.items[idx];
}

function updateIntelIdentity(idOrFingerprint, patch) {
  if (!idOrFingerprint || !patch || typeof patch !== 'object') return null;
  const doc = loadIntelDoc();
  const idx = doc.items.findIndex((i) => i.id === idOrFingerprint || i.fingerprint === idOrFingerprint);
  if (idx < 0) return null;

  const row = { ...doc.items[idx] };
  const allowed = [
    'playerName',
    'playerSlug',
    'playerId',
    'stars',
    'pos',
    'classYear',
    'highSchool',
    'hometownState',
    'school',
    'natlRank',
    'ufRpmPct',
    'htWt',
    'identityConfirmed',
    'identityConfirmationMode',
    'identityConfirmedAt',
    'identitySources'
  ];

  for (const key of allowed) {
    if (patch[key] != null && patch[key] !== '') row[key] = patch[key];
  }

  doc.items[idx] = row;
  saveIntelDoc(doc);
  return row;
}

function getIntelForPlayer({ playerId, playerSlug, playerName } = {}) {
  const doc = loadIntelDoc();
  const slug = String(playerSlug || '').toLowerCase();
  const nameKey = String(playerName || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  const pid = String(playerId || '').trim();

  return (doc.items || []).filter((i) => {
    if (pid && String(i.playerId) === pid) return true;
    if (slug && String(i.playerSlug || '').toLowerCase() === slug) return true;
    if (nameKey && String(i.playerName || '').toLowerCase().replace(/[^a-z0-9]/g, '') === nameKey) return true;
    return false;
  });
}

async function purgeIneligibleIntel() {
  const prefilter = require('./beat-intel-prefilter');
  const doc = loadIntelDoc();
  const removed = [];
  const kept = [];
  for (const item of doc.items || []) {
    if (await prefilter.shouldSurfaceRecruitingIntel(item)) {
      kept.push(item);
    } else {
      removed.push(item);
    }
  }
  if (removed.length) {
    doc.items = kept;
    saveIntelDoc(doc);
  }
  return {
    removed: removed.length,
    fingerprints: removed.map((i) => i.fingerprint).filter(Boolean),
    ids: removed.map((i) => i.id).filter(Boolean)
  };
}

function removeIntelMatching(predicate) {
  const doc = loadIntelDoc();
  const removed = [];
  const kept = [];
  for (const item of doc.items || []) {
    if (predicate(item)) removed.push(item);
    else kept.push(item);
  }
  if (removed.length) {
    doc.items = kept;
    saveIntelDoc(doc);
  }
  return { removed: removed.length, kept: kept.length, removedItems: removed };
}

function getUnqueuedIntel({ maxAgeMs = 7 * 86400000 } = {}) {
  const cutoff = Date.now() - maxAgeMs;
  return listIntel({ limit: 50 }).filter((i) => {
    if (i.resolutionStatus === 'needs_resolution') return false;
    if (i.xPostQueued) return false;
    if (new Date(i.reportedAt || i.createdAt).getTime() < cutoff) return false;
    if (i.eventType === 'prediction') {
      const ts = i.timestamp || i.reportedAt || i.createdAt;
      const eligibility = require('./rivals-prediction-eligibility');
      const isRivalsPm =
        i.rivalsPickKey || /rivals|futurecast|prediction machine/i.test(String(i.source || i.status || ''));
      if (isRivalsPm && !eligibility.isTodayOrNewer(ts)) return false;
    }
    return true;
  });
}

module.exports = {
  INTEL_PATH,
  loadIntelDoc,
  saveIntelDoc,
  listIntel,
  addIntel,
  hasIntelFingerprint,
  markIntelXPostQueued,
  updateIntelIdentity,
  getIntelForPlayer,
  getUnqueuedIntel,
  purgeIneligibleIntel,
  removeIntelMatching,
  saveNeedsResolution,
  listNeedsResolution,
  feedDedupeKeyForIntel,
  intelFingerprint
};
