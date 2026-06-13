/**
 * Product Intelligence — boot recompute, QA-sync interval, daily/weekly jobs.
 */
const qaStore = require('../qa/qa-store');
const store = require('./product-intel-store');
const engine = require('./product-intel-engine');

let lastDailyKey = '';
let lastWeeklyKey = '';
let syncInFlight = false;

function recomputeIntervalMs() {
  return Math.max(60000, parseInt(process.env.PRODUCT_INTEL_RECOMPUTE_INTERVAL_MS || '300000', 10) || 300000);
}

/**
 * Recompute when the latest QA run is newer than the last product-intel snapshot.
 */
async function syncIfStale(opts = {}) {
  if (syncInFlight) return { skipped: true, reason: 'sync_in_progress' };
  syncInFlight = true;
  try {
    const qaDoc = qaStore.readDoc();
    const lastRun = (qaDoc.runs || [])[0];
    if (!lastRun?.finishedAt) {
      return { skipped: true, reason: 'no_qa_runs' };
    }

    const doc = store.readDoc();
    const computedAt = doc.lastComputedAt ? new Date(doc.lastComputedAt).getTime() : 0;
    const runAt = new Date(lastRun.finishedAt).getTime();
    if (!opts.force && runAt <= computedAt) {
      return { skipped: true, reason: 'already_fresh', lastComputedAt: doc.lastComputedAt };
    }

    console.log('[product-intel] recomputing from QA run', lastRun.id, '(pass:', lastRun.pass + ')');
    const result = await engine.recomputeFromRun(lastRun, {
      daily: opts.daily !== false,
      weekly: opts.weekly === true
    });
    return { ok: true, runId: lastRun.id, overall: result.scores?.overall };
  } finally {
    syncInFlight = false;
  }
}

async function startProductIntelScheduler() {
  if (process.env.PRODUCT_INTEL_ENABLED === 'false') {
    console.log('[product-intel] scheduler disabled (PRODUCT_INTEL_ENABLED=false)');
    return;
  }

  const bootDelay = Math.max(30000, parseInt(process.env.PRODUCT_INTEL_BOOT_DELAY_MS || '90000', 10) || 90000);
  const syncMs = recomputeIntervalMs();

  setTimeout(async () => {
    try {
      const result = await syncIfStale({ force: true, daily: true, weekly: false });
      if (result.ok) {
        console.log('[product-intel] boot recompute — overall', result.overall);
      } else if (result.reason === 'no_qa_runs') {
        const fallback = await engine.recomputeFromLatestRun({ daily: true, weekly: false });
        if (fallback.ok) {
          console.log('[product-intel] boot recompute (fallback) — overall', fallback.scores?.overall);
        }
      }
    } catch (err) {
      console.warn('[product-intel] boot recompute skipped:', err.message);
    }
    try {
      if (process.env.SELF_RUNNER_ENABLED !== 'false') {
        const selfRunner = require('../self-runner/self-runner-engine');
        const gen = await selfRunner.generateProposalsFromProductIntel();
        if (gen.created?.length) {
          console.log('[self-runner] boot — generated', gen.created.length, 'proposal(s)');
        }
      }
    } catch (err) {
      console.warn('[self-runner] boot generate skipped:', err.message);
    }
  }, bootDelay);

  setInterval(() => {
    syncIfStale({ daily: true, weekly: false }).catch((err) => {
      console.warn('[product-intel] sync tick failed:', err.message);
    });
  }, syncMs);

  const tick = async () => {
    const now = new Date();
    const dayKey = now.toISOString().slice(0, 10);
    const weekKey = `${dayKey}-w${now.getUTCDay()}`;

    if (now.getUTCHours() === 0 && lastDailyKey !== dayKey) {
      lastDailyKey = dayKey;
      try {
        await engine.runDailyJob();
      } catch (err) {
        console.warn('[product-intel] daily job failed:', err.message);
      }
    }

    if (now.getUTCDay() === 0 && now.getUTCHours() === 1 && lastWeeklyKey !== weekKey) {
      lastWeeklyKey = weekKey;
      try {
        await engine.runWeeklyJob();
      } catch (err) {
        console.warn('[product-intel] weekly job failed:', err.message);
      }
    }
  };

  setInterval(() => {
    tick().catch((err) => console.warn('[product-intel] scheduler tick failed:', err.message));
  }, 15 * 60 * 1000);

  console.log(
    '[product-intel] scheduler enabled — QA sync every',
    Math.round(syncMs / 60000),
    'min, daily 00:00 UTC, weekly Sun 01:00 UTC'
  );
}

module.exports = { startProductIntelScheduler, syncIfStale };
