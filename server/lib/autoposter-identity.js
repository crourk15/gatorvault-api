/**
 * Autoposter identity helpers — structured failures, pattern rebuild + retry.
 */

function isIdentitySkipReason(reason) {
  return /identity|not confirmed|incomplete|missing_prediction_fields|board_no_match|ambiguous_board/i.test(
    String(reason || '')
  );
}

function missingFieldsFromEnrichment(enrichment) {
  if (!enrichment) return [];
  return enrichment.missingAfter || enrichment.missingBefore || enrichment.missing || [];
}

function inferSlugForRebuild(context = {}) {
  return (
    context.playerSlug ||
    context.contextual?.player?.slug ||
    context.contextual?.identityPatch?.playerSlug ||
    context.contextual?.candidates?.[0]?.slug ||
    context.mergedSnapshot?.playerSlug ||
    null
  );
}

function isNeedsResolutionSkip(raw) {
  if (!raw) return false;
  return Boolean(raw._needsResolution || raw.skipReason === 'needs_resolution' || raw.needs_resolution);
}

function buildNeedsResolutionPayload({
  missingFields = [],
  playerName = null,
  playerSlug = null,
  triggerPhrase = null,
  fingerprint = null
} = {}) {
  return {
    skipReason: 'needs_resolution',
    _needsResolution: true,
    needs_resolution: true,
    missingFields,
    playerName,
    playerSlug,
    triggerPhrase,
    fingerprint
  };
}

function buildIdentitySkipPayload({
  reason,
  playerName = null,
  playerSlug = null,
  triggerPhrase = null,
  missingPatterns = [],
  missingFields = [],
  contextual = null,
  confirmation = null
} = {}) {
  const ctx = contextual || confirmation?.contextual || null;
  const resolvedName =
    playerName || ctx?.player?.name || ctx?.identityPatch?.playerName || ctx?.mergedSnapshot?.playerName || null;
  const resolvedSlug = playerSlug || inferSlugForRebuild({ contextual: ctx, playerSlug });
  const phrase = triggerPhrase || ctx?.clues?.raw || ctx?.clues?.rawPhrase || null;
  const missingPattern =
    missingPatterns[0] ||
    (Array.isArray(missingFields) && missingFields.length ? missingFields.join(', ') : null) ||
    ctx?.reason ||
    reason ||
    null;

  return {
    skipReason: reason || 'identity_incomplete',
    _identitySkip: true,
    identityFailure: {
      reason: reason || 'identity_incomplete',
      playerName: resolvedName,
      playerSlug: resolvedSlug,
      triggerPhrase: phrase,
      missingPattern,
      missingPatterns: missingPatterns.length ? missingPatterns : missingFields,
      missingFields,
      contextualReason: ctx?.reason || null
    }
  };
}

function isNonPlayerIntelSkip(raw) {
  if (!raw) return false;
  if (raw._nonPlayerSkip || raw.skipReason === 'non_player_intel') return true;
  try {
    return require('./beat-intel-prefilter').isNonPlayerIntelSkip(raw);
  } catch {
    return false;
  }
}

function identityFailureFromCandidate(raw) {
  if (!raw) return null;
  if (isNonPlayerIntelSkip(raw)) return null;
  if (raw.identityFailure) {
    const failure = {
      ...raw.identityFailure,
      triggerPhrase: raw.identityFailure.triggerPhrase || raw.triggerPhrase || null
    };
    if (
      !failure.playerName ||
      String(failure.playerName).trim().toLowerCase() === 'unknown' ||
      !require('./x-autoposter-player-context').isValidPlayerName(failure.playerName)
    ) {
      return null;
    }
    return failure;
  }
  if (!raw.skipReason && !raw._identitySkip) return null;
  if (isNeedsResolutionSkip(raw)) return null;
  if (!isIdentitySkipReason(raw.skipReason)) return null;
  if (
    !raw.playerName ||
    String(raw.playerName).trim().toLowerCase() === 'unknown' ||
    !require('./x-autoposter-player-context').isValidPlayerName(raw.playerName)
  ) {
    return null;
  }
  return buildIdentitySkipPayload({
    reason: raw.skipReason,
    playerName: raw.playerName,
    playerSlug: raw.playerSlug,
    triggerPhrase: raw.triggerPhrase
  }).identityFailure;
}

