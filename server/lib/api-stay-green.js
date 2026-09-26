/**
 * Optional Render stay-green lock (App Review era) + post-boot heavy-cron guard.
 *
 * When stay-green is active, heavy cron work soft-skips so /health + /api/login stay up.
 *
 * Default OFF after App Store approval (Aug 2026). Opt in with API_STAY_GREEN=true.
 * Force heavy work through even when on with API_STAY_GREEN_ALLOW_HEAVY=true.
 *
 * Boot guard (separate): after a disk-swap deploy the only instance is young.
 * Hourly recruiting-light at :00 can slam ingest + beat + allowlist + hub/refresh
 * while /ready is still the 5s Render probe — HTML 502 for 2+ minutes. Soft-skip
 * those jobs until uptime >= BOOT_HEAVY_MIN_UPTIME_SEC (Render sets 480).
 * Score alerts stay exempt so a Saturday kickoff is not dropped.
 */
'use strict';

function isStayGreen() {
  if (process.env.API_STAY_GREEN_ALLOW_HEAVY === 'true') return false;
  if (process.env.API_STAY_GREEN === 'false') return false;
  // Explicit opt-in only — production no longer defaults to lockdown.
  return process.env.API_STAY_GREEN === 'true';
}

function bootHeavyMinUptimeSec() {
  const raw = String(process.env.BOOT_HEAVY_MIN_UPTIME_SEC || '').trim();
  if (!raw) return 0;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function isBootGuardExempt(label) {
  const id = String(label || '')
    .trim()
    .toLowerCase();
  if (!id) return false;
  const exempt = new Set(
    String(process.env.BOOT_HEAVY_EXEMPT_JOBS || 'gators-score-alerts')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
  if (exempt.has(id)) return true;
  const bare = id.startsWith('ops:') ? id.slice(4) : id;
  return exempt.has(bare);
}

function bootGuardSkipPayload(label) {
  if (isBootGuardExempt(label)) return null;
  const minSec = bootHeavyMinUptimeSec();
  if (minSec <= 0) return null;
  const up = process.uptime();
  if (up >= minSec) return null;
  return {
    ok: true,
    skipped: true,
    reason: 'boot_guard',
    label: label || 'heavy-job',
    uptimeSec: Math.floor(up),
    minUptimeSec: minSec,
    at: new Date().toISOString(),
  };
}

function stayGreenSkipPayload(label) {
  const boot = bootGuardSkipPayload(label);
  if (boot) return boot;
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
  if (bootGuardSkipPayload(jobId) || bootGuardSkipPayload(`ops:${jobId}`)) return true;
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
  bootGuardSkipPayload,
  bootHeavyMinUptimeSec,
  shouldBlockOpsJob,
  STAY_GREEN_ALLOWED_JOBS,
};
