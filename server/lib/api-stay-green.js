/**
 * Optional Render stay-green lock (App Review era).
 *
 * When active, heavy cron work soft-skips so /health + /api/login stay up.
 *
 * Default OFF after App Store approval (Aug 2026). Opt in with API_STAY_GREEN=true.
 * Force heavy work through even when on with API_STAY_GREEN_ALLOW_HEAVY=true.
 */
'use strict';

function isStayGreen() {
  if (process.env.API_STAY_GREEN_ALLOW_HEAVY === 'true') return false;
  if (process.env.API_STAY_GREEN === 'false') return false;
  // Explicit opt-in only — production no longer defaults to lockdown.
  return process.env.API_STAY_GREEN === 'true';
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