function formatNeedsResolutionResponse(payload) {
  return {
    error: 'needs_resolution',
    missingFields: payload?.missingFields || [],
    playerName: payload?.playerName || null,
    playerSlug: payload?.playerSlug || null,
    triggerPhrase: payload?.triggerPhrase || null,
    fingerprint: payload?.fingerprint || null
  };
}

async function resolveIntelForAutoposter(intel, opts = {}) {
  const autoResolver = require('./recruiting-auto-resolution');
  const result = await autoResolver.autoResolveIntel(intel, opts);

  if (result.nonPlayerIntel) {
    return { ok: false, nonPlayerIntel: true, skip: result.skip };
  }
  if (result.resolved || result.confirmed) {
    return { ok: true, intel: result.intel, resolution: result };
  }
  return {
    ok: false,
    needs_resolution: true,
    skip: buildNeedsResolutionPayload({
      missingFields: result.missingFields || [],
      playerName: result.mergedSnapshot?.playerName || intel?.playerName || null,
      playerSlug: result.mergedSnapshot?.playerSlug || intel?.playerSlug || null,
      triggerPhrase: intel?.detail || opts.beatText || null,
      fingerprint: intel?.fingerprint || null
    }),
    resolution: result
  };
}

function formatIdentityErrorResponse(failure) {
  if (!failure) {
    return formatNeedsResolutionResponse({ missingFields: [] });
  }
  if (failure.reason === 'needs_resolution' || failure.needs_resolution) {
    return formatNeedsResolutionResponse(failure);
  }
  return formatNeedsResolutionResponse({
    missingFields: failure.missingFields || [],
    playerName: failure.playerName,
    playerSlug: failure.playerSlug,
    triggerPhrase: failure.triggerPhrase,
    fingerprint: failure.fingerprint
  });
}

async function ensurePatternsForPlayer(slugOrPlayer) {
  const recruitingStore = require('./recruiting-store');
  const patternStore = require('./identity-patterns-store');
  const player =
    typeof slugOrPlayer === 'object' && slugOrPlayer?.slug
      ? slugOrPlayer
      : await recruitingStore.getPlayerBySlug(String(slugOrPlayer || '').trim());
  if (!player?.slug) {
    return { ok: false, reason: 'player_not_found', player: null, entry: null, validation: null };
  }
  const entry = await patternStore.syncPatternsForPlayer(player);
  const validation = patternStore.validatePatternEntry(entry, player);
  return { ok: validation.valid, player, entry, validation };
}

function shouldRetryPatternRebuild(result) {
  if (!result || result.confirmed) return false;
  const reason = String(result.reason || result.skipReason || '');
  if (/pattern|board_no_match|identity_not_confirmed|identity_incomplete|ambiguous_board/i.test(reason)) {
    return true;
  }
  return Boolean(inferSlugForRebuild(result));
}

async function retryWithPatternRebuild(runLookup, context = {}) {
  let result = await runLookup();
  if (result?.confirmed || result?.text || (result?.ok !== false && !result?.skipReason && !result?._identitySkip)) {
    return result;
  }
  if (!shouldRetryPatternRebuild(result)) return result;

  const slug = inferSlugForRebuild({ ...context, ...result, contextual: result.contextual });
  if (!slug) return result;

  await ensurePatternsForPlayer(slug);
  const retry = await runLookup();
  if (retry && typeof retry === 'object') {
    retry.patternRebuildAttempted = true;
  }
  return retry;
}

function listMissingContextFields(ctx) {
  if (!ctx) return ['context'];
  const missing = [];
  if (!ctx.name) missing.push('name');
  else {
    const parts = String(ctx.name).trim().split(/\s+/);
    if (parts.length < 2) missing.push('full_name');
  }
  if (!ctx.pos) missing.push('pos');
  if (!ctx.school && !ctx.formerSchool) missing.push('school');
  if (ctx.category !== 'portal' && !ctx.classYear && !ctx.starsLabel && !(ctx.natlRank > 0)) {
    missing.push('class_or_stars');
  }
  return missing;
}

module.exports = {
  isIdentitySkipReason,
  isNonPlayerIntelSkip,
  isNeedsResolutionSkip,
  missingFieldsFromEnrichment,
  inferSlugForRebuild,
  buildIdentitySkipPayload,
  buildNeedsResolutionPayload,
  resolveIntelForAutoposter,
  identityFailureFromCandidate,
  formatIdentityErrorResponse,
  formatNeedsResolutionResponse,
  ensurePatternsForPlayer,
  shouldRetryPatternRebuild,
  retryWithPatternRebuild,
  listMissingContextFields
};
