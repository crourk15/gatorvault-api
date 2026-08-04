/**
 * App Review / Render stay-green lock.
 *
 * When active, heavy cron work soft-skips so /health + /api/login stay up.
 * Admin Hub red alerts remain sensitive — this stops the restarts, not the light.
 *
 * Default ON in production. Opt out with API_STAY_GREEN=false.
 * Force heavy work through with API_STAY_GREEN_ALLOW_HEAVY=true.
 */
'use strict';

function isStayGreen() {
  if (process.env.API_STAY_GREEN === 'false') return false;
  if (process.env.API_STAY_GREEN_ALLOW_HEAVY === 'true') return false;
  if (process.env.API_STAY_GREEN === 'true') return true;
  return process.env.NODE_ENV === 'production';
}

function stayGreenSkipPayload(label) {
  if (!isStayGreen()) return null;
  return {
    ok: true,
    skipped: true,
    reason: 'api_stay_green',
    label: label || 'heavy-job',
    at: new Date().toISOString(),
  };
}

/** Ops job ids that must not run under stay-green (crash /ready). */
const STAY_GREEN_BLOCKED_JOBS = new Set([
  'gators-score-alerts',
  'recruiting-ingest',
  'hub-refresh',
  'recruiting-hub-refresh',
  'beat-late-ingest',
  'live-refresh',
  'platform-health-sweep',
  'nil-refresh',
  'depth-chart-refresh',
  'game-zone-refresh',
]);

function shouldBlockOpsJob(jobId) {
  if (!isStayGreen()) return false;
  const id = String(jobId || '')
    .trim()
    .toLowerCase();
  return STAY_GREEN_BLOCKED_JOBS.has(id);
}

module.exports = {
  isStayGreen,
  stayGreenSkipPayload,
  shouldBlockOpsJob,
  STAY_GREEN_BLOCKED_JOBS,
};
