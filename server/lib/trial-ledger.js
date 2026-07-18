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

/** Record / refresh trial bounds for an email (keeps earliest trialStart). */
function rememberTrial(email, { trialEnd, trialStart, createdAt } = {}) {
  const key = normalizeEmail(email);
  if (!key || !trialEnd) return null;
  const ledger = loadLedger();
  const prev = ledger[key] || {};
  const start =
    prev.trialStart ||
    trialStart ||
    createdAt ||
    new Date().toISOString();
  ledger[key] = {
    email: key,
    trialStart: start,
    trialEnd: String(trialEnd),
    updatedAt: new Date().toISOString(),
    deletedAt: prev.deletedAt || null,
  };
  saveLedger(ledger);
  return ledger[key];
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

module.exports = {
  ledgerPath,
  loadLedger,
  getTrialRecord,
  rememberTrial,
  markTrialDeleted,
  resolveRegistrationTrial,
};
