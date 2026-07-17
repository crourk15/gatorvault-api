/**
 * Persist trial history by email so delete → re-register cannot mint a fresh 30-day trial.
 */
const fs = require('fs');
const path = require('path');

function ledgerPath() {
  return process.env.GV_TRIAL_LEDGER_PATH || path.join(__dirname, '..', 'data', 'trial-ledger.json');
}

function loadLedger() {
  try {
    const raw = JSON.parse(fs.readFileSync(ledgerPath(), 'utf8'));
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  } catch {
    return {};
  }
}

function saveLedger(ledger) {
  const filePath = ledgerPath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(ledger, null, 2));
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
