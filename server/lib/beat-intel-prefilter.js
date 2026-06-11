/**
 * Pre-filter beat-writer text before identity matching.
 * Vague/generic posts are skipped as non-player intel — they must not block Autoposter.
 */
const { isValidPlayerName } = require('./x-autoposter-player-context');
const { extractPlayerFromText } = require('./x-autoposter-copy');

const GENERIC_INTEL_RES = [
  /^new\s+florida\b/i,
  /florida(?:'s|\u2019s)\s+(?:official\s+visit|is\s+set|will|has|just)/i,
  /(?:florida|gators?)\s+(?:is\s+set\s+to|will|are\s+set\s+to)\s+host/i,
  /host(?:ing|s)?\s+(?:its|their|a)\s+(?:\d+|first|second|third|fourth|fifth)\s+slate/i,
  /official\s+visit(?:er)?\s+preview/i,
  /preview\s+(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+\d/i,
  /the\s+stakes\s+are\s+the/i,
  /(?:no\.?\s*1|#\s*1)\s+(?:wr|qb|rb|lb|cb|s|te|ol|dl|de|edge|dt)\s+in\s+america/i,
  /just\s+landed\s+two\s+commits/i,
  /visit\s+weekend\s+just\s+landed/i,
  /slate\s+of\s+official\s+visitors/i,
  /(?:third|second|first|\d+)\s+slate\s+of\s+official/i,
  /several\s+(?:official\s+)?visitors/i,
  /bunch\s+of\s+(?:visits|targets|commits)/i,
  /big\s+weekend\s+(?:ahead|coming|for\s+florida)/i,
  /weekend\s+just\s+landed/i,
  /two\s+commits/i,
  /landed\s+two\s+commits/i,
  /official\s+visitor\s+blog/i,
  /visitor\s+blog/i,
  /blog\s+is\s+loaded/i,
  /loaded\s+with\s+intel/i,
  /our\s+weekend\s+official/i,
  /weekend\s+official\s+visitor/i,
  /is\s+loaded\s+with\s+intel/i,
  /\bintel\s+on\s+the\s+way\b/i,
  /promo\s+for\s+the\s+blog/i,
  /check\s+out\s+our\s+(?:blog|weekend)/i
];

const PREVIEW_HEADER_RES = [
  /^official\s+visitor\s+preview\b/i,
  /^visit\s+preview\b/i,
  /^ov\s+preview\b/i,
  /^recruiting\s+preview\b/i,
  /^official\s+visitors?\s+preview\b/i
];

const POS_OR_NOISE_PREFIX_RE =
  /^(?:new|the|a|an|s|dl|de|lb|cb|wr|rb|qb|te|ol|dt|edge|ath|k|p|qb|rb|wr|te|ol|ot|og|c|s|ath)\s+/i;
const POS_ONLY_PREFIX_RE = /^(?:QB|RB|WR|TE|OL|OT|OG|C|DL|DT|DE|EDGE|LB|CB|S|ATH|K|P)\s+/i;

/** Non-player UF football intel — schedule, kickoff, uniforms, staff, roster, etc. */
const TEAM_EVENT_SIGNALS = [
  { type: 'kickoff', re: /\b(kickoff|kick-off|start time|game time|tip(?:s)? off)\b/i },
  {
    type: 'schedule',
    re: /\b(schedule(?:d)?(?:\s+(?:update|change|release))?|week \d+|tv network|sec network|espn|abc|cbs|peacock|prime video)\b/i
  },
  { type: 'uniform', re: /\b(uniform|jersey|alternate|throwback|helmet combo|all[-\s]?orange)\b/i },
  {
    type: 'staff',
    re: /\b(hired|promoted|resigned|fired|named\b.*(?:coordinator|coach)|staff (?:update|change|addition))\b/i
  },
  { type: 'depth_chart', re: /\b(depth chart|two-deep|starter|starting (?:qb|lineup)|rotation)\b/i },
  { type: 'roster', re: /\b(roster (?:update|move)|walk-on|scholarship player|transfer(?:ring)? in)\b/i },
  { type: 'game_week', re: /\b(game week|pregame|matchup|vs\.|@)\b/i },
  { type: 'camp', re: /\b(spring (?:game|practice)|fall camp|practice report)\b/i },
  { type: 'injury', re: /\b(injury report|ruled out|game-time decision|out for the season)\b/i }
];

/** Program-level UF football news — stadium, NIL, SEC/TV, realignment, branding, etc. */
const PROGRAM_NEWS_SIGNALS = [
  {
    type: 'stadium_facility',
    re: /\b(ben hill griffin|the swamp|stadium|renovation|renovate|facilit(?:y|ies)|facility upgrade|training center|locker room|weight room|capital project|\$[\d,.]+\s*(?:b(?:illion)?|m(?:illion)?))\b/i
  },
  {
    type: 'nil_infrastructure',
    re: /\b(nil (?:collective|infrastructure|deal|program)|gator (?:nil|collective)|name,? image and likeness)\b/i
  },
  {
    type: 'athletic_release',
    re: /\b(florida athletics|athletic department|uaa|gator athletics|uf athletics)\b/i
  },
  {
    type: 'program_update',
    re: /\b(football program|gator football program|uf football|program announcement|program update|major (?:program|football) (?:update|news|announcement))\b/i
  },
  {
    type: 'sec_tv',
    re: /\b(sec network|tv announcement|telecast|broadcast rights|flex schedule|national tv|media rights)\b/i
  },
  {
    type: 'realignment',
    re: /\b(conference realignment|realignment|sec expansion|expansion (?:team|school)|super conference)\b/i
  },
  {
    type: 'branding',
    re: /\b(uniform reveal|jersey reveal|branding|helmet reveal|alternate uniform|new (?:logo|wordmark|brand))\b/i
  }
];

/** Team-event types that should stay on team_event, not PROGRAM_NEWS. */
const TEAM_EVENT_OVERRIDES_PROGRAM = new Set([
  'kickoff',
  'schedule',
  'game_week',
  'depth_chart',
  'roster',
  'camp',
  'injury',
  'staff'
]);

function normalizePhrase(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isCorruptedOrHeadlinePhrase(text) {
  const t = normalizePhrase(text);
  if (/^[a-z]\s+[a-z]+\s+[a-z]+/i.test(t) && t.length < 72) return true;
  if (/^(?:dl|de|lb|cb|wr|rb|qb|te|ol|dt|edge|s)\s+[a-z]/i.test(t) && !/\b20\d{2}\b/.test(t)) return true;
  if (/^new\s+[a-z]+\s+[a-z]+(?:'s)?\s+florida\s+official/i.test(t)) return true;
  return false;
}

function isGenericNonPlayerIntel(text) {
  const t = normalizePhrase(text);
  if (!t) return true;
  if (isCorruptedOrHeadlinePhrase(t)) return true;
  if (PREVIEW_HEADER_RES.some((re) => re.test(t))) return true;
  if (GENERIC_INTEL_RES.some((re) => re.test(t))) return true;
  return false;
}

/** Recruiting signals that override generic-phrase rejection for trusted beat writers. */
function hasStrongRecruitingSignals(text, post = null) {
  const t = normalizePhrase(text);
  if (!t) return false;

  let copy;
  try {
    copy = require('./x-autoposter-copy');
  } catch {
    copy = null;
  }
  if (copy?.hasPlayerSpecificIntel?.(t)) return true;

  const name =
    extractCleanFullName(t) || (copy?.extractPlayerFromText ? copy.extractPlayerFromText(t) : null);
  const hasName = name && isValidPlayerName(name);

  if (hasName) {
    if (/\b(202[6-9]|2030)\b/.test(t)) return true;
    if (/\b(QB|RB|WR|TE|OL|OT|OG|C|DL|DT|DE|EDGE|LB|CB|S|ATH|K|P)\b/.test(t)) return true;
    if (
      /\b(?:from|at)\s+[A-Z][A-Za-z0-9 .'-]+(?:High(?:\s+School)?|HS|Academy|Prep|Christian|School)\b/.test(
        t
      )
    ) {
      return true;
    }
    if (
      /\b(?:official visit|\bov\b|\buv\b|visit|offer(?:ed|s)?|commit(?:ted|ment)?|decommit|flip(?:ped)?|portal|prediction|rpm|rivals|battle|forecast)\b/i.test(
        t
      )
    ) {
      return true;
    }
  }

  if (
    /\b(recruiting battle|flip race|pulling ahead|leaning toward|momentum|heating up|staff loves)\b/i.test(
      t
    ) &&
    hasName
  ) {
    return true;
  }

  if (post) {
    let beatFilters;
    try {
      beatFilters = require('./beat-writer-filters');
    } catch {
      beatFilters = null;
    }
    if (beatFilters?.isFloridaRelatedUrl) {
      const urls = [];
      if (Array.isArray(post.attachmentUrls)) urls.push(...post.attachmentUrls);
      if (post.url) urls.push(post.url);
      const fromText = t.match(/https?:\/\/[^\s]+/g) || [];
      urls.push(...fromText);
      if (urls.some((u) => beatFilters.isFloridaRelatedUrl(u))) return true;
    }
  }

  return false;
}

function isSingleTokenName(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return parts.length < 2;
}

function classifyTeamEventType(text) {
  const t = normalizePhrase(text);
  if (!t) return null;
  for (const { type, re } of TEAM_EVENT_SIGNALS) {
    if (re.test(t)) return type;
  }
  try {
    const beatFilters = require('./beat-writer-filters');
    if (beatFilters.matchesGatorFootballIntel(t)) return 'general';
  } catch {
    /* optional */
  }
  return null;
}

function classifyProgramNewsType(text) {
  const t = normalizePhrase(text);
  if (!t) return null;
  for (const { type, re } of PROGRAM_NEWS_SIGNALS) {
    if (re.test(t)) return type;
  }
  return null;
}

function isProgramNewsIntel(text, post = null) {
  const phrase = normalizePhrase(text);
  if (!phrase || isGenericNonPlayerIntel(phrase)) return false;

  let beatFilters;
  try {
    beatFilters = require('./beat-writer-filters');
  } catch {
    return false;
  }
  if (!beatFilters.isFloridaRelevant(phrase)) return false;
  if (post && beatFilters.isNationalUfOnlyReporter(post) && !beatFilters.isFloridaRelevantPost(post)) {
    return false;
  }

  let copy;
  try {
    copy = require('./x-autoposter-copy');
  } catch {
    copy = null;
  }
  if (copy?.hasPlayerSpecificIntel?.(phrase)) return false;

  const programType = classifyProgramNewsType(phrase);
  if (!programType) return false;

  const teamType = classifyTeamEventType(phrase);
  if (teamType && TEAM_EVENT_OVERRIDES_PROGRAM.has(teamType)) return false;

  return true;
}

function evaluateProgramNewsEligibility(text, { post = null } = {}) {
  const phrase = normalizePhrase(text);
  if (!isProgramNewsIntel(phrase, post)) {
    return { eligible: false, reason: 'not_program_news', category: 'non_player_intel' };
  }
  const programNewsType = classifyProgramNewsType(phrase) || 'general';
  return {
    eligible: true,
    triggerType: 'program_news',
    programNewsType,
    playerName: null,
    playerSlug: null,
    matchMode: 'program_news',
    triggerPhrase: phrase.slice(0, 160)
  };
}

function isTeamEventIntel(text, post = null) {
  const phrase = normalizePhrase(text);
  if (!phrase || isGenericNonPlayerIntel(phrase)) return false;

  let beatFilters;
  try {
    beatFilters = require('./beat-writer-filters');
  } catch {
    return false;
  }
  if (!beatFilters.isFloridaRelevant(phrase)) return false;
  if (post && beatFilters.isNationalUfOnlyReporter(post) && !beatFilters.isFloridaRelevantPost(post)) {
    return false;
  }

  let copy;
  try {
    copy = require('./x-autoposter-copy');
  } catch {
    copy = null;
  }
  if (copy?.hasPlayerSpecificIntel?.(phrase)) return false;

  return Boolean(classifyTeamEventType(phrase));
}

function evaluateTeamEventEligibility(text, { post = null } = {}) {
  const phrase = normalizePhrase(text);
  if (!isTeamEventIntel(phrase, post)) {
    return { eligible: false, reason: 'not_team_event', category: 'non_player_intel' };
  }
  const teamEventType = classifyTeamEventType(phrase) || 'general';
  return {
    eligible: true,
    triggerType: 'team_event',
    teamEventType,
    playerName: null,
    playerSlug: null,
    matchMode: 'team_event',
    triggerPhrase: phrase.slice(0, 160)
  };
}

function extractCleanFullName(text) {
  const fromBeat = extractPlayerFromText(text);
  if (fromBeat && isValidPlayerName(fromBeat) && !isSingleTokenName(fromBeat)) {
    return fromBeat;
  }

  let t = normalizePhrase(text);
  t = t.replace(POS_OR_NOISE_PREFIX_RE, '').replace(POS_ONLY_PREFIX_RE, '');

  const namePatterns = [
    /\b([A-Z][a-z'.-]{1,}\s+[A-Z][a-z'.-]{1,}(?:\s+[A-Z][a-z'.-]{1,})?)\b/,
    /\b(?:new|the)\s+([A-Z][a-z'.-]{1,}\s+[A-Z][a-z'.-]{1,})\b/i
  ];
  for (const re of namePatterns) {
    const m = t.match(re);
    const candidate = m?.[1]?.trim();
    if (candidate && isValidPlayerName(candidate) && !isSingleTokenName(candidate)) {
      return candidate;
    }
  }
  return null;
}

async function evaluateBeatIntelEligibility(
  text,
  { playerName = null, playerSlug = null, trustedWriter = false, post = null } = {}
) {
  const phrase = normalizePhrase(text);
  const trustedOverride = trustedWriter && hasStrongRecruitingSignals(phrase, post);

  const invalidName =
    playerName &&
    (String(playerName).trim().toLowerCase() === 'unknown' ||
      isSingleTokenName(playerName) ||
      !isValidPlayerName(playerName));

  let resolvedName =
    playerName && isValidPlayerName(playerName) && !isSingleTokenName(playerName) ? playerName.trim() : null;
  let resolvedSlug = playerSlug || null;

  if (!phrase) {
    if (resolvedName) {
      return {
        eligible: true,
        playerName: resolvedName,
        playerSlug: resolvedSlug,
        matchMode: 'intel_record',
        triggerPhrase: null
      };
    }
    return { eligible: false, reason: 'empty_text', category: 'non_player_intel' };
  }

  if (isGenericNonPlayerIntel(phrase) && !trustedOverride) {
    return {
      eligible: false,
      reason: 'generic_phrase',
      category: 'non_player_intel',
      triggerPhrase: phrase.slice(0, 160)
    };
  }

  if (!resolvedName || invalidName) resolvedName = extractCleanFullName(phrase);

  if (resolvedName && isValidPlayerName(resolvedName) && !isSingleTokenName(resolvedName)) {
    return {
      eligible: true,
      playerName: resolvedName,
      playerSlug: resolvedSlug,
      matchMode: 'full_name',
      triggerPhrase: phrase.slice(0, 160)
    };
  }

  if (resolvedSlug) {
    try {
      const store = require('./recruiting-store');
      const player = await store.getPlayerBySlug(resolvedSlug);
      if (player?.name && isValidPlayerName(player.name) && !isSingleTokenName(player.name)) {
        return {
          eligible: true,
          playerName: player.name,
          playerSlug: player.slug,
          matchMode: 'known_slug',
          triggerPhrase: phrase.slice(0, 160)
        };
      }
    } catch {
      /* optional */
    }
  }

  try {
    const resolver = require('./contextual-identity-resolver');
    const override = resolver.lookupManualOverride(phrase);
    if (override?.playerSlug) {
      const store = require('./recruiting-store');
      const player = await store.getPlayerBySlug(override.playerSlug);
      if (player?.name && isValidPlayerName(player.name)) {
        return {
          eligible: true,
          playerName: player.name,
          playerSlug: player.slug,
          matchMode: 'manual_override',
          triggerPhrase: phrase.slice(0, 160)
        };
      }
    }

    const patternStore = require('./identity-patterns-store');
    const entries = await patternStore.listAllPatterns();
    const hit = resolver.lookupIdentityPattern(phrase, entries);
    if (hit?.slug) {
      const store = require('./recruiting-store');
      const player = await store.getPlayerBySlug(hit.slug);
      if (player?.name && isValidPlayerName(player.name)) {
        return {
          eligible: true,
          playerName: player.name,
          playerSlug: player.slug,
          matchMode: 'identity_pattern',
          matchedPattern: hit.matchedPattern,
          triggerPhrase: phrase.slice(0, 160)
        };
      }
    }
  } catch {
    /* optional */
  }

  const partial = playerName && !invalidName ? playerName : extractCleanFullName(phrase);
  if (trustedOverride && partial && isValidPlayerName(partial)) {
    return {
      eligible: true,
      playerName: partial.trim(),
      playerSlug: resolvedSlug,
      matchMode: isSingleTokenName(partial) ? 'trusted_partial_name' : 'trusted_strong_signal',
      triggerPhrase: phrase.slice(0, 160)
    };
  }
  return {
    eligible: false,
    reason: partial && isSingleTokenName(partial) ? 'single_name_only' : 'no_identifiable_player',
    category: 'non_player_intel',
    triggerPhrase: phrase.slice(0, 160)
  };
}

function buildNonPlayerSkipPayload(gate) {
  return {
    skipReason: 'non_player_intel',
    _nonPlayerSkip: true,
    triggerPhrase: gate.triggerPhrase || null,
    nonPlayerIntel: {
      reason: gate.reason,
      category: gate.category || 'non_player_intel',
      triggerPhrase: gate.triggerPhrase || null
    }
  };
}

function logNonPlayerIntel({ text, reason, source = null, subsystem = 'autoposter:beat-writer' } = {}) {
  const phrase = normalizePhrase(text).slice(0, 160);
  try {
    require('./ops-monitor').logEvent({
      subsystem,
      status: 'skipped',
      message: 'non-player intel',
      details: { reason: reason || 'no_identifiable_player', triggerPhrase: phrase, source }
    });
  } catch {
    /* ops optional */
  }
}

function isNonPlayerIntelSkip(raw) {
  if (!raw) return false;
  return Boolean(raw._nonPlayerSkip || raw.skipReason === 'non_player_intel');
}

/**
 * If ineligible, logs and returns a skip payload — otherwise null (continue pipeline).
 */
async function bypassRecruitingPipeline(text, context = {}) {
  const gate = await evaluateBeatIntelEligibility(text, {
    playerName: context.playerName,
    playerSlug: context.playerSlug,
    trustedWriter: context.trustedWriter,
    post: context.post
  });
  if (gate.eligible) return null;
  logNonPlayerIntel({
    text,
    reason: gate.reason,
    source: context.source || context.sourceHandle || null,
    subsystem: context.subsystem || 'autoposter'
  });
  return buildNonPlayerSkipPayload(gate);
}

/**
 * Whether recruiting intel should appear on the live feed or in stores.
 * Sync check — use for feed filtering; async evaluateBeatIntelEligibility for ingest gates.
 */
function shouldSurfaceRecruitingIntelSync(intel) {
  if (!intel || typeof intel !== 'object') return false;
  if (intel.resolutionStatus === 'needs_resolution' || intel.surfaced === false) return false;
  const playerName = String(intel.playerName || '').trim();
  if (!playerName || playerName.toLowerCase() === 'unknown') return false;
  if (isSingleTokenName(playerName) || !isValidPlayerName(playerName)) return false;
  const phrase = normalizePhrase(intel.detail || intel.status || playerName);
  if (!phrase) return false;
  if (isGenericNonPlayerIntel(phrase)) return false;
  if (isCorruptedOrHeadlinePhrase(phrase)) return false;
  return true;
}

async function shouldSurfaceRecruitingIntel(intel) {
  if (!shouldSurfaceRecruitingIntelSync(intel)) return false;
  const gate = await evaluateBeatIntelEligibility(intel.detail || '', {
    playerName: intel.playerName,
    playerSlug: intel.playerSlug
  });
  return gate.eligible;
}

async function guardBeatPost(post, { subsystem = 'autoposter' } = {}) {
  const text = normalizePhrase(post?.text || '');
  if (!text) {
    return {
      eligible: false,
      skip: buildNonPlayerSkipPayload({ reason: 'empty_text', category: 'non_player_intel', triggerPhrase: '' })
    };
  }

  const programGate = evaluateProgramNewsEligibility(text, { post });
  if (programGate.eligible) {
    return {
      eligible: true,
      triggerType: 'program_news',
      programNewsType: programGate.programNewsType,
      text,
      playerName: null,
      playerSlug: null,
      gate: programGate
    };
  }

  const teamGate = evaluateTeamEventEligibility(text, { post });
  if (teamGate.eligible) {
    return {
      eligible: true,
      triggerType: 'team_event',
      teamEventType: teamGate.teamEventType,
      text,
      playerName: null,
      playerSlug: null,
      gate: teamGate
    };
  }

  const skip = await bypassRecruitingPipeline(text, {
    source: post?.handle || post?.writerName || post?.outlet,
    sourceHandle: post?.handle,
    subsystem,
    trustedWriter: require('./beat-writer-filters').isTrustedBeatWriter?.(post),
    post
  });
  if (skip) return { eligible: false, skip, text };
  const gate = await evaluateBeatIntelEligibility(text, {
    trustedWriter: require('./beat-writer-filters').isTrustedBeatWriter?.(post),
    post
  });
  return { eligible: true, gate, text, playerName: gate.playerName, playerSlug: gate.playerSlug };
}

module.exports = {
  normalizePhrase,
  isCorruptedOrHeadlinePhrase,
  isGenericNonPlayerIntel,
  hasStrongRecruitingSignals,
  extractCleanFullName,
  classifyTeamEventType,
  classifyProgramNewsType,
  isTeamEventIntel,
  isProgramNewsIntel,
  evaluateTeamEventEligibility,
  evaluateProgramNewsEligibility,
  evaluateBeatIntelEligibility,
  buildNonPlayerSkipPayload,
  logNonPlayerIntel,
  isNonPlayerIntelSkip,
  bypassRecruitingPipeline,
  shouldSurfaceRecruitingIntelSync,
  shouldSurfaceRecruitingIntel,
  guardBeatPost
};
