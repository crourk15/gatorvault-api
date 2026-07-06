/**
 * Pre-flight gates before recruiting posts enter any queue path.
 */
const { isCommittedElsewhere, isFloridaSchool } = require('../recruiting-target-filters');
const handoff = require('./detectives-handoff');
const ledger = require('./player-resolution-ledger');
const { isGoldenProdSlug } = require('../player-intelligence/golden-four-on3');

function beatTextFromInput(input = {}) {
  return String(
    input.beatText ||
      input.text ||
      input.validationMeta?.beatText ||
      input.templateBlocks?.context ||
      ''
  ).trim();
}

function ufInRpmBoard(player = {}) {
  const ufPct = Number(player.ufRpmPct ?? player.ufProbability ?? 0);
  if (ufPct > 0) return true;
  const teams = player.on3TopTeams || player.topTeams || player.competitors || [];
  for (const row of teams) {
    const school = row?.school || row?.team || row?.name || row;
    if (isFloridaSchool(school)) return true;
  }
  return false;
}

function hasUfVisitSignal(player = {}) {
  const status = String(player.ufOvStatus || '').toLowerCase();
  if (['completed', 'scheduled', 'confirmed'].includes(status)) return true;
  if (player.visitStart || player.visitEnd) return true;
  return false;
}

function hasUfRelevance(input = {}, player = null) {
  const beatText = beatTextFromInput(input);
  if (handoff.hasUfRecruitingSignal(beatText)) return true;
  if (!player) return false;
  if (ufInRpmBoard(player)) return true;
  if (hasUfVisitSignal(player)) return true;
  if (player.isUfTarget === true || player.ufTarget === true) return true;
  return false;
}

async function loadPlayer(slug, input = {}) {
  if (input.player && typeof input.player === 'object') return input.player;
  try {
    const store = require('../recruiting-store');
    return (await store.getPlayerBySlug(slug)) || null;
  } catch {
    return null;
  }
}

/**
 * @returns {Promise<{ ok: boolean, action: 'enqueue'|'archive'|'block', reason?: string, archiveReason?: string, committedTo?: string, resolution?: object }>}
 */
async function evaluatePlayerPostPreflight(input = {}) {
  const slug = ledger.normalizeSlug(input.playerSlug || input.player?.slug);
  const intelFingerprint = input.intelFingerprint || null;
  const allowGoldenFour = input.allowGoldenFour === true || isGoldenProdSlug(slug);
  const allowRepublish = input.allowRepublish === true;

  if (!slug) {
    return { ok: true, action: 'enqueue' };
  }

  try {
    const queueStore = require('../x-autoposter-store');
    const pendingSlug = queueStore
      .listQueue({ status: 'pending' })
      .some((item) => ledger.normalizeSlug(item.playerSlug) === slug);
    if (pendingSlug && !allowRepublish) {
      return { ok: false, action: 'block', reason: 'already_pending' };
    }
  } catch {
    /* optional */
  }

  const resolutionCheck = ledger.checkPlayerResolution(slug, {
    intelFingerprint,
    allowGoldenFour,
    allowRepublish
  });
  if (resolutionCheck.blocked) {
    return {
      ok: false,
      action: resolutionCheck.reason === 'duplicate_already_sent' ? 'block' : 'archive',
      reason: resolutionCheck.reason,
      archiveReason: resolutionCheck.archiveReason || resolutionCheck.reason,
      resolution: resolutionCheck.resolution
    };
  }

  const player = await loadPlayer(slug, input);
  const committedTo =
    input.committedTo ||
    input.validationMeta?.committedTo ||
    player?.committedTo ||
    player?.committed_to ||
    null;

  if (committedTo && isCommittedElsewhere({ committedTo })) {
    return {
      ok: false,
      action: 'archive',
      reason: 'committed_elsewhere',
      archiveReason: 'committed_elsewhere',
      committedTo
    };
  }

  if (player && isCommittedElsewhere(player)) {
    return {
      ok: false,
      action: 'archive',
      reason: 'committed_elsewhere',
      archiveReason: 'committed_elsewhere',
      committedTo: player.committedTo || player.committed_to || null
    };
  }

  if (!allowGoldenFour && !hasUfRelevance(input, player)) {
    return {
      ok: false,
      action: 'archive',
      reason: 'uf_irrelevant',
      archiveReason: 'uf_irrelevant'
    };
  }

  try {
    const sentLedger = require('../x-autoposter-sent-ledger');
    const recent = sentLedger.hasRecentSentPost({
      slug,
      playerSlug: slug,
      intelFingerprint,
      text: input.text || null
    });
    if (recent.hit && !allowRepublish) {
      return {
        ok: false,
        action: 'block',
        reason: 'duplicate_already_sent',
        archiveReason: 'duplicate_already_sent',
        tweetId: recent.tweetId || null
      };
    }
  } catch {
    /* optional */
  }

  return { ok: true, action: 'enqueue' };
}

function archiveReasonFromEnqueueFailure(reason, detail) {
  const r = String(reason || '').toLowerCase();
  if (r === 'committed_elsewhere') return 'committed_elsewhere';
  if (r === 'gm2_filter') return 'gm2_block';
  if (r === 'recruiting_qa' || r === 'quality_gate') return 'quality_gate';
  if (r === 'policy') return 'policy_block';
  if (r === 'voice_required_no_legacy_fallback' || r === 'voice_qa_failed') return 'voice_compose_failed';
  if (r === 'banned_phrases') return 'banned_copy_unfixable';
  if (r.includes('identity')) return 'identity_incomplete';
  if (detail && String(detail).includes('committed')) return 'committed_elsewhere';
  return 'case_not_salvageable';
}

module.exports = {
  beatTextFromInput,
  hasUfRelevance,
  evaluatePlayerPostPreflight,
  archiveReasonFromEnqueueFailure
};
