/**
 * Publish routing — PR-789 elite → PR-6 fallback → fail closed.
 * Strategy v2 template output must never be published when templates are disabled.
 */
const { validateBannedPhrases } = require('./rewrite/fact-gates');
const { isPr6Enabled } = require('./rewrite/rewrite-types');

function isTemplatesPublishDisabled() {
  return process.env.X_DISABLE_TEMPLATES !== 'false';
}

function firstCleanCandidate(candidates = []) {
  for (const entry of candidates) {
    const text = String(entry.text || '').trim();
    if (!text) continue;
    if (validateBannedPhrases(text).ok) {
      return { tier: entry.tier, text };
    }
  }
  return null;
}

/**
 * Resolve publish copy: PR-789 angle → PR-789 → PR-6 → (optional legacy strategy) → skip.
 * @returns {{ ok: true, text: string, tier: string, metadata: object } | { ok: false, skipped: true, reason: string }}
 */
function resolvePublishText(signal, strategyText, metadata = {}) {
  const candidates = [];

  if (metadata.pr789AngleLive && metadata.pr789AngleText) {
    candidates.push({ tier: 'pr789_angle', text: metadata.pr789AngleText });
  } else if (metadata.pr789AngleShadow?.ok && metadata.pr789AngleShadow.rewrittenTweet) {
    candidates.push({ tier: 'pr789_angle_shadow', text: metadata.pr789AngleShadow.rewrittenTweet });
  }

  if (metadata.pr789Live && metadata.pr789Text) {
    candidates.push({ tier: 'pr789', text: metadata.pr789Text });
  } else if (metadata.pr789Shadow?.ok && metadata.pr789Shadow.rewrittenTweet) {
    candidates.push({ tier: 'pr789_shadow', text: metadata.pr789Shadow.rewrittenTweet });
  }

  if (metadata.pr6Shadow?.ok && metadata.pr6Shadow.rewrittenTweet) {
    candidates.push({ tier: 'pr6', text: metadata.pr6Shadow.rewrittenTweet });
  }

  const picked = firstCleanCandidate(candidates);
  if (picked) {
    return {
      ok: true,
      text: picked.text,
      tier: picked.tier,
      metadata: {
        ...metadata,
        publishTier: picked.tier,
        pr6Live: picked.tier === 'pr6' || String(picked.tier).startsWith('pr789'),
        pr5Text: strategyText,
        templatesBypassed: picked.tier !== 'strategy_v2'
      }
    };
  }

  if (!isTemplatesPublishDisabled() && strategyText && validateBannedPhrases(strategyText).ok) {
    return {
      ok: true,
      text: strategyText,
      tier: 'strategy_v2',
      metadata: { ...metadata, publishTier: 'strategy_v2', templatesBypassed: false }
    };
  }

  const reason = candidates.length ? 'banned_phrases' : isPr6Enabled() ? 'intel_incomplete' : 'pr6_disabled';
  return { ok: false, skipped: true, reason, metadata };
}

module.exports = {
  isTemplatesPublishDisabled,
  resolvePublishText,
  firstCleanCandidate
};
