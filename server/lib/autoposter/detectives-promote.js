/**
 * Detectives PR3 — promote repaired cases via Voice Engine with detectiveOverride.
 */
const voiceEngine = require('./voice-engine');
const metricsRepair = require('./detectives-metrics');
const store = require('./detectives-store');
const { SITE_URL } = require('./discovery-core');

function hasPromotableMetrics(metrics = {}) {
  if (metrics.rpm != null && Number(metrics.rpm) > 0) return true;
  if (metrics.visitDate || metrics.visitStart) return true;
  if (Array.isArray(metrics.compSchools) && metrics.compSchools.length) return true;
  return false;
}

function logPromoteAttempt(caseId, payload = {}) {
  if (!caseId) return;
  store.appendLog(caseId, { phase: 'promote', ...payload });
}

async function buildVoicePromoteCandidate({ caseItem, hints, identity, platformContext, research }) {
  const metrics = hints?.metrics || {};
  const voiceRequired =
    voiceEngine.voiceRequiredForRecruiting() &&
    String(hints?.beatText || '').trim();
  if (!hasPromotableMetrics(metrics) && !voiceRequired) {
    logPromoteAttempt(caseItem?.id, { ok: false, reason: 'no_promotable_metrics' });
    return null;
  }
  if (!voiceEngine.voiceEngineEnabled()) {
    logPromoteAttempt(caseItem?.id, { ok: false, reason: 'voice_disabled' });
    return null;
  }

  const built = await voiceEngine.composeFromDetectiveCase({
    hints,
    identity,
    platformContext,
    research,
    detectiveOverride: metrics
  });

  if (!built?.ok || !built.text) {
    logPromoteAttempt(caseItem?.id, {
      ok: false,
      reason: built?.reason || 'compose_failed',
      metrics
    });
    return null;
  }

  if (built.validationMeta?.strategyTrace?.confidence === 'zero') {
    logPromoteAttempt(caseItem?.id, {
      ok: false,
      reason: 'strategy_confidence_zero',
      trace: built.validationMeta.strategyTrace
    });
    return null;
  }

  logPromoteAttempt(caseItem?.id, {
    ok: true,
    reason: null,
    charCount: built.text.length,
    metrics: built.validationMeta?.voiceMetrics || metrics
  });

  return {
    ok: true,
    text: built.text,
    playerName: built.playerName || identity?.playerName || hints?.playerName,
    playerSlug: built.playerSlug || identity?.playerSlug || hints?.playerSlug,
    templateBlocks: built.templateBlocks,
    validationMeta: built.validationMeta,
    category: 'news',
    topic: 'recruiting',
    urgencyLabel: 'major_beat',
    sourceEventType: 'detectives_voice_promote',
    sources: [
      { label: 'On3', url: SITE_URL },
      { label: hints?.writerName || 'Beat', url: hints?.url || SITE_URL }
    ],
    identityConfirmed: true,
    source: 'auto:detectives'
  };
}

module.exports = {
  hasPromotableMetrics,
  buildVoicePromoteCandidate,
  logPromoteAttempt
};
