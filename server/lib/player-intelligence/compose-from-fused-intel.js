/**
 * Compose PR-789 posts from fused player intel — no PR-6 template fallback.
 */
const { composeGoldenFourFactPost, PR6_FALLBACK_RE } = require('./golden-four-compose');

/**
 * @param {object} fused — output from fusePlayerIntel
 * @returns {object}
 */
function composeFromFusedIntel(fused) {
  if (!fused?.slug || !fused?.beatText) {
    return { ok: false, reason: 'missing_fused_intel' };
  }
  if (fused.publishAction === 'archive') {
    return { ok: false, reason: 'confidence_archive', confidence: fused.confidence };
  }

  const intelRow = fused.primaryIntelRow || {};
  const built = composeGoldenFourFactPost({
    slug: fused.slug,
    intel: {
      playerName: fused.playerIntel?.identity?.name || intelRow.playerName,
      detail: fused.beatText,
      skinny: fused.beatText,
      source: intelRow.source || 'fuse-player-intel'
    },
    on3Sync: fused.on3Sync,
    playerRow: fused.playerRow
  });

  if (!built?.ok || !built.text) {
    return {
      ...(built || { ok: false }),
      reason: built?.reason || 'compose_failed',
      confidence: fused.confidence,
      publishAction: fused.publishAction
    };
  }

  if (PR6_FALLBACK_RE.test(built.text)) {
    return { ok: false, reason: 'pr6_fallback_blocked', confidence: fused.confidence };
  }

  return {
    ...built,
    validationMeta: {
      ...(built.validationMeta || {}),
      fusedIntelCompose: true,
      pr789AngleLive: true,
      eliteBeatIntel: true,
      eliteCompose: true,
      publishTier: 'pr789_angle',
      voiceEngine: true,
      fuseConfidence: fused.confidence,
      fusePublishAction: fused.publishAction,
      fuseGapCount: fused.gaps?.length || 0,
      beatText: fused.beatText
    }
  };
}

module.exports = {
  composeFromFusedIntel
};
