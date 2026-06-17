/**
 * Production pipeline kill switches + safe intel normalization.
 * All rewrite/autoposter/intel paths should consult these guards first.
 */

const DEFAULT_INTEL = Object.freeze({
  eventType: 'unknown',
  player: null,
  timestamp: null,
  text: '',
  detail: ''
});

let _scheduledOffLogged = false;

function isEnvTrue(name) {
  return process.env[name] === 'true';
}

function pipelinesEnabled() {
  return isEnvTrue('X_PIPELINES_ENABLED');
}

function pipelinesSkipped(reason = 'pipelines disabled') {
  return { ok: false, skipped: true, reason };
}

function autopostEnabled() {
  return pipelinesEnabled() && isEnvTrue('X_AUTOPOST_ENABLED');
}

function gm2RewriteEnabled() {
  return pipelinesEnabled() && isEnvTrue('X_GM2_REWRITE_ENABLED');
}

function intelRewriteEnabled() {
  return pipelinesEnabled() && isEnvTrue('X_INTEL_REWRITE_ENABLED');
}

function autopromptEnabled() {
  return pipelinesEnabled() && isEnvTrue('X_AUTOPROMPT_ENABLED');
}

function scheduledJobsEnabled() {
  return isEnvTrue('X_SCHEDULED_JOBS_ENABLED');
}

function guardScheduledJobStart(label) {
  if (scheduledJobsEnabled()) return true;
  if (!_scheduledOffLogged) {
    console.log('[schedulers] Cron disabled — X_SCHEDULED_JOBS_ENABLED is not true');
    _scheduledOffLogged = true;
  }
  if (label) {
    console.log(`[schedulers] skip ${label}`);
  }
  return false;
}

function normalizeIntel(rawIntel) {
  if (rawIntel == null || typeof rawIntel !== 'object' || Array.isArray(rawIntel)) {
    return { ...DEFAULT_INTEL };
  }
  const intel = { ...rawIntel };
  if (!intel.eventType) intel.eventType = DEFAULT_INTEL.eventType;
  if (!intel.player && intel.playerName) {
    intel.player = { name: intel.playerName, slug: intel.playerSlug || intel.playerId || null };
  }
  if (!intel.player) intel.player = null;
  if (!intel.timestamp) {
    intel.timestamp = intel.createdAt || intel.updatedAt || intel.reportedAt || null;
  }
  intel.text = intel.text || intel.detail || '';
  intel.detail = intel.detail || intel.text || '';
  return intel;
}

function guardIntelForPipeline(rawIntel) {
  return normalizeIntel(rawIntel);
}

module.exports = {
  DEFAULT_INTEL,
  pipelinesEnabled,
  pipelinesSkipped,
  autopostEnabled,
  gm2RewriteEnabled,
  intelRewriteEnabled,
  autopromptEnabled,
  scheduledJobsEnabled,
  guardScheduledJobStart,
  normalizeIntel,
  guardIntelForPipeline
};
