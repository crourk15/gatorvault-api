/**
 * Rivals PM eligibility — today-only, uncommitted active UF targets, no reposts.
 */
const store = require('./recruiting-store');

const TZ = process.env.RIVALS_PM_TZ || 'America/New_York';

function toDateKey(iso, tz = TZ) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    d
  );
}

/** Prediction logged today (local TZ) or later — never yesterday or older. */
function isTodayOrNewer(iso) {
  const key = toDateKey(iso);
  const todayKey = toDateKey(new Date().toISOString());
  if (!key || !todayKey) return false;
  return key >= todayKey;
}

function isCommittedAnywhere(player, row = null) {
  if (row?.isCommitted || row?.committedTo) return true;
  if (!player) return false;
  const status = String(player.status || '').toLowerCase();
  if (['committed', 'enrolled', 'signed'].includes(status)) return true;
  const to = String(player.committedTo || player.committed_to || '').trim();
  return !!to;
}

function isActiveUfTarget(player, row) {
  if (isCommittedAnywhere(player, row)) return false;
  if (!player) return true;
  if (player.category === 'recruit' && store.isFloridaCommit(player)) return false;
  if (player.category === 'portal') return false;
  if (String(player.status || '').toLowerCase() === 'committed') return false;
  return player.category === 'target' || !player.category || player.category === 'recruit';
}

function alreadyProcessed(snapshot, row) {
  if (!row?.fingerprint) return true;
  if (snapshot?.fingerprints?.[row.fingerprint]) return true;
  if (row.pickKey && snapshot?.pickKeys?.[String(row.pickKey)]) return true;
  return false;
}

function markSeen(snapshot, row, reason) {
  if (!row?.fingerprint) return;
  snapshot.fingerprints = snapshot.fingerprints || {};
  snapshot.fingerprints[row.fingerprint] = row.timestamp || new Date().toISOString();
  if (row.pickKey) {
    snapshot.pickKeys = snapshot.pickKeys || {};
    snapshot.pickKeys[String(row.pickKey)] = row.timestamp || new Date().toISOString();
  }
  snapshot.lastSkipReason = snapshot.lastSkipReason || {};
  snapshot.lastSkipReason[row.fingerprint] = reason;
}

async function evaluatePredictionGate(row, snapshot) {
  if (!row?.fingerprint || !row.playerName) {
    return { allowed: false, reason: 'invalid', markSeen: false };
  }

  if (alreadyProcessed(snapshot, row)) {
    return { allowed: false, reason: 'already_processed', markSeen: false };
  }

  if (!isTodayOrNewer(row.timestamp)) {
    return { allowed: false, reason: 'before_today', markSeen: true };
  }

  const existing = row.playerSlug ? await store.getPlayerBySlug(row.playerSlug) : null;
  if (isCommittedAnywhere(existing, row)) {
    return { allowed: false, reason: 'player_committed', markSeen: true };
  }

  if (!isActiveUfTarget(existing, row)) {
    return { allowed: false, reason: 'not_active_target', markSeen: true };
  }

  const intelStore = require('./recruiting-intel-store');
  if (intelStore.hasIntelFingerprint(row.fingerprint)) {
    markSeen(snapshot, row, 'intel_duplicate');
    return { allowed: false, reason: 'intel_duplicate', markSeen: true };
  }

  return { allowed: true, reason: null, markSeen: false, player: existing };
}

async function checkIntelForAutopost(intel) {
  if (!intel || intel.eventType !== 'prediction') return { allowed: true };
  const isRivalsPm =
    intel.rivalsPickKey || /rivals|futurecast|prediction machine/i.test(String(intel.source || intel.status || ''));
  if (!isRivalsPm) return { allowed: true };

  if (!isTodayOrNewer(intel.timestamp || intel.reportedAt || intel.createdAt)) {
    return { allowed: false, reason: 'before_today' };
  }

  const player = intel.playerSlug ? await store.getPlayerBySlug(intel.playerSlug) : null;
  if (isCommittedAnywhere(player)) {
    return { allowed: false, reason: 'player_committed' };
  }
  if (!isActiveUfTarget(player, { playerName: intel.playerName })) {
    return { allowed: false, reason: 'not_active_target' };
  }
  return { allowed: true };
}

module.exports = {
  TZ,
  toDateKey,
  isTodayOrNewer,
  isCommittedAnywhere,
  isActiveUfTarget,
  alreadyProcessed,
  markSeen,
  evaluatePredictionGate,
  checkIntelForAutopost
};
