/**
 * GM 2.0 — system-wide integrity orchestrator.
 * Signal Integrity Layer → Rules Engine → Pre-Render Validator
 */
const sil = require('./signal-integrity-layer');
const rulesEngine = require('./rules-engine');
const pgv = require('./pre-render-validator');
const quarantine = require('./quarantine-store');
const decisionLog = require('./decision-log');
const identityValidator = require('../identity-record-validator');
const publicAlerts = require('../recruiting-public-alerts');
const { GM2_FEATURES, GM2_ACTIONS } = require('./types');

function ingestSignal(signal, { subsystem = 'unknown', skipFreshness = false } = {}) {
  return sil.runSignalIntegrityLayer(signal, { subsystem, skipFreshness });
}

function ingestIntel(raw, options = {}) {
  const signal = {
    playerSlug: raw.playerSlug,
    playerName: raw.playerName,
    playerId: raw.playerId,
    eventType: raw.eventType,
    source: raw.source,
    detail: raw.detail,
    timestamp: raw.timestamp || raw.reportedAt || raw.createdAt,
    classYear: raw.classYear,
    pos: raw.pos,
    school: raw.school || raw.highSchool,
    fingerprint: raw.fingerprint,
    identityConfirmed: raw.identityConfirmed,
    resolutionStatus: raw.resolutionStatus,
    reportedAt: raw.reportedAt,
    createdAt: raw.createdAt
  };
  return ingestSignal(signal, { subsystem: options.subsystem || 'intel-store', skipFreshness: options.skipFreshness });
}

function ingestPlayer(player, options = {}) {
  const pv = identityValidator.validatePlayerIdentityRecord(player);
  if (!pv.valid) {
    if (player?.slug) {
      quarantine.quarantinePlayer(player.slug, {
        reason: 'invalid_player_on_write',
        errors: pv.errors,
        source: options.subsystem || 'recruiting-store'
      });
    }
    const sanitized = identityValidator.sanitizePlayerFieldsForStore(player);
    decisionLog.logDecision({
      layer: 'sil',
      action: GM2_ACTIONS.QUARANTINE,
      subsystem: options.subsystem,
      playerSlug: player?.slug,
      reason: 'invalid_player_on_write',
      errors: pv.errors
    });
    return { action: GM2_ACTIONS.QUARANTINE, reason: 'invalid_player_on_write', errors: pv.errors, normalized: sanitized };
  }
  if (player?.slug && quarantine.isPlayerQuarantined(player.slug)) {
    return { action: GM2_ACTIONS.REJECT, reason: 'player_quarantined', normalized: player };
  }
  return { action: GM2_ACTIONS.ALLOW, reason: 'ok', normalized: identityValidator.sanitizePlayerFieldsForStore(player) };
}

function ingestEvent(event, options = {}) {
  return ingestSignal(
    {
      playerSlug: event.playerSlug,
      playerName: event.payload?.player?.name,
      playerId: event.playerId,
      eventType: event.eventType,
      source: event.source,
      title: event.title,
      detail: event.detail,
      timestamp: event.createdAt,
      classYear: event.classYear || event.payload?.player?.classYear,
      identityConfirmed: event.payload?.identityConfirmed || event.payload?.autoposterApproved
    },
    { subsystem: options.subsystem || 'recruiting-store' }
  );
}

function filterPublicEvents(events) {
  const filtered = publicAlerts.filterPublicEvents(events || []);
  return rulesEngine.filterForFeature(GM2_FEATURES.RECRUITING_ALERTS, filtered);
}

function filterPublicIntel(intel) {
  return (intel || []).filter((i) => rulesEngine.rulesForIntel(i).allow);
}

function filterPublicLiveFeed(items) {
  const base = publicAlerts.filterPublicLiveFeed(items || []);
  return rulesEngine.filterForFeature(GM2_FEATURES.LIVE_FEED, base);
}

function filterBoardPlayers(players) {
  return rulesEngine.filterForFeature(GM2_FEATURES.BOARD, players || []);
}

function filterPortalPlayers(players) {
  return rulesEngine.filterForFeature(GM2_FEATURES.PORTAL_TRACKER, players || []);
}

function filterHeatCheckRising(rising, intelRows = []) {
  return rulesEngine.filterForFeature(GM2_FEATURES.HEAT_CHECK, rising || [], { intelRows });
}

function filterAutoposterCandidate(candidate) {
  return rulesEngine.runRulesEngine(GM2_FEATURES.AUTOPOSTER, candidate).allow;
}

function filterPlayerPage(player, intel, events) {
  const result = rulesEngine.runRulesEngine(GM2_FEATURES.PLAYER_PAGE, player, { intel, events });
  if (result.blockPage) return null;
  return {
    player,
    intel: result.intel || filterPublicIntel(intel),
    events: result.events || filterPublicEvents(events)
  };
}

function validateBeforeRender(feature, payload, options) {
  return pgv.runPreRenderValidator(feature, payload, options);
}

function guardFeatureUpdate(feature, payload, previousPayload, options) {
  return pgv.guardFeatureUpdate(feature, payload, previousPayload, options);
}

async function rebuildAndReleasePlayer(slug) {
  const result = await identityValidator.rebuildPlayerIdentityFromOn3(slug);
  if (result.ok) quarantine.releasePlayer(slug);
  return result;
}

function getDashboard() {
  return {
    quarantine: quarantine.getStatus(),
    decisions24h: decisionLog.countByAction(86400000),
    recentDecisions: decisionLog.listDecisions({ limit: 30 }),
    quarantinedSignals: quarantine.listQuarantinedSignals({ limit: 20 })
  };
}

module.exports = {
  GM2_FEATURES,
  GM2_ACTIONS,
  ingestSignal,
  ingestIntel,
  ingestPlayer,
  ingestEvent,
  filterPublicEvents,
  filterPublicIntel,
  filterPublicLiveFeed,
  filterBoardPlayers,
  filterPortalPlayers,
  filterHeatCheckRising,
  filterAutoposterCandidate,
  filterPlayerPage,
  validateBeforeRender,
  guardFeatureUpdate,
  rebuildAndReleasePlayer,
  getDashboard,
  isPlayerQuarantined: quarantine.isPlayerQuarantined,
  quarantinePlayer: quarantine.quarantinePlayer,
  releasePlayer: quarantine.releasePlayer,
  listQuarantinedPlayers: quarantine.listQuarantinedPlayers,
  listDecisions: decisionLog.listDecisions
};
