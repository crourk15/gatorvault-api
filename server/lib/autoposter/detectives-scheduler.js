/** Background Detectives tick — investigates pile without blocking HTTP or autoposter cron. */
const detectives = require('./detectives');

let tickLock = false;

async function runDetectivesBackgroundTick(limit = 1) {
  if (tickLock || !detectives.detectivesEnabled()) {
    return { skipped: true, reason: tickLock ? 'busy' : 'disabled' };
  }
  tickLock = true;
  try {
    try { require('./detectives-store').recoverStaleInvestigatingCases(); } catch {}
    const result = await detectives.processDetectivesPile({ limit });
    try {
      require('../ops-monitor').logEvent({
        subsystem: 'autoposter:detectives',
        status: 'success',
        message: 'detectives:background_tick',
        details: {
          processed: result.processed,
          counts: result.counts,
          results: (result.results || []).slice(0, 3).map((r) => ({
            caseId: r.caseId,
            queued: !!r.queued,
            reason: r.reason || null,
            path: r.path || null
          }))
        }
      });
    } catch {
      /* optional */
    }
    return result;
  } catch (err) {
    try {
      require('../ops-monitor').logEvent({
        subsystem: 'autoposter:detectives',
        status: 'error',
        message: 'detectives:background_tick_failed',
        details: { error: err.message }
      });
    } catch {
      /* optional */
    }
    return { ok: false, error: err.message };
  } finally {
    tickLock = false;
  }
}

function startDetectivesScheduler() {
  if (process.env.X_AUTOPOST_DETECTIVES_SCHEDULER === 'false') return;
  const intervalMs = parseInt(process.env.X_AUTOPOST_DETECTIVES_INTERVAL_MS || '90000', 10);
  const bootDelay = parseInt(process.env.X_AUTOPOST_DETECTIVES_BOOT_DELAY_MS || '20000', 10);
  const limit = parseInt(process.env.X_AUTOPOST_DETECTIVES_TICK_LIMIT || '1', 10);
  setTimeout(() => {
    (async () => {
      try {
        const backfill = require('./detectives-backfill');
        if (backfill.pileNeedsBackfill()) {
          await backfill.backfillDetectivesPile({ limit: 80 });
        }
      } catch {
        /* optional */
      }
      await runDetectivesBackgroundTick(limit);
    })().catch(() => {});
    setInterval(() => runDetectivesBackgroundTick(limit).catch(() => {}), intervalMs);
  }, bootDelay);
}

module.exports = { runDetectivesBackgroundTick, startDetectivesScheduler };