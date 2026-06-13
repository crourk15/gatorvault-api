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
const autoRepair = require('./auto-repair');
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
  const existing = options.existing || null;
  const healed = identityValidator.healPlayerRecord(player, existing);
  const pv = identityValidator.validatePlayerIdentityRecord(healed);
  const classification = identityValidator.classifyIdentityErrors(pv.errors);
  const repairMode = !!options.repairMode;

  if (pv.valid) {
    if (healed?.slug && quarantine.isPlayerQuarantined(healed.slug)) {
      quarantine.releasePlayer(healed.slug);
      quarantine.clearPlayerQuarantine(healed.slug);
      autoRepair.dequeuePlayerRepair(healed.slug);
    }
    return { action: GM2_ACTIONS.ALLOW, reason: 'ok', normalized: healed };
  }

  if (classification.canWrite || repairMode) {
    if (healed?.slug && quarantine.isPlayerQuarantined(healed.slug)) {
      quarantine.releasePlayer(healed.slug);
      quarantine.clearPlayerQuarantine(healed.slug);
    }
    if (healed?.slug && classification.needsRepair && !repairMode) {
      autoRepair.schedulePlayerRepair(healed.slug, {
        reason: 'invalid_player_on_write',
        source: options.subsystem || 'recruiting-store'
      });
    }
    decisionLog.logDecision({
      layer: 'sil',
      action: GM2_ACTIONS.ALLOW,
      subsystem: options.subsystem,
      playerSlug: healed?.slug,
      reason: repairMode ? 'repair_mode_write' : 'healed_partial_identity',
      errors: pv.errors
    });
    return {
      action: GM2_ACTIONS.ALLOW,
      reason: repairMode ? 'repair_mode_write' : 'healed_partial_identity',
      errors: pv.errors,
      normalized: healed,
      needsRepair: classification.needsRepair
    };
  }

  if (healed?.slug) {
    quarantine.quarantinePlayer(healed.slug, {
      reason: 'invalid_player_on_write',
      errors: pv.errors,
      source: options.subsystem || 'recruiting-store'
    });
    autoRepair.schedulePlayerRepair(healed.slug, {
      reason: 'hard_identity_failure',
      source: options.subsystem || 'recruiting-store'
    });
  }
  decisionLog.logDecision({
    layer: 'sil',
    action: GM2_ACTIONS.QUARANTINE,
    subsystem: options.subsystem,
    playerSlug: healed?.slug,
    reason: 'invalid_player_on_write',
    errors: pv.errors
  });
  return {
    action: GM2_ACTIONS.QUARANTINE,
    reason: 'invalid_player_on_write',
    errors: pv.errors,
    normalized: healed,
    needsRepair: true
  };
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

function filterPublicHeadlines(items) {
  const base = publicAlerts.filterPublicLiveFeed(items || []);
  return rulesEngine.filterForFeature(GM2_FEATURES.HEADLINES, base);
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
  return autoRepair.repairPlayer(slug, { source: 'admin-repair' });
}

async function repairAllQuarantinedPlayers(options) {
  return autoRepair.repairAllQuarantined(options);
}

async function sanitizeAllPlayers(options) {
  return autoRepair.sanitizeAllPlayersInStore(options);
}

async function runAutoRepair(options) {
  return autoRepair.runAutoRepair(options);
}

function getPublicIntel(options = {}) {
  const intelStore = require('../recruiting-intel-store');
  const subsystem = options.subsystem || 'article-engine';
  const limit = parseInt(options.limit || '200', 10);
  const raw = intelStore.listIntel({ limit }) || [];
  const accepted = [];
  const rejected = [];

  for (const row of raw) {
    try {
      if (!row) continue;
      if (row.resolutionStatus === 'needs_resolution' || row.surfaced === false) {
        rejected.push({
          playerSlug: row.playerSlug,
          fingerprint: row.fingerprint,
          reason: 'needs_resolution'
        });
        continue;
      }
      if (quarantine.isPlayerQuarantined(row.playerSlug)) {
        rejected.push({
          playerSlug: row.playerSlug,
          fingerprint: row.fingerprint,
          reason: 'player_quarantined'
        });
        continue;
      }
      const rule = rulesEngine.rulesForIntel(row);
      if (!rule.allow) {
        rejected.push({
          playerSlug: row.playerSlug,
          fingerprint: row.fingerprint,
          reason: rule.reason || 'not_public_intel'
        });
        decisionLog.logDecision({
          layer: 're',
          action: GM2_ACTIONS.REJECT,
          feature: GM2_FEATURES.VISIT_RECAP,
          subsystem,
          reason: rule.reason,
          playerSlug: row.playerSlug,
          fingerprint: row.fingerprint
        });
        continue;
      }
      accepted.push(row);
    } catch (err) {
      rejected.push({
        playerSlug: row?.playerSlug,
        fingerprint: row?.fingerprint,
        reason: 'filter_error',
        error: err.message
      });
    }
  }

  const intel = identityValidator.dedupeIntelByFingerprint(
    identityValidator.filterStaleVisitIntelChain(accepted, null)
  );

  if (rejected.length) {
    console.log(`[gm2:article-engine] filtered ${rejected.length} intel row(s), kept ${intel.length}`);
  }

  return { intel, rejected, rawCount: raw.length, acceptedCount: intel.length };
}

