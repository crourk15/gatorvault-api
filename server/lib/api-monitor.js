/**
 * GV-OM API request monitor — latency, error rate, uptime.
 */
const opsMonitor = require('./ops-monitor');

const WINDOW_MS = 24 * 3600000;
const MAX_SAMPLES = 5000;

const stats = {
  startedAt: new Date().toISOString(),
  requests: [],
  lastError: null,
  last5xx: null
};

function prune() {
  const cutoff = Date.now() - WINDOW_MS;
  stats.requests = stats.requests.filter((r) => r.at >= cutoff);
  if (stats.requests.length > MAX_SAMPLES) {
    stats.requests = stats.requests.slice(-MAX_SAMPLES);
  }
}

function recordRequest({ method, path, statusCode, durationMs, error = null }) {
  prune();
  const entry = {
    at: Date.now(),
    method,
    path: String(path || '').slice(0, 200),
    statusCode,
    durationMs: Math.round(durationMs)
  };
  stats.requests.push(entry);

  if (statusCode >= 400 || error) {
    stats.lastError = {
      at: new Date().toISOString(),
      method,
      path: entry.path,
      statusCode,
      error: error ? String(error).slice(0, 300) : null
    };
    if (statusCode >= 500) stats.last5xx = stats.lastError;

    if (statusCode >= 500) {
      opsMonitor.logEvent({
        subsystem: 'api:health',
        status: 'error',
        message: `${method} ${entry.path} → ${statusCode}`,
        details: { durationMs: entry.durationMs, error: stats.lastError.error }
      });
    }
  }

  if (durationMs >= 2000) {
    opsMonitor.logEvent({
      subsystem: 'api:health',
      status: 'warning',
      message: `Slow request ${method} ${entry.path}`,
      details: { durationMs: entry.durationMs, statusCode }
    });
  }
}

function getApiHealthReport(config = {}) {
  prune();
  const reqs = stats.requests;
  const total = reqs.length;
  const errors4xx = reqs.filter((r) => r.statusCode >= 400 && r.statusCode < 500).length;
  const errors5xx = reqs.filter((r) => r.statusCode >= 500).length;
  const errorCount = errors4xx + errors5xx;
  const errorRate = total ? errorCount / total : 0;
  const avgMs = total ? Math.round(reqs.reduce((s, r) => s + r.durationMs, 0) / total) : 0;
  const p95Ms = total
    ? reqs
        .map((r) => r.durationMs)
        .sort((a, b) => a - b)[Math.floor(total * 0.95)] || avgMs
    : 0;

  const warnRate = config.apiErrorRateWarning ?? 0.05;
  const critRate = config.apiErrorRateCritical ?? 0.15;
  const warnMs = config.apiLatencyWarningMs ?? 800;
  const critMs = config.apiLatencyCriticalMs ?? 2000;

  let status = 'green';
  if (errorRate >= critRate || avgMs >= critMs || errors5xx > 10) status = 'red';
  else if (errorRate >= warnRate || avgMs >= warnMs || errors5xx > 0) status = 'yellow';

  return {
    status,
    uptimeSince: stats.startedAt,
    windowHours: 24,
    totalRequests: total,
    errors4xx,
    errors5xx,
    errorRate: Math.round(errorRate * 1000) / 1000,
    avgResponseMs: avgMs,
    p95ResponseMs: p95Ms,
    lastError: stats.lastError,
    last5xx: stats.last5xx
  };
}

function apiMonitorMiddleware() {
  return (req, res, next) => {
    const start = Date.now();
    const pathOnly = req.originalUrl?.split('?')[0] || req.url;
    if (pathOnly.startsWith('/api/ops/') && !pathOnly.includes('/ping')) {
      /* avoid noise from ops dashboard polling */
    }
    res.on('finish', () => {
      recordRequest({
        method: req.method,
        path: pathOnly,
        statusCode: res.statusCode,
        durationMs: Date.now() - start
      });
    });
    next();
  };
}

module.exports = {
  recordRequest,
  getApiHealthReport,
  apiMonitorMiddleware
};
