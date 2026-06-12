/**
 * Runtime subsystem health — used by /api/health and the runtime watchdog.
 */
const manifest = require('./platform-manifest');

function statusOk(label, detail) {
  return { status: 'ok', detail: detail || null };
}

function statusDegraded(label, detail) {
  return { status: 'degraded', detail: detail || null };
}

function statusError(label, detail) {
  return { status: 'error', detail: detail || null };
}

function statusDisabled(detail) {
  return { status: 'disabled', detail: detail || null };
}

function checkDb() {
  try {
    const dbMonitor = require('../db-monitor');
    const report = dbMonitor.getDbHealthReport();
    if (report.status === 'green') return statusOk('db', { errors24h: report.errors24h });
    if (report.status === 'yellow') {
      return statusDegraded('db', { errors24h: report.errors24h, slowQueries24h: report.slowQueries24h });
    }
    return statusError('db', { errors24h: report.errors24h, lastError: report.lastError });
  } catch (err) {
    return statusError('db', err.message);
  }
}

function checkInsiderArticles() {
  try {
    const routes = require('../insider-articles-routes');
    if (typeof routes.mountInsiderArticlesRoutes !== 'function') {
      return statusError('insiderArticles', 'mountInsiderArticlesRoutes export missing');
    }
    const store = require('../insider-articles-store');
    store.listPublished();
    store.listDrafts();
    return statusOk('insiderArticles');
  } catch (err) {
    return statusError('insiderArticles', err.message);
  }
}

function checkGm2() {
  try {
    const gm2 = require('../gm2');
    const quarantine = require('../gm2/quarantine-store');
    const status = quarantine.getStatus();
    if (typeof gm2.filterPublicLiveFeed !== 'function') {
      return statusError('gm2', 'GM2 core exports missing');
    }
    return statusOk('gm2', {
      quarantinedPlayers: status?.quarantinedPlayers ?? null,
      quarantinedSignals: status?.quarantinedSignals ?? null
    });
  } catch (err) {
    return statusError('gm2', err.message);
  }
}

function checkProductIntel() {
  if (process.env.PRODUCT_INTEL_ENABLED === 'false') {
    return statusDisabled('PRODUCT_INTEL_ENABLED=false');
  }
  try {
    const store = require('../product-intel/product-intel-store');
    const doc = store.readDoc();
    if (!doc || typeof doc !== 'object') {
      return statusDegraded('productIntel', 'empty document');
    }
    return statusOk('productIntel', {
      overall: doc.scores?.overall ?? null,
      lastComputedAt: doc.lastComputedAt || null,
      fixQueueOpen: (doc.fixQueue || []).filter((f) => !f.resolved).length
    });
  } catch (err) {
    return statusError('productIntel', err.message);
  }
}

function checkSelfRunner() {
  if (process.env.SELF_RUNNER_ENABLED === 'false') {
    return statusDisabled('SELF_RUNNER_ENABLED=false');
  }
  try {
    const engine = require('../self-runner/self-runner-engine');
    const summary = engine.healthSummary();
    const fatal =
      summary.enabled &&
      summary.lastQaFailed != null &&
      summary.lastQaFailed > 0 &&
      summary.fixQueueOpen > 50;
    if (fatal) {
      return statusError('selfRunner', {
        fixQueueOpen: summary.fixQueueOpen,
        lastQaFailed: summary.lastQaFailed
      });
    }
    return statusOk('selfRunner', {
      mode: summary.mode,
      fixQueueOpen: summary.fixQueueOpen,
      eligibleOpenIssues: summary.eligibleOpenIssues
    });
  } catch (err) {
    return statusError('selfRunner', err.message);
  }
}

const CHECKERS = {
  db: checkDb,
  insiderArticles: checkInsiderArticles,
  gm2: checkGm2,
  productIntel: checkProductIntel,
  selfRunner: checkSelfRunner
};

function checkAllSystems() {
  const systems = {};
  const details = {};
  for (const id of manifest.RUNTIME_SYSTEMS) {
    const result = CHECKERS[id]();
    systems[id] = result.status;
    if (result.detail) details[id] = result.detail;
  }
  const critical = ['db', 'insiderArticles', 'gm2'];
  const ok = critical.every((id) => systems[id] === 'ok' || systems[id] === 'degraded');
  const hardFail = critical.some((id) => systems[id] === 'error');
  return { ok: ok && !hardFail, systems, details, checkedAt: new Date().toISOString() };
}

module.exports = {
  checkAllSystems,
  checkDb,
  checkInsiderArticles,
  checkGm2,
  checkProductIntel,
  checkSelfRunner
};
