/**
 * GM 2.0 — Rules Engine (RE). Feature-specific guardrails for all downstream consumers.
 */
const publicAlerts = require('../recruiting-public-alerts');
const identityValidator = require('../identity-record-validator');
const beatPrefilter = require('../beat-intel-prefilter');
const decommitValidator = require('../decommit-validator');
const quarantine = require('./quarantine-store');
const decisionLog = require('./decision-log');
const { GM2_FEATURES, GM2_ACTIONS, VERIFIED_COMMIT_SOURCES } = require('./types');

function isQuarantined(record) {
  const slug = record?.playerSlug || record?.slug || record?.payload?.player?.slug;
  return slug ? quarantine.isPlayerQuarantined(slug) : false;
}

function rulesForRecruitingAlerts(record) {
  if (isQuarantined(record)) return { allow: false, reason: 'player_quarantined' };
  if (record.eventType && !publicAlerts.isPublicRecruitingEvent(record)) {
    return { allow: false, reason: 'not_public_recruiting_event' };
  }
  if (record.eventType == null && record.type) {
    const fake = { eventType: record.type, source: record.source, playerSlug: record.playerSlug, title: record.title };
    if (!publicAlerts.isPublicRecruitingEvent(fake)) return { allow: false, reason: 'not_public_alert' };
  }
  return { allow: true };
}

function rulesForIntel(record) {
  if (isQuarantined(record)) return { allow: false, reason: 'player_quarantined' };
  if (!publicAlerts.isPublicIntelItem(record)) return { allow: false, reason: 'not_public_intel' };
  if (publicAlerts.isBrewsterFalseCommit(record)) return { allow: false, reason: 'false_commit_intel' };
  return { allow: true };
}

function rulesForLiveFeedItem(item) {
  if (isQuarantined({ playerSlug: item?.meta?.playerSlug })) return { allow: false, reason: 'player_quarantined' };
  if (publicAlerts.isInvalidHeadlineFeedItem(item)) return { allow: false, reason: 'invalid_headline' };
  if (!publicAlerts.isPublicLiveFeedItem(item)) return { allow: false, reason: 'not_public_feed_item' };
  return { allow: true };
}

function rulesForHeadlines(item) {
  return rulesForLiveFeedItem(item);
}

function rulesForHeatCheckPlayer(player, intelRows = []) {
  if (isQuarantined(player)) return { allow: false, reason: 'player_quarantined' };
  const pv = identityValidator.validatePlayerIdentityRecord(player);
  if (!pv.valid) return { allow: false, reason: 'invalid_identity', errors: pv.errors };
  const hasVerifiedIntel = (intelRows || []).some(
    (i) => i.playerSlug === player.slug && publicAlerts.isPublicIntelItem(i)
  );
  if (!hasVerifiedIntel && !player.stars) return { allow: false, reason: 'no_verified_intel' };
  return { allow: true };
}

function rulesForAutoposter(candidate) {
  if (isQuarantined(candidate)) return { allow: false, reason: 'player_quarantined' };
  if (publicAlerts.isBrewsterFalseQueueItem(candidate)) return { allow: false, reason: 'false_commit_queue' };
  const et = String(candidate.intelType || candidate.eventType || candidate.sourceEventType || '').toLowerCase();
  const src = String(candidate.source || '').toLowerCase();
  if (['commit', 'flip'].includes(et) && !VERIFIED_COMMIT_SOURCES.has(src)) {
    return { allow: false, reason: 'unverified_commit_autopost' };
  }
  if (/beat/.test(src) && !candidate.identityConfirmed) {
    return { allow: false, reason: 'unverified_beat_autopost' };
  }
  return { allow: true };
}

function rulesForPlayerPage(player, intel = [], events = []) {
  if (isQuarantined(player)) return { allow: false, reason: 'player_quarantined', blockPage: true };
  const pv = identityValidator.validatePlayerIdentityRecord(player);
  if (!pv.valid) {
    return { allow: true, warn: true, reason: 'identity_incomplete', errors: pv.errors, sanitize: true };
  }
  return {
    allow: true,
    intel: (intel || []).filter((i) => rulesForIntel(i).allow),
    events: (events || []).filter((e) => rulesForRecruitingAlerts(e).allow)
  };
}

function rulesForBoardPlayer(player) {
  if (isQuarantined(player)) return { allow: false, reason: 'player_quarantined' };
  if (player?.school && !identityValidator.isValidSchoolField(player.school, { allowCollege: player.category === 'portal' })) {
    return { allow: false, reason: 'invalid_school_on_board' };
  }
  return { allow: true };
}

