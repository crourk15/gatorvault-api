/**
 * Stable fingerprint for elite compose output — detects material stack drift.
 */
const crypto = require('crypto');

const ELITE_COMPOSE_PATH = 'elite_pr789';

function normalizeSlug(slug) {
  return String(slug || '')
    .trim()
    .toLowerCase();
}

function stableRankings(tokens = null) {
  if (!tokens) return null;
  return {
    on3Stars: tokens.on3Stars ?? null,
    on3NationalRank: tokens.on3NationalRank ?? null,
    on3PositionRank: tokens.on3PositionRank ?? null,
    on3StateRank: tokens.on3StateRank ?? null
  };
}

function payloadFromEliteResult(result = {}) {
  const meta = result.validationMeta || {};
  const blocks = result.templateBlocks || {};
  const rankingTokens = stableRankings(meta.rankingTokens || result.eliteStack?.rankingTokens);
  return {
    composePath: meta.composePath || null,
    identity: String(blocks.identity || meta.identity || '').trim() || null,
    rankingTokens,
    compositeScore: meta.compositeScore ?? null,
    dominantAngle: meta.dominantAngle || null,
    scoutingRefreshAt: meta.scoutingRefresh?.refreshedAt || null,
    pr789AngleLive: !!meta.pr789AngleLive
  };
}

function payloadFromProbe(probeEliteBuild = {}) {
  return {
    composePath: probeEliteBuild.composePath || null,
    identity: String(probeEliteBuild.identity || '').trim() || null,
    rankingTokens: stableRankings(probeEliteBuild.rankingTokens),
    compositeScore: probeEliteBuild.compositeScore ?? null,
    dominantAngle: null,
    scoutingRefreshAt: probeEliteBuild.scoutingRefresh?.refreshedAt || null,
    pr789AngleLive: !!probeEliteBuild.pr789AngleLive
  };
}

function hashElitePayload(payload = {}) {
  const canonical = JSON.stringify(payload);
  return crypto.createHash('sha256').update(canonical).digest('hex').slice(0, 24);
}

function fingerprintFromEliteResult(result = {}) {
  const payload = payloadFromEliteResult(result);
  return {
    payload,
    hash: hashElitePayload(payload),
    ok: payload.composePath === ELITE_COMPOSE_PATH && identityHasRankingLine(payload.identity)
  };
}

function fingerprintFromProbe(probeEliteBuild = {}) {
  const payload = payloadFromProbe(probeEliteBuild);
  return {
    payload,
    hash: hashElitePayload(payload),
    ok: payload.composePath === ELITE_COMPOSE_PATH && identityHasRankingLine(payload.identity)
  };
}

function identityHasRankingLine(identityLine = '') {
  return /On3 No\.\s*\d+\s*natl/i.test(String(identityLine || ''));
}

function isSubElitePreview(preview = '') {
  const text = String(preview || '');
  if (!text.trim()) return true;
  if (!identityHasRankingLine(text)) return true;
  return false;
}

function rankingsMateriallyChanged(before = null, after = null) {
  if (!before && after) return true;
  if (!after) return false;
  const keys = ['on3Stars', 'on3NationalRank', 'on3PositionRank', 'on3StateRank'];
  return keys.some((key) => (before?.[key] ?? null) !== (after?.[key] ?? null));
}

function eliteFingerprintDrift(stored = null, current = null) {
  if (!current?.ok) {
    return { drift: false, reason: 'current_not_elite', subElite: true };
  }
  if (!stored?.hash) {
    return { drift: true, reason: 'no_stored_fingerprint', subElite: !stored };
  }
  if (stored.hash !== current.hash) {
    const rankingDrift = rankingsMateriallyChanged(stored.payload?.rankingTokens, current.payload?.rankingTokens);
    const identityDrift = stored.payload?.identity !== current.payload?.identity;
    const composeDrift = stored.payload?.composePath !== current.payload?.composePath;
    return {
      drift: true,
      reason: composeDrift
        ? 'compose_path_changed'
        : rankingDrift
          ? 'rankings_changed'
          : identityDrift
            ? 'identity_changed'
            : 'elite_stack_changed',
      subElite: stored.payload?.composePath !== ELITE_COMPOSE_PATH,
      rankingDrift,
      identityDrift,
      composeDrift
    };
  }
  return { drift: false, reason: 'unchanged' };
}

module.exports = {
  ELITE_COMPOSE_PATH,
  payloadFromEliteResult,
  payloadFromProbe,
  hashElitePayload,
  fingerprintFromEliteResult,
  fingerprintFromProbe,
  identityHasRankingLine,
  isSubElitePreview,
  rankingsMateriallyChanged,
  eliteFingerprintDrift
};
