/**
 * GM 2.0 — Signal Integrity Layer (SIL).
 * Validates all incoming signals before they enter any store.
 */
const { intelFingerprint } = require('../commit-fingerprint');
const identityValidator = require('../identity-record-validator');
const beatPrefilter = require('../beat-intel-prefilter');
const quarantine = require('./quarantine-store');
const decisionLog = require('./decision-log');
const { GM2_ACTIONS, TRUSTED_SOURCES, BLOCKED_SOURCES, INTERNAL_SOURCES } = require('./types');

const FRESHNESS_MS = parseInt(process.env.GM2_FRESHNESS_MS || String(30 * 86400000), 10);
const seenFingerprints = new Map();

function normalizeSource(source) {
  return String(source || '')
    .toLowerCase()
    .trim();
}

function signalTimestamp(signal) {
  const ts = signal.timestamp || signal.reportedAt || signal.createdAt || signal.visitStart;
  if (!ts) return null;
  const n = new Date(ts).getTime();
  return Number.isFinite(n) ? n : null;
}

function buildFingerprint(signal) {
  if (signal.fingerprint) return signal.fingerprint;
  const player = signal.playerSlug || signal.playerId || signal.playerName || '';
  const type = signal.eventType || signal.type || '';
  const source = normalizeSource(signal.source);
  const ts = signalTimestamp(signal);
  if (player && type && ts) {
    return intelFingerprint(String(player), type, new Date(ts).toISOString());
  }
  return `sig_${source}_${player}_${type}_${ts || 'na'}`;
}

function validateSchema(signal) {
  const errors = [];
  const type = signal.eventType || signal.type;
  const source = normalizeSource(signal.source);
  const et = String(type || '').toLowerCase();
  if (!type) errors.push('missing_type');
  if (!source) errors.push('missing_source');
  if (!signal.playerSlug && !signal.playerName && !signal.playerId && et !== 'program_news' && et !== 'team_event') {
    errors.push('missing_player');
  }
  if (!signalTimestamp(signal) && !signal.reportedAt && !signal.createdAt) errors.push('missing_timestamp');
  const classYear = parseInt(signal.classYear, 10);
  if (et && /visit|commit|flip|offer|prediction|target/.test(et) && !Number.isFinite(classYear)) {
    if (source === 'on3' || source === 'manual' || source === 'rivals_pm') errors.push('missing_class_year');
  }
  return errors;
}

function validateSourceCredibility(signal) {
  const source = normalizeSource(signal.source);
  if (!source) return ['missing_source'];
  if (BLOCKED_SOURCES.has(source)) return ['blocked_source'];
  if (/fan|meme|board|commentary|speculation/.test(source)) return ['untrusted_source'];

  if (INTERNAL_SOURCES.has(source) || /beat.?writer|auto:beat|auto:intel|needs_resolution|snapshot/.test(source)) {
    if (signal.identityConfirmed || signal.adminApproved || signal.publicApproved) return [];
    if (['commit', 'flip'].includes(String(signal.eventType || '').toLowerCase())) {
      return ['internal_unverified_commit'];
    }
    return [];
  }

  if (TRUSTED_SOURCES.has(source) || source.includes('on3') || source.includes('rivals') || source.includes('247')) {
    return [];
  }

  if (/beat/.test(source)) {
    const text = signal.detail || signal.text || signal.title || '';
    if (beatPrefilter.isGenericNonPlayerIntel(text)) return ['generic_beat_intel'];
    if (!signal.identityConfirmed) return ['unverified_beat_intel'];
    return [];
  }

  return ['unknown_source'];
}

function validateFreshness(signal) {
  const ts = signalTimestamp(signal);
  if (!ts) return ['missing_timestamp'];
  const age = Date.now() - ts;
  if (age > FRESHNESS_MS) return ['stale_signal'];
  if (age < -3600000) return ['future_timestamp'];
  return [];
}

function validateIdentity(signal) {
  const errors = [];
  const slug = signal.playerSlug;
  if (slug && quarantine.isPlayerQuarantined(slug)) {
    return ['player_quarantined'];
  }

  if (slug && (signal.school || signal.highSchool)) {
    const pv = identityValidator.validatePlayerIdentityRecord({
      slug,
      name: signal.playerName,
      pos: signal.pos,
      classYear: signal.classYear,
      school: signal.school || signal.highSchool
    });
    if (!pv.valid) {
      errors.push(...pv.errors.map((e) => `player_${e}`));
    }
  }

  const et = String(signal.eventType || signal.type || '').toLowerCase();
  if (et && (signal.detail || signal.text)) {
    const iv = identityValidator.validateIntelForArticle({
      playerSlug: slug,
      playerName: signal.playerName,
      fingerprint: buildFingerprint(signal),
      eventType: et,
      source: signal.source,
      detail: signal.detail || signal.text,
      identityConfirmed: signal.identityConfirmed,
      resolutionStatus: signal.resolutionStatus
    });
    if (!iv.valid && /visit|commit|flip|offer|prediction|rivals/.test(et)) {
      errors.push(...iv.errors.map((e) => `intel_${e}`));
    }
  }
  return errors;
}

function checkDuplicate(fingerprint) {
  if (!fingerprint) return false;
  if (seenFingerprints.has(fingerprint)) return true;
  try {
    const intelStore = require('../recruiting-intel-store');
    if (intelStore.hasIntelFingerprint(fingerprint)) return true;
  } catch {
    /* optional */
  }
  return false;
}