function rulesForPortalPlayer(player) {
  if (isQuarantined(player)) return { allow: false, reason: 'player_quarantined' };
  if (!player?.name || !player?.pos) return { allow: false, reason: 'incomplete_portal_record' };
  return { allow: true };
}

function rulesForVisitRecap(intelRows) {
  if (!intelRows?.length) return { allow: false, reason: 'no_visit_intel' };
  for (const intel of intelRows) {
    if (isQuarantined(intel)) return { allow: false, reason: 'player_quarantined' };
    if (!identityValidator.isVerifiedNewVisitIntel(intel, 0)) continue;
    const pv = identityValidator.validateIntelForArticle(intel);
    if (!pv.valid) return { allow: false, reason: 'invalid_visit_intel', errors: pv.errors };
  }
  return { allow: true };
}

function rulesForProgramPulse(signals) {
  if (!signals?.roster && !signals?.portal) return { allow: false, reason: 'no_program_signals' };
  return { allow: true };
}

const FEATURE_RULES = {
  [GM2_FEATURES.RECRUITING_ALERTS]: rulesForRecruitingAlerts,
  [GM2_FEATURES.MY_ALERTS]: rulesForRecruitingAlerts,
  [GM2_FEATURES.LIVE_FEED]: rulesForLiveFeedItem,
  [GM2_FEATURES.HEADLINES]: rulesForHeadlines,
  [GM2_FEATURES.HEAT_CHECK]: rulesForHeatCheckPlayer,
  [GM2_FEATURES.AUTOPOSTER]: rulesForAutoposter,
  [GM2_FEATURES.PLAYER_PAGE]: rulesForPlayerPage,
  [GM2_FEATURES.BOARD]: rulesForBoardPlayer,
  [GM2_FEATURES.PORTAL_TRACKER]: rulesForPortalPlayer,
  [GM2_FEATURES.VISIT_RECAP]: rulesForVisitRecap,
  [GM2_FEATURES.PROGRAM_PULSE]: rulesForProgramPulse
};

/**
 * Apply rules engine for a feature + record(s).
 */
function runRulesEngine(feature, record, context = {}) {
  const fn = FEATURE_RULES[feature];
  if (!fn) return { allow: true, reason: 'no_rules' };

  let result;
  if (feature === GM2_FEATURES.HEAT_CHECK) {
    result = fn(record, context.intelRows);
  } else if (feature === GM2_FEATURES.PLAYER_PAGE) {
    result = fn(record, context.intel, context.events);
  } else if (feature === GM2_FEATURES.VISIT_RECAP || feature === GM2_FEATURES.PROGRAM_PULSE) {
    result = fn(record);
  } else {
    result = fn(record);
  }

  if (!result.allow) {
    decisionLog.logDecision({
      layer: 're',
      action: GM2_ACTIONS.REJECT,
      feature,
      reason: result.reason,
      errors: result.errors,
      playerSlug: record?.playerSlug || record?.slug,
      fingerprint: record?.fingerprint
    });
  }
  return result;
}

function filterForFeature(feature, items, context = {}) {
  if (!Array.isArray(items)) return [];
  if (feature === GM2_FEATURES.LIVE_FEED || feature === GM2_FEATURES.HEADLINES) {
    return items.filter((item) => runRulesEngine(feature, item).allow);
  }
  if (feature === GM2_FEATURES.RECRUITING_ALERTS || feature === GM2_FEATURES.MY_ALERTS) {
    return items.filter((item) => {
      if (item.eventType) return runRulesEngine(feature, item).allow;
      return runRulesEngine(GM2_FEATURES.LIVE_FEED, item).allow || rulesForIntel(item).allow;
    });
  }
  if (feature === GM2_FEATURES.BOARD || feature === GM2_FEATURES.PORTAL_TRACKER) {
    return items.filter((item) => runRulesEngine(feature, item).allow);
  }
  if (feature === GM2_FEATURES.HEAT_CHECK) {
    return items.filter((item) => runRulesEngine(feature, item, context).allow);
  }
  return items.filter((item) => runRulesEngine(feature, item, context).allow !== false);
}

module.exports = {
  runRulesEngine,
  filterForFeature,
  isQuarantined,
  rulesForRecruitingAlerts,
  rulesForIntel,
  rulesForLiveFeedItem,
  rulesForHeatCheckPlayer,
  rulesForAutoposter,
  rulesForPlayerPage,
  rulesForBoardPlayer,
  rulesForPortalPlayer
};
