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

function isSingleTokenName(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return parts.length < 2;
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

async function evaluateBeatIntelEligibility(text, { playerName = null, playerSlug = null } = {}) {
  const phrase = normalizePhrase(text);

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

  if (isGenericNonPlayerIntel(phrase)) {
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
  const gate = await evaluateBeatIntelEligibility(text, context);
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
  const skip = await bypassRecruitingPipeline(text, {
    source: post?.handle || post?.writerName || post?.outlet,
    sourceHandle: post?.handle,
    subsystem
  });
  if (skip) return { eligible: false, skip, text };
  const gate = await evaluateBeatIntelEligibility(text);
  return { eligible: true, gate, text, playerName: gate.playerName, playerSlug: gate.playerSlug };
}

module.exports = {
  normalizePhrase,
  isCorruptedOrHeadlinePhrase,
  isGenericNonPlayerIntel,
  extractCleanFullName,
  evaluateBeatIntelEligibility,
  buildNonPlayerSkipPayload,
  logNonPlayerIntel,
  isNonPlayerIntelSkip,
  bypassRecruitingPipeline,
  shouldSurfaceRecruitingIntelSync,
  shouldSurfaceRecruitingIntel,
  guardBeatPost
};