function rememberFingerprint(fingerprint) {
  if (fingerprint) seenFingerprints.set(fingerprint, Date.now());
}

/**
 * Run SIL on an incoming signal.
 * @returns {{ action, reason, errors, fingerprint, normalized }}
 */
function runSignalIntegrityLayer(signal, { subsystem = 'unknown', skipFreshness = false } = {}) {
  const normalized = {
    ...signal,
    source: normalizeSource(signal.source),
    fingerprint: buildFingerprint(signal)
  };

  const errors = [];
  errors.push(...validateSchema(normalized));
  errors.push(...validateSourceCredibility(normalized));
  if (!skipFreshness) errors.push(...validateFreshness(normalized));

  const identityErrors = validateIdentity(normalized);
  errors.push(...identityErrors);

  if (errors.includes('player_quarantined')) {
    decisionLog.logDecision({
      layer: 'sil',
      action: GM2_ACTIONS.REJECT,
      subsystem,
      reason: 'player_quarantined',
      playerSlug: normalized.playerSlug,
      fingerprint: normalized.fingerprint
    });
    return { action: GM2_ACTIONS.REJECT, reason: 'player_quarantined', errors, fingerprint: normalized.fingerprint, normalized };
  }

  if (errors.some((e) => e.startsWith('player_') || e.startsWith('intel_invalid'))) {
    const playerErrorCodes = identityErrors
      .filter((e) => e.startsWith('player_'))
      .map((e) => e.replace(/^player_/, ''));
    const classification = identityValidator.classifyIdentityErrors(playerErrorCodes);
    const onlyRepairablePlayer =
      playerErrorCodes.length > 0 && classification.hard.length === 0;

    if (onlyRepairablePlayer && normalized.playerSlug) {
      try {
        const autoRepair = require('./auto-repair');
        autoRepair.schedulePlayerRepair(normalized.playerSlug, {
          reason: 'identity_needs_repair',
          source: subsystem
        });
      } catch {
        /* optional */
      }
      decisionLog.logDecision({
        layer: 'sil',
        action: GM2_ACTIONS.REJECT,
        subsystem,
        reason: 'identity_needs_repair',
        errors: identityErrors,
        playerSlug: normalized.playerSlug,
        fingerprint: normalized.fingerprint
      });
      return {
        action: GM2_ACTIONS.REJECT,
        reason: 'identity_needs_repair',
        errors,
        fingerprint: normalized.fingerprint,
        normalized
      };
    }

    if (normalized.playerSlug) {
      quarantine.quarantinePlayer(normalized.playerSlug, {
        reason: 'identity_validation_failed',
        errors: identityErrors,
        source: subsystem
      });
    }
    quarantine.quarantineSignal(normalized, { reason: 'identity_validation_failed', errors: identityErrors });
    return { action: GM2_ACTIONS.QUARANTINE, reason: 'identity_invalid', errors, fingerprint: normalized.fingerprint, normalized };
  }

  if (errors.includes('internal_unverified_commit') || errors.includes('unverified_beat_intel')) {
    decisionLog.logDecision({
      layer: 'sil',
      action: GM2_ACTIONS.NEEDS_RESOLUTION,
      subsystem,
      reason: errors.find((e) => e.includes('unverified')) || 'needs_resolution',
      playerSlug: normalized.playerSlug,
      fingerprint: normalized.fingerprint
    });
    return {
      action: GM2_ACTIONS.NEEDS_RESOLUTION,
      reason: 'needs_resolution',
      errors,
      fingerprint: normalized.fingerprint,
      normalized: { ...normalized, resolutionStatus: 'needs_resolution', surfaced: false }
    };
  }

  if (errors.length) {
    quarantine.quarantineSignal(normalized, { reason: errors[0], errors });
    decisionLog.logDecision({
      layer: 'sil',
      action: GM2_ACTIONS.REJECT,
      subsystem,
      reason: errors[0],
      errors,
      playerSlug: normalized.playerSlug,
      fingerprint: normalized.fingerprint,
      source: normalized.source
    });
    return { action: GM2_ACTIONS.REJECT, reason: errors[0], errors, fingerprint: normalized.fingerprint, normalized };
  }

  if (checkDuplicate(normalized.fingerprint)) {
    decisionLog.logDecision({
      layer: 'sil',
      action: GM2_ACTIONS.REJECT,
      subsystem,
      reason: 'duplicate_fingerprint',
      fingerprint: normalized.fingerprint,
      playerSlug: normalized.playerSlug
    });
    return { action: GM2_ACTIONS.REJECT, reason: 'duplicate_fingerprint', errors: ['duplicate_fingerprint'], fingerprint: normalized.fingerprint, normalized };
  }

  rememberFingerprint(normalized.fingerprint);
  decisionLog.logDecision({
    layer: 'sil',
    action: GM2_ACTIONS.ALLOW,
    subsystem,
    playerSlug: normalized.playerSlug,
    fingerprint: normalized.fingerprint,
    source: normalized.source,
    eventType: normalized.eventType || normalized.type
  });
  return { action: GM2_ACTIONS.ALLOW, reason: 'ok', errors: [], fingerprint: normalized.fingerprint, normalized };
}

module.exports = {
  runSignalIntegrityLayer,
  buildFingerprint,
  validateSchema,
  validateSourceCredibility,
  validateIdentity,
  validateFreshness
};
