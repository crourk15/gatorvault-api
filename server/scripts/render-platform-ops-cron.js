#!/usr/bin/env node
/**
 * Render cron — platform maintenance jobs via /api/ops/run-job.
 * Runs even when in-process schedulers miss ticks (cold start, deploy, etc.).
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { warmApi } = require('../lib/ingest-resilience');

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || process.env.API_BASE || 'https://gatorvault-api.onrender.com').replace(
  /\/$/,
  ''
);
const CRON_SECRET = process.env.MONITORING_CRON_SECRET || process.env.INGEST_CRON_SECRET || process.env.CRON_SECRET || '';

const DEFAULT_JOBS = [
  'portal-ingest',
  'depth-chart-refresh',
  'game-zone-refresh',
  'nil-refresh',
  'qa-crawler',
  'visit-intel-reconcile',
  'x-autoposter-run',
  'beat-late-ingest'
];

const DEFAULT_WEEKLY_JOBS = [
  { jobId: 'uf-fit-seed', options: { classYears: process.env.UF_FIT_SEED_CLASS_YEARS || '2027,2028' } },
  { jobId: 'early-discovery', options: { classYearGte: 2028 } },
  {
    jobId: 'allowlist-on3-rankings',
    options: { classYear: Number(process.env.ALLOWLIST_ON3_RANKINGS_CLASS_YEAR || 2028) },
  },
];

function defaultWeeklyOptions(jobId) {
  switch (jobId) {
    case 'uf-fit-seed':
      return { classYears: process.env.UF_FIT_SEED_CLASS_YEARS || '2027,2028' };
    case 'early-discovery':
      return { classYearGte: 2028 };
    case 'allowlist-on3-rankings':
      return { classYear: Number(process.env.ALLOWLIST_ON3_RANKINGS_CLASS_YEAR || 2028) };
    default:
      return {};
  }
}

function parseJobSpecs(raw) {
  if (!raw) return [];
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((jobId) => ({ jobId, options: defaultWeeklyOptions(jobId) }));
}

function weeklyJobSpecs() {
  const parsed = parseJobSpecs(process.env.PLATFORM_OPS_WEEKLY_JOBS);
  if (parsed.length) return parsed;
  return DEFAULT_WEEKLY_JOBS;
}

function shouldRunWeeklyFallback() {
  if (process.env.PLATFORM_OPS_SKIP_WEEKLY === 'true') return false;
  const day = new Date().getUTCDay();
  const hour = new Date().getUTCHours();
  // Sunday 18:xx UTC — after dedicated UF Fit / Early Discovery / allowlist crons.
  return day === 0 && hour === 18;
}

async function runJob(jobId, options = {}) {
  const res = await fetch(`${API_BASE}/api/ops/run-job`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'x-monitoring-cron': CRON_SECRET,
      'X-Ingest-Secret': CRON_SECRET,
      'User-Agent': 'gatorvault-platform-ops-cron/1.0'
    },
    body: JSON.stringify({ jobId, options }),
    signal: AbortSignal.timeout(600000)
  });
  let payload = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }
  if (!res.ok) {
    const err = new Error(`${jobId} HTTP ${res.status}`);
    err.payload = payload;
    throw err;
  }
  return payload;
}

async function runJobSpec(spec, summary) {
  const { jobId, options = {} } = spec;
  try {
    const result = await runJob(jobId, options);
    const failed = result?.ok === false;
    summary.jobs.push({ jobId, ok: !failed, result: result?.result || result, options });
    if (failed) summary.failures.push({ jobId, error: result?.error || 'ok:false' });
  } catch (err) {
    console.error(`[platform-ops-cron] soft failure — ${jobId}:`, err.message);
    summary.failures.push({ jobId, error: err.message });
    summary.jobs.push({ jobId, ok: false, error: err.message, options });
  }
}

async function main() {
  if (!CRON_SECRET) {
    console.error('[platform-ops-cron] MONITORING_CRON_SECRET or INGEST_CRON_SECRET is not set');
    process.exit(0);
  }

  const jobs = String(process.env.PLATFORM_OPS_JOBS || DEFAULT_JOBS.join(','))
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const summary = { jobs: [], failures: [], startedAt: new Date().toISOString() };
  summary.warm = await warmApi(API_BASE);

  for (const jobId of jobs) {
    await runJobSpec({ jobId }, summary);
  }

  if (shouldRunWeeklyFallback()) {
    summary.weeklyFallback = true;
    for (const spec of weeklyJobSpecs()) {
      await runJobSpec(spec, summary);
    }
  }

  summary.finishedAt = new Date().toISOString();
  summary.ok = summary.failures.length === 0;
  console.log('[platform-ops-cron] complete', JSON.stringify(summary));
}

main().catch((err) => {
  console.error('[platform-ops-cron] unhandled:', err.message);
}).finally(() => process.exit(0));
