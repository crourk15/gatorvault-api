/**
 * GM 2.0 — Rules Engine (RE). Feature-specific guardrails for all downstream consumers.
 */
function publicAlerts() {
  return require('../recruiting-public-alerts');
}
const identityValidator = require('../identity-record-validator');
const beatPrefilter = require('../beat-intel-prefilter');
const decommitValidator = require('../decommit-validator');
const quarantine = require('./quarantine-store');
const coachIdentity = require('../official-coach-identity');
const decisionLog = require('./decision-log');
const feedDedup = require('../live-feed-dedup');
const { GM2_FEATURES, GM2_ACTIONS, VERIFIED_COMMIT_SOURCES, TRUSTED_SOURCES } = require('./types');

function isQuarantined(record) {
  const slug = record?.playerSlug || record?.slug || record?.payload?.player?.slug;
  return slug ? quarantine.isPlayerQuarantined(slug) : false;
}

function rulesForRecruitingAlerts(record) {
  if (isQuarantined(record)) return { allow: false, reason: 'player_quarantined' };
  if (record.eventType && !publicAlerts().isPublicRecruitingEvent(record)) {
    return { allow: false, reason: 'not_public_recruiting_event' };
  }
  if (record.eventType == null && record.type) {
    const fake = { eventType: record.type, source: record.source, playerSlug: record.playerSlug, title: record.title };
    if (!publicAlerts().isPublicRecruitingEvent(fake)) return { allow: false, reason: 'not_public_alert' };
  }
  return { allow: true };
}

function rulesForIntel(record) {
  if (isQuarantined(record)) return { allow: false, reason: 'player_quarantined' };
  if (!publicAlerts().isPublicIntelItem(record)) return { allow: false, reason: 'not_public_intel' };
  if (publicAlerts().isBrewsterFalseCommit(record)) return { allow: false, reason: 'false_commit_intel' };
  return { allow: true };
}

function rulesForLiveFeedItem(item, { recentFeed = [] } = {}) {
  if (isQuarantined({ playerSlug: item?.meta?.playerSlug })) return { allow: false, reason: 'player_quarantined' };
  const coachText = [item?.title, item?.summary, item?.text, item?.headline].filter(Boolean).join(' ');
  const coachCheck = coachIdentity.validateCoachIdentityText(coachText);
  if (!coachCheck.ok) return { allow: false, reason: 'coach_identity_blocked', blocked: coachCheck.blocked };
  if (publicAlerts().isInvalidHeadlineFeedItem(item)) return { allow: false, reason: 'invalid_headline' };
  if (!publicAlerts().isPublicLiveFeedItem(item)) return { allow: false, reason: 'not_public_feed_item' };
  const key = feedDedup.feedDedupeKey(item);
  if (key && (recentFeed || []).some((other) => {
    if (other === item || feedDedup.feedDedupeKey(other) !== key) return false;
    const a = new Date(item.createdAt || 0).getTime();
    const b = new Date(other.createdAt || 0).getTime();
    return Math.abs(a - b) < feedDedup.DEDUP_WINDOW_MS && b > a;
  })) {
    return { allow: false, reason: 'duplicate_intel_48h' };
  }
  return { allow: true };
}

function rulesForHeadlines(item, context = {}) {
  return rulesForLiveFeedItem(item, context);
}

function rulesForHeatCheckPlayer(player, intelRows = []) {
  if (isQuarantined(player)) return { allow: false, reason: 'player_quarantined' };
  const pv = identityValidator.validatePlayerIdentityRecord(player);
  if (!pv.valid) return { allow: false, reason: 'invalid_identity', errors: pv.errors };
  const hasVerifiedIntel = (intelRows || []).some(
    (i) => i.playerSlug === player.slug && publicAlerts().isPublicIntelItem(i)
  );
  if (!hasVerifiedIntel && !player.stars) return { allow: false, reason: 'no_verified_intel' };
  return { allow: true };
}

