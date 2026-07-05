/**
 * Player-level resolution ledger — every slug gets resolved_publish or resolved_archive.
 * Stops repeat enqueue loops across Detectives, fill, golden-four, and backfill.
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.X_AUTOPOST_DETECTIVES_DATA_DIR
  ? path.resolve(process.env.X_AUTOPOST_DETECTIVES_DATA_DIR)
  : path.join(__dirname, '..', '..', 'data', 'autoposter');
const LEDGER_PATH = path.join(DATA_DIR, 'player-resolution-ledger.json');
const MAX_ENTRIES = parseInt(process.env.X_PLAYER_RESOLUTION_LEDGER_MAX || '2000', 10);

const RESOLVED_PUBLISH = 'resolved_publish';
const RESOLVED_ARCHIVE = 'resolved_archive';

const ARCHIVE_REASONS = Object.freeze([
  'committed_elsewhere',
  'uf_irrelevant',
  'intel_unrepairable',
  'gm2_block',
  'banned_copy_unfixable',
  'identity_incomplete',
  'rpm_invalid',
  'duplicate_already_sent',
  'exhausted_promote',
  'case_not_salvageable',
  'quality_gate',
  'policy_block',
  'voice_compose_failed',
  'manual_archive'
]);

const TERMINAL_CASE_STATUSES = new Set([
  'resolved',
  RESOLVED_PUBLISH,
  RESOLVED_ARCHIVE,
  'failed_final',
  'expired'
]);

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
      .map((k) => ({ k, at: doc.players[k]?.resolvedAt || '' }))
      .sort((a, b) => String(a.at).localeCompare(String(b.at)));
    for (let i = 0; i < sorted.length - MAX_ENTRIES; i += 1) {
      delete doc.players[sorted[i].k];
    }
  }
  fs.writeFileSync(LEDGER_PATH, JSON.stringify(doc, null, 2));
  return doc;
}

function getPlayerResolution(slug) {
  const key = normalizeSlug(slug);
  if (!key) return null;
  const row = loadLedger().players[key];
  if (!row?.resolution) return null;
  return { slug: key, ...row };
}

function upsertPlayerResolution(slug, patch = {}) {
  const key = normalizeSlug(slug);
  if (!key) return null;
  const doc = loadLedger();
  const prev = doc.players[key] || {};
  const row = {
    slug: key,
    resolution: patch.resolution || prev.resolution,
    archiveReason: patch.archiveReason ?? prev.archiveReason ?? null,
    resolvedAt: patch.resolvedAt || nowIso(),
    caseId: patch.caseId ?? prev.caseId ?? null,
    queueItemId: patch.queueItemId ?? prev.queueItemId ?? null,
    intelFingerprint: patch.intelFingerprint ?? prev.intelFingerprint ?? null,
    source: patch.source ?? prev.source ?? null,
    skipCode: patch.skipCode ?? prev.skipCode ?? null,
    committedTo: patch.committedTo ?? prev.committedTo ?? null,
    preview: patch.preview != null ? String(patch.preview).slice(0, 200) : prev.preview ?? null,
    updatedAt: nowIso()
  };
  doc.players[key] = row;
  saveLedger(doc);
  try {
    const persistence = require('./autoposter-ledger-persistence');
    persistence.schedulePlayerResolutionPersist(key, row);
  } catch {
    /* optional */
  }
  return row;
}

function markResolvedPublish(slug, meta = {}) {
  return upsertPlayerResolution(slug, {
    resolution: RESOLVED_PUBLISH,
    archiveReason: null,
    ...meta
  });
}

function markResolvedArchive(slug, archiveReason, meta = {}) {
  const reason = ARCHIVE_REASONS.includes(archiveReason) ? archiveReason : 'manual_archive';
  return upsertPlayerResolution(slug, {
    resolution: RESOLVED_ARCHIVE,
    archiveReason: reason,
    ...meta
  });
}

/**
 * @returns {{ blocked: boolean, reason?: string, resolution?: object }}
 */
function checkPlayerResolution(slug, opts = {}) {
  const row = getPlayerResolution(slug);
  if (!row) return { blocked: false };

  if (row.resolution === RESOLVED_ARCHIVE) {
    if (opts.allowGoldenFour === true && row.archiveReason === 'duplicate_already_sent') {
      return { blocked: false, resolution: row };
    }
    return { blocked: true, reason: 'player_archived', archiveReason: row.archiveReason, resolution: row };
  }

  if (row.resolution === RESOLVED_PUBLISH) {
    const fp = opts.intelFingerprint || null;
    if (fp && row.intelFingerprint && fp !== row.intelFingerprint) {
      return { blocked: false, resolution: row, newIntel: true };
    }
    if (opts.allowRepublish === true) return { blocked: false, resolution: row };
    return {
      blocked: true,
      reason: 'duplicate_already_sent',
      archiveReason: 'duplicate_already_sent',
      resolution: row
    };
  }

  return { blocked: false, resolution: row };
}

function listArchivedSlugs() {
  const doc = loadLedger();
  return Object.entries(doc.players || {})
    .filter(([, row]) => row.resolution === RESOLVED_ARCHIVE)
    .map(([slug, row]) => ({ slug, archiveReason: row.archiveReason, resolvedAt: row.resolvedAt }));
}

function isTerminalCaseStatus(status) {
  return TERMINAL_CASE_STATUSES.has(String(status || ''));
}

function clearPlayerResolution(slug) {
  const key = normalizeSlug(slug);
  if (!key) return false;
  const doc = loadLedger();
  if (!doc.players[key]) return false;
  delete doc.players[key];
  saveLedger(doc);
  return true;
}

function mapSkipCodeToArchiveReason(primaryCode, skipReason) {
  const code = String(primaryCode || skipReason || '').toUpperCase();
  if (code.includes('COMMITTED')) return 'committed_elsewhere';
  if (code === 'BEAT_OPPONENT_PRIORITY' || code === 'NO_RECRUITING_SIGNAL') return 'uf_irrelevant';
  if (code === 'IDENTITY_INCOMPLETE' || code === 'BEAT_NO_PLAYER') return 'identity_incomplete';
  if (code === 'NO_RPM_DATA' || code === 'NO_COMP_DATA') return 'rpm_invalid';
  if (code === 'QUALITY_GATE' || code === 'COPY_FAILED') return 'quality_gate';
  if (code === 'EXHAUSTED_PROMOTE') return 'exhausted_promote';
  if (code === 'BEAT_QUOTE_ONLY' || code === 'BEAT_AMBIGUOUS' || code === 'BEAT_LISTICLE') {
    return 'intel_unrepairable';
  }
  return 'case_not_salvageable';
}

module.exports = {
  LEDGER_PATH,
  RESOLVED_PUBLISH,
  RESOLVED_ARCHIVE,
  ARCHIVE_REASONS,
  TERMINAL_CASE_STATUSES,
  loadLedger,
  saveLedger,
  getPlayerResolution,
  markResolvedPublish,
  markResolvedArchive,
  clearPlayerResolution,
  checkPlayerResolution,
  listArchivedSlugs,
  isTerminalCaseStatus,
  mapSkipCodeToArchiveReason,
  normalizeSlug
};