async function getValidatedSignals(options = {}) {
  const recruitingStore = require('../recruiting-store');
  const rosterStore = require('../roster-store');
  const depthJobs = require('../depth-chart-jobs');
  const bettingLines = require('../betting-lines');
  const cycle = require('../insider-articles-cycle');

  const { intel, rejected: rejectedIntel } = getPublicIntel({
    limit: options.intelLimit || 200,
    subsystem: 'article-engine'
  });

  const [allPlayers, events, portal, roster, depthMeta, lines] = await Promise.all([
    recruitingStore.getAllPlayers(),
    recruitingStore.getEvents({ limit: 50 }),
    recruitingStore.getPortalBoard(),
    Promise.resolve(rosterStore.getAllRosterPlayers()),
    Promise.resolve(depthJobs.getDepthChartMeta()),
    bettingLines.getBettingLines().catch(() => null)
  ]);

  const gm2Players = filterBoardPlayers(allPlayers);
  const recruitingPlayers = cycle.filterRecruitingPlayers(gm2Players);
  const intel2027 = cycle.filterRecruitingIntel(intel);
  const events2027 = cycle.filterRecruitingEvents(
    filterPublicEvents(
      events.filter((e) => Date.now() - new Date(e.createdAt).getTime() < 14 * 86400000)
    )
  );

  const visits2027 = intel2027.filter((i) => /visit|ov|unofficial/i.test(i.eventType || ''));

  let heatCheck = null;
  try {
    const heat = require('../heat-check-store');
    heatCheck = await heat.buildHeatCheck();
  } catch {
    heatCheck = null;
  }

  const rising2027 = cycle.filterRecruitingHeat(
    filterHeatCheckRising(heatCheck?.rising || [], intel2027)
  );

  const portalFiltered = {
    incoming: filterPortalPlayers(portal.incoming || []),
    headliner: portal.headliner,
    count: filterPortalPlayers(portal.incoming || []).length
  };

  return {
    collectedAt: new Date().toISOString(),
    season: cycle.programSeasonYear(),
    rejectedIntel,
    recruiting: {
      players: recruitingPlayers,
      events: events2027,
      targets: recruitingPlayers.filter((p) => p.category === 'target'),
      commits: recruitingPlayers.filter(
        (p) => p.status === 'committed' && /florida/i.test(p.committedTo || '')
      ),
      minClass: cycle.RECRUITING_MIN_CLASS
    },
    portal: portalFiltered,
    depthChart: { meta: depthMeta, rosterCount: roster.length, offense: roster.filter((p) => p.unit === 'offense').length, defense: roster.filter((p) => p.unit === 'defense').length },
    gameZone: { nextGame: lines?.nextGame || null, schedule: lines?.schedule || [] },
    intel: {
      visits: visits2027,
      upcoming: visits2027.filter((i) => {
        const t = String(i.eventType || '').toLowerCase();
        if (!/official_visit|unofficial_visit|visit/.test(t)) return false;
        if (/cancel|post_visit_reaction/.test(t)) return false;
        const ts = new Date(i.timestamp || i.createdAt || 0).getTime();
        return ts >= Date.now() - 3 * 86400000;
      }),
      recent: visits2027.filter((i) => {
        const t = String(i.eventType || '').toLowerCase();
        if (!/official_visit|unofficial_visit|visit/.test(t)) return false;
        const ts = new Date(i.timestamp || i.createdAt || i.reportedAt || 0).getTime();
        const age = Date.now() - ts;
        return age >= 0 && age <= 10 * 86400000;
      }),
      all: intel2027.slice(0, 20)
    },
    heatCheck: heatCheck ? { ...heatCheck, rising: rising2027 } : { rising: rising2027 },
    roster: {
      players: roster,
      offense: roster.filter((p) => p.unit === 'offense'),
      defense: roster.filter((p) => p.unit === 'defense')
    }
  };
}

function getDashboard() {
  return {
    quarantine: quarantine.getStatus(),
    decisions24h: decisionLog.countByAction(86400000),
    recentDecisions: decisionLog.listDecisions({ limit: 30 }),
    quarantinedSignals: quarantine.listQuarantinedSignals({ limit: 20 }),
    autoRepair: autoRepair.getRepairStatus()
  };
}

function getPublicDashboard() {
  const dash = getDashboard();
  delete dash.recentDecisions;
  return dash;
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
  filterPublicHeadlines,
  getPublicIntel,
  getValidatedSignals,
  filterBoardPlayers,
  filterPortalPlayers,
  filterHeatCheckRising,
  filterAutoposterCandidate,
  filterPlayerPage,
  validateBeforeRender,
  guardFeatureUpdate,
  rebuildAndReleasePlayer,
  repairAllQuarantinedPlayers,
  sanitizeAllPlayers,
  runAutoRepair,
  schedulePlayerRepair: autoRepair.schedulePlayerRepair,
  clearStaleQuarantines: autoRepair.clearStaleQuarantines,
  getDashboard,
  getPublicDashboard,
  isPlayerQuarantined: quarantine.isPlayerQuarantined,
  quarantinePlayer: quarantine.quarantinePlayer,
  releasePlayer: quarantine.releasePlayer,
  listQuarantinedPlayers: quarantine.listQuarantinedPlayers,
  listDecisions: decisionLog.listDecisions
};