function rulesForAutoposter(candidate) {
  if (isQuarantined(candidate)) return { allow: false, reason: 'player_quarantined' };
  if (publicAlerts().isBrewsterFalseQueueItem(candidate)) return { allow: false, reason: 'false_commit_queue' };
  if (candidate.verifiedCommit || candidate.validationMeta?.verifiedCommit) {
    return { allow: true };
  }
  const et = String(candidate.intelType || candidate.eventType || candidate.sourceEventType || '').toLowerCase();
  const trigger = String(candidate.triggerType || '').toLowerCase();
  if (trigger === 'program_news' || et === 'program_news') {
    return { allow: true };
  }
  if (trigger === 'team_event' || et === 'team_event') {
    return { allow: true };
  }
  const src = String(candidate.source || '').toLowerCase();
  const eventSrc = String(
    candidate.sourceEventSource || candidate.validationMeta?.sourceEvent || ''
  ).toLowerCase();
  if (['commit', 'flip'].includes(et)) {
    const verified =
      VERIFIED_COMMIT_SOURCES.has(src) ||
      VERIFIED_COMMIT_SOURCES.has(eventSrc) ||
      TRUSTED_SOURCES.has(eventSrc);
    if (!verified) return { allow: false, reason: 'unverified_commit_autopost' };
  }
  if (/beat/.test(src) && !candidate.identityConfirmed) {
    return { allow: false, reason: 'unverified_beat_autopost' };
  }
  try {
    const validation = require('../x-autoposter-validation');
    if (validation.isPr789AngleElitePost(candidate)) {
      const fullText = String(candidate.text || '').trim();
      if (fullText) {
        const insiderTone = require('../autoposter/insider-tone');
        const tone = insiderTone.validateInsiderTone(fullText, { minWords: 18 });
        const hard = tone.errors.filter((e) => e !== 'too_short' && e !== 'generic_fluff');
        if (hard.length) return { allow: false, reason: hard[0] };
        return { allow: true };
      }
    }
  } catch {
    /* optional */
  }
  try {
    const insiderPrompt = require('../x-autoposter-insider-prompt');
    const blocks = candidate.templateBlocks || {};
    const beatText = candidate.validationMeta?.beatText || null;
    const voiceLayered = candidate.validationMeta?.voiceEngine === true;
    if (beatText && candidate.text && !voiceLayered) {
      const quoteRewriter = require('../x-autoposter-recruiting-quote-rewriter');
      const overlapBody = [blocks.context, blocks.insider].filter(Boolean).join(' ') || candidate.text;
      if (quoteRewriter.exceedsOverlap(overlapBody, beatText)) {
        return { allow: false, reason: 'verbatim_beat_overlap' };
      }
    }
    if (!voiceLayered && insiderPrompt.isGenericInsiderLine(blocks.insider)) {
      return { allow: false, reason: 'generic_insider_line' };
    }
    const check = insiderPrompt.validateInsiderBlocks(
      { contextLine: blocks.context, insiderLine: blocks.insider },
      beatText
    );
    if (!voiceLayered && !check.ok && beatText) {
      return { allow: false, reason: check.errors[0] || 'insider_template_failed' };
    }
    const qualityChecks = require('../autoposter/quality-checks');
    const insiderTone = require('../autoposter/insider-tone');
    const rewriteBody = [blocks.context, blocks.insider].filter(Boolean).join(' ');
    const detectivesPremade =
      String(candidate.source || '').includes('detectives') ||
      candidate.validationMeta?.detectivesResolved === true;
    if (rewriteBody && !detectivesPremade) {
      const qc = qualityChecks.runQualityChecks({ text: rewriteBody, beatText, blocks });
      if (!qc.ok) return { allow: false, reason: qc.errors[0] || 'rewrite_quality_failed' };
    }
    if (rewriteBody) {
      const tone = insiderTone.validateInsiderTone(candidate.text || rewriteBody, {
        minWords: detectivesPremade ? 28 : 40
      });
      if (!tone.ok) return { allow: false, reason: tone.errors[0] || 'forbidden_tone' };
    }
  } catch {
    /* optional */
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
  try {
    const { isStaffOrCoachName } = require('../recruiting-staff-directory');
    if (isStaffOrCoachName(player?.name || player?.playerName)) {
      return { allow: false, reason: 'staff_not_recruit' };
    }
  } catch {
    /* optional */
  }
  if (player?.category === 'target') {
    const { isAllowlistedTarget } = require('../recruiting-target-allowlist');
    if (!isAllowlistedTarget(player)) {
      return { allow: false, reason: 'not_on_charles_allowlist' };
    }
  }
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
  } else if (feature === GM2_FEATURES.LIVE_FEED || feature === GM2_FEATURES.HEADLINES) {
    result = fn(record, context);
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
    const kept = [];
    for (const item of items) {
      if (runRulesEngine(feature, item, { recentFeed: kept }).allow) kept.push(item);
    }
    return kept;
  }
  if (feature === GM2_FEATURES.RECRUITING_ALERTS || feature === GM2_FEATURES.MY_ALERTS) {
    return items.filter((item) => {
      if (!item) return false;
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
