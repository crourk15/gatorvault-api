/**
 * Product Intelligence — daily (midnight UTC) and weekly (Sunday 01:00 UTC) jobs.
 */
const engine = require('./product-intel-engine');

let lastDailyKey = '';
let lastWeeklyKey = '';

async function startProductIntelScheduler() {
  if (process.env.PRODUCT_INTEL_ENABLED === 'false') {
    console.log('[product-intel] scheduler disabled (PRODUCT_INTEL_ENABLED=false)');
    return;
  }

  const bootDelay = Math.max(30000, parseInt(process.env.PRODUCT_INTEL_BOOT_DELAY_MS || '90000', 10) || 90000);

  setTimeout(async () => {
    try {
      const result = await engine.recomputeFromLatestRun({ daily: true, weekly: false });
      if (result.ok) {
        console.log('[product-intel] boot recompute — overall', result.scores?.overall);
      }
    } catch (err) {
      console.warn('[product-intel] boot recompute skipped:', err.message);
    }
    try {
      if (process.env.SELF_RUNNER_ENABLED !== 'false') {
        const selfRunner = require('../self-runner/self-runner-engine');
        const gen = selfRunner.generateProposalsFromProductIntel();
        if (gen.created?.length) {
          console.log('[self-runner] boot — generated', gen.created.length, 'proposal(s)');
        }
      }
    } catch (err) {
      console.warn('[self-runner] boot generate skipped:', err.message);
    }
  }, bootDelay);

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
  console.log('[product-intel] scheduler enabled — daily 00:00 UTC, weekly Sun 01:00 UTC');
}

module.exports = { startProductIntelScheduler };
