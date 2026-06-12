/**
 * Runtime watchdog — periodic internal health checks while the API is running.
 */
const systemHealth = require('./system-health');
const { alertGuardian } = require('./guardian-alerts');
const { attemptAutoRollback } = require('./auto-rollback');

const INTERVAL_MS = parseInt(process.env.GUARDIAN_WATCHDOG_INTERVAL_MS || '30000', 10);
const FAIL_THRESHOLD = parseInt(process.env.GUARDIAN_FAIL_THRESHOLD || '3', 10);
const RESTART_ON_FAIL = process.env.GUARDIAN_RESTART_ON_FAIL !== 'false';

let timer = null;
let consecutiveFails = 0;
let lastOk = true;

async function onHealthDegraded(health) {
  const failed = Object.entries(health.systems)
    .filter(([, v]) => v === 'error')
    .map(([k]) => k);
  const message = `Systems degraded: ${failed.join(', ') || 'unknown'}`;
  console.warn('[guardian] watchdog:', message, health.details);

  await alertGuardian({
    type: 'runtime_health_degraded',
    severity: 'warning',
    title: 'Runtime health degraded',
    message,
    dedupeKey: `guardian:watchdog:${failed.join(',')}`,
    meta: { systems: health.systems, details: health.details },
    notify: consecutiveFails >= FAIL_THRESHOLD
  });
}

async function onHealthCritical(health) {
  consecutiveFails += 1;
  const message = `Critical health failure (${consecutiveFails}/${FAIL_THRESHOLD}): ${JSON.stringify(health.systems)}`;
  console.error('[guardian] watchdog:', message);

  if (consecutiveFails >= FAIL_THRESHOLD) {
    await alertGuardian({
      type: 'runtime_health_critical',
      severity: 'critical',
      title: 'Platform health critical',
      message,
      dedupeKey: 'guardian:watchdog:critical',
      meta: { systems: health.systems, consecutiveFails }
    });

    if (process.env.GUARDIAN_AUTO_ROLLBACK === 'true') {
      await attemptAutoRollback(message);
    } else if (RESTART_ON_FAIL) {
      console.error('[guardian] triggering graceful restart in 2s');
      setTimeout(() => process.exit(1), 2000);
    }
  }
}

async function tick() {
  try {
    const health = systemHealth.checkAllSystems();
    if (health.ok) {
      if (!lastOk) console.log('[guardian] watchdog: systems recovered');
      consecutiveFails = 0;
      lastOk = true;
      return;
    }
    lastOk = false;
    const hasError = Object.values(health.systems).includes('error');
    if (hasError) await onHealthCritical(health);
    else await onHealthDegraded(health);
  } catch (err) {
    console.error('[guardian] watchdog tick failed:', err.message);
  }
}

function startRuntimeWatchdog() {
  if (process.env.GUARDIAN_WATCHDOG_ENABLED === 'false') {
    console.log('[guardian] runtime watchdog disabled');
    return null;
  }
  if (timer) return timer;
  console.log('[guardian] runtime watchdog started (every', INTERVAL_MS / 1000, 's)');
  timer = setInterval(tick, INTERVAL_MS);
  if (typeof timer.unref === 'function') timer.unref();
  return timer;
}

function stopRuntimeWatchdog() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = { startRuntimeWatchdog, stopRuntimeWatchdog, tick };
