/**
 * QA Crawler orchestrator — runs all modules every 5 minutes.
 */
const config = require('./qa-config');
const qaStore = require('./qa-store');
const qaAlerts = require('./qa-alerts');
const { runApiChecks } = require('./qa-api-checks');
const { runContentChecks } = require('./qa-content-checks');
const { runIntegrityChecks } = require('./qa-integrity-checks');
const { runPageChecks } = require('./qa-page-checks');
const { runUxChecks } = require('./qa-ux-checks');
const { runBrowserChecks } = require('./qa-browser-checks');

let running = false;
let lastPass = true;

function flattenErrors(modules) {
  const errors = [];
  Object.values(modules || {}).forEach((mod) => {
    (mod.checks || []).forEach((c) => {
      if (!c.pass) {
        errors.push({
          id: c.id,
          module: c.module,
          message: c.error || c.label,
          url: c.url || null,
          repro: c.repro || `QA check failed: ${c.label}`,
          details: c.details || null,
          screenshot: c.details?.screenshot || null
        });
      }
    });
  });
  return errors;
}

async function runQaCrawl(opts = {}) {
  if (running && !opts.force) {
    return { ok: false, skipped: true, reason: 'qa_crawl_in_progress' };
  }
  running = true;
  const startedAt = new Date().toISOString();
  const t0 = Date.now();
  const id = `qa_${Date.now()}`;

  try {
    const [api, content, integrity, pages, ux, browser] = await Promise.all([
      runApiChecks(),
      runContentChecks(),
      runIntegrityChecks(),
      runPageChecks(),
      runUxChecks(),
      runBrowserChecks()
    ]);

    const modules = { api, content, integrity, pages, ux, browser };
    const allChecks = Object.values(modules).flatMap((m) => m.checks || []);
    const failed = allChecks.filter((c) => !c.pass);
    const errors = flattenErrors(modules);
    const screenshot =
      browser.checks?.find((c) => c.details?.screenshot)?.details?.screenshot || null;

    const run = {
      id,
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - t0,
      pass: failed.length === 0,
      modules,
      errors,
      screenshot,
      summary: {
        total: allChecks.length,
        passed: allChecks.length - failed.length,
        failed: failed.length
      }
    };

    qaStore.recordRun(run);

    const opsMonitor = require('../ops-monitor');
    opsMonitor.heartbeat('qa:crawler', run.pass ? 'success' : 'error', {
      message: run.pass ? 'QA crawl passed' : `${failed.length} QA failure(s)`,
      counts: run.summary
    });
    opsMonitor.logEvent({
      subsystem: 'qa:crawler',
      status: run.pass ? 'success' : 'error',
      message: run.pass ? `QA crawl passed (${run.summary.total} checks)` : `QA crawl failed (${failed.length})`,
      details: { runId: id, summary: run.summary, errors: errors.slice(0, 5) }
    });

    if (!run.pass && config.ALERT_ON_FAIL) {
      await qaAlerts.sendQaFailureAlert(run);
      lastPass = false;
    } else if (run.pass && !lastPass) {
      await qaAlerts.sendQaRecoveryAlert(run);
      lastPass = true;
    } else if (run.pass) {
      lastPass = true;
    }

    return { ok: run.pass, run };
  } catch (err) {
    const opsMonitor = require('../ops-monitor');
    opsMonitor.logEvent({
      subsystem: 'qa:crawler',
      status: 'error',
      message: 'QA crawl crashed',
      details: { error: err.message }
    });
    throw err;
  } finally {
    running = false;
  }
}

function startQaScheduler() {
  if (!config.ENABLED) {
    console.log('[qa] crawler disabled (QA_CRAWLER_ENABLED=false)');
    return null;
  }
  console.log(
    '[qa] crawler enabled — every',
    Math.round(config.INTERVAL_MS / 60000),
    'min | browser:',
    config.BROWSER_ENABLED ? 'on' : 'off (set QA_BROWSER_ENABLED=true + install playwright)'
  );

  const tick = () => {
    runQaCrawl().catch((err) => console.warn('[qa] crawl failed:', err.message));
  };

  const bootTimer = setTimeout(tick, config.BOOT_DELAY_MS);
  const interval = setInterval(tick, config.INTERVAL_MS);
  return { bootTimer, interval };
}

module.exports = {
  runQaCrawl,
  startQaScheduler
};
