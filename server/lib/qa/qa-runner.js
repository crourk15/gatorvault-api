/**
 * QA Crawler orchestrator — 3-phase crawl: Fetch → Analyze → Emit.
 */
const config = require('./qa-config');
const qaStore = require('./qa-store');
const qaAlerts = require('./qa-alerts');
const { runCrawlerPhases } = require('./qa-crawler-phases');

let running = false;
let lastPass = true;

async function runQaCrawl(opts = {}) {
  if (running && !opts.force) {
    return { ok: false, skipped: true, reason: 'qa_crawl_in_progress' };
  }
  running = true;
  const startedAt = new Date().toISOString();
  const t0 = Date.now();
  const id = `qa_${Date.now()}`;

  try {
    const crawl = await runCrawlerPhases(opts);
    const { modules, errors, issues, screenshot, phases, allChecks, failed } = crawl;

    const run = {
      id,
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - t0,
      pass: failed.length === 0,
      modules,
      errors,
      issues,
      phases,
      screenshot,
      summary: {
        total: allChecks.length,
        passed: allChecks.length - failed.length,
        failed: failed.length,
        emitted: issues.length
      }
    };

    qaStore.recordRun(run);

    try {
      const productIntel = require('../product-intel/product-intel-engine');
      await productIntel.recomputeFromRun(run, { daily: true, weekly: false });
    } catch (piErr) {
      console.warn('[product-intel] recompute skipped:', piErr.message);
    }

    try {
      if (process.env.SELF_RUNNER_ENABLED !== 'false') {
        const selfRunner = require('../self-runner/self-runner-engine');
        const gen = await selfRunner.generateProposalsFromProductIntel();
        if (gen.created?.length) {
          console.log('[self-runner] generated', gen.created.length, 'pending fix proposal(s)');
        }
      }
    } catch (srErr) {
      console.warn('[self-runner] proposal generation skipped:', srErr.message);
    }

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
    'min | 3-phase: fetch→analyze→emit | browser:',
    config.BROWSER_ENABLED ? 'on' : 'off (set QA_BROWSER_ENABLED=true + install playwright)',
    '| mobile-behavior:',
    config.MOBILE_BEHAVIOR_ENABLED ? 'on' : 'off'
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
  startQaScheduler,
  runCrawlerPhases: require('./qa-crawler-phases').runCrawlerPhases
};
