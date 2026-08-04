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

/**
 * Under stay-green, block essentially all ops cron jobs.
 * Tiny allowlist only for jobs that must stay live for Apple/login itself (none today).
 */
const STAY_GREEN_ALLOWED_JOBS = new Set(
  String(process.env.API_STAY_GREEN_ALLOWED_JOBS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
);

function shouldBlockOpsJob(jobId) {
  if (!isStayGreen()) return false;
  const id = String(jobId || '')
    .trim()
    .toLowerCase();
  if (!id) return true;
  if (STAY_GREEN_ALLOWED_JOBS.has(id)) return false;
  return true;
}

module.exports = {
  isStayGreen,
  stayGreenSkipPayload,
  shouldBlockOpsJob,
  STAY_GREEN_ALLOWED_JOBS,
};
