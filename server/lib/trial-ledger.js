/**
 * Persist trial history by email so delete → re-register cannot mint a fresh 30-day trial.
 */
const fs = require('fs');
const path = require('path');

function defaultLedgerPath() {
  return path.join(__dirname, '..', 'data', 'trial-ledger.json');
}

function ledgerPath() {
  return process.env.GV_TRIAL_LEDGER_PATH || defaultLedgerPath();
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

function readLedgerObject(filePath) {
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  } catch {
    return {};
  }
}

function migrateLedgerFromLegacyIfNeeded() {
  const dest = ledgerPath();
  const legacy = defaultLedgerPath();
  if (path.resolve(dest) === path.resolve(legacy)) return { migrated: false };
  if (fs.existsSync(dest)) {
    const existing = readLedgerObject(dest);
    if (Object.keys(existing).length > 0) return { migrated: false, reason: 'dest_has_rows' };
  }
  if (!fs.existsSync(legacy)) return { migrated: false, reason: 'no_legacy' };
  const legacyLedger = readLedgerObject(legacy);
  if (!Object.keys(legacyLedger).length) return { migrated: false, reason: 'legacy_empty' };
  atomicWriteJson(dest, legacyLedger);
  return { migrated: true, count: Object.keys(legacyLedger).length, to: dest };
}

let migrateAttempted = false;

function loadLedger() {
  if (!migrateAttempted) {
    migrateAttempted = true;
    try {
      const result = migrateLedgerFromLegacyIfNeeded();
      if (result.migrated) {
        console.log(
          `[trial-ledger] migrated ${result.count} row(s) from ephemeral path → ${result.to}`
        );
      }
    } catch (err) {
      console.warn('[trial-ledger] migrate failed:', err instanceof Error ? err.message : err);
    }
  }
  return readLedgerObject(ledgerPath());
}

function saveLedger(ledger) {
  atomicWriteJson(ledgerPath(), ledger && typeof ledger === 'object' ? ledger : {});
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function getTrialRecord(email) {
  const key = normalizeEmail(email);
  if (!key) return null;
  const row = loadLedger()[key];
  return row && typeof row === 'object' ? row : null;
}

/**
 * Record / refresh trial bounds. Boot seed must call rememberTrials so we
 * write the ledger once — per-row saveLedger blocked /ready into 502 loops.
 */
function rememberTrials(rows) {
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) return { changed: 0, total: 0 };
  const ledger = loadLedger();
  let changed = 0;
  let last = null;
  const now = new Date().toISOString();
  for (const row of list) {
    const key = normalizeEmail(row?.email);
    if (!key || !row?.trialEnd) continue;
    const prev = ledger[key] || {};
    const start = prev.trialStart || row.trialStart || row.createdAt || now;
    const trialEnd = String(row.trialEnd);
    const deletedAt = prev.deletedAt || null;
    if (prev.trialStart === start && prev.trialEnd === trialEnd && (prev.deletedAt || null) === deletedAt) {
      last = prev;
      continue;
    }
    ledger[key] = {
      email: key,
      trialStart: start,
      trialEnd,
      updatedAt: now,
      deletedAt,
    };
    last = ledger[key];
    changed += 1;
  }
  if (changed) saveLedger(ledger);
  return { changed, total: list.length, last };
}

/** Record / refresh trial bounds for an email (keeps earliest trialStart). */
function rememberTrial(email, { trialEnd, trialStart, createdAt } = {}) {
  const out = rememberTrials([{ email, trialEnd, trialStart, createdAt }]);
  return out.last || null;
}

function markTrialDeleted(email) {
  const key = normalizeEmail(email);
  if (!key) return null;
  const ledger = loadLedger();
  const prev = ledger[key] || { email: key };
  ledger[key] = {
    ...prev,
    email: key,
    deletedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  saveLedger(ledger);
  return ledger[key];
}

/**
 * Resolve trial end for a new registration.
 * First-time email → now + 30 days.
 * Returning email → original trialEnd (no reset).
 */
function resolveRegistrationTrial(email, { trialDays = 30 } = {}) {
  const prior = getTrialRecord(email);
  if (prior?.trialEnd) {
    return {
      trialEnd: new Date(prior.trialEnd),
      trialStart: prior.trialStart || null,
      reused: true,
      priorDeleted: Boolean(prior.deletedAt),
    };
  }
  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + trialDays);
  return {
    trialEnd,
    trialStart: new Date().toISOString(),
    reused: false,
    priorDeleted: false,
  };
}

/**
 * Courtesy extension (expired locker win-back). Writes a new trialEnd so
 * delete → re-register cannot snap back to the old expired window.
 * Active windows add `days` onto the current end; expired windows start from now.
 */
function extendTrial(email, { days = 30, now = new Date() } = {}) {
  const key = normalizeEmail(email);
  const n = Math.min(Math.max(parseInt(String(days), 10) || 30, 1), 90);
  if (!key) return null;
  const prior = getTrialRecord(email);
  const priorEnd = prior?.trialEnd ? new Date(prior.trialEnd) : null;
  const priorEndMs = priorEnd && Number.isFinite(priorEnd.getTime()) ? priorEnd.getTime() : 0;
  const baseMs = priorEndMs > now.getTime() ? priorEndMs : now.getTime();
  const trialEnd = new Date(baseMs);
  trialEnd.setDate(trialEnd.getDate() + n);
  const row = rememberTrial(email, {
    trialEnd: trialEnd.toISOString(),
    trialStart: prior?.trialStart || null,
  });
  return {
    email: key,
    days: n,
    trialEnd: trialEnd.toISOString(),
    trialStart: row?.trialStart || prior?.trialStart || null,
    fromActiveWindow: priorEndMs > now.getTime(),
  };
}

module.exports = {
  ledgerPath,
  loadLedger,
  getTrialRecord,
  rememberTrial,
  rememberTrials,
  markTrialDeleted,
  resolveRegistrationTrial,
  extendTrial,
};
