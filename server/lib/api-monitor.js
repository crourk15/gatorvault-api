/**
 * GV-OM API request monitor — latency, error rate, uptime.
 */
const opsMonitor = require('./ops-monitor');

const WINDOW_MS = 24 * 3600000;
const MAX_SAMPLES = 5000;
const NOISE_PATH_PREFIXES = [
  '/api/ops/',
  '/health',
  '/favicon.ico',
  '/robots.txt',
  '/.well-known/'
];
/** Expected client/auth misses — should not drive API Health tile to red. */
const BENIGN_CLIENT_STATUSES = new Set([401, 403, 404, 405, 429]);

function shouldMonitorPath(pathOnly) {
  const path = String(pathOnly || '').split('?')[0];
  return !NOISE_PATH_PREFIXES.some((prefix) => path === prefix || path.startsWith(prefix));
}

function isBenignClientStatus(statusCode) {
  return BENIGN_CLIENT_STATUSES.has(statusCode);
}

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
  }

  if (statusCode >= 500) {
    opsMonitor.logEvent({
      subsystem: 'api:health',
      status: 'error',
      message: `${method} ${entry.path} → ${statusCode}`,
      details: { durationMs: entry.durationMs, error: stats.lastError?.error || null }
    });
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
  const benign4xx = reqs.filter((r) => isBenignClientStatus(r.statusCode)).length;
  const actionable4xx = Math.max(0, errors4xx - benign4xx);
  const actionableErrors = actionable4xx + errors5xx;
  const errorRate = total ? actionableErrors / total : 0;
  const serverErrorRate = total ? errors5xx / total : 0;
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
  if (serverErrorRate >= critRate || avgMs >= critMs || errors5xx > 10) status = 'red';
  else if (serverErrorRate > 0 || errorRate >= warnRate || avgMs >= warnMs) status = 'yellow';

  return {
    status,
    uptimeSince: stats.startedAt,
    windowHours: 24,
    totalRequests: total,
    errors4xx,
    errors5xx,
    benign4xx,
    actionable4xx,
    errorRate: Math.round(errorRate * 1000) / 1000,
    serverErrorRate: Math.round(serverErrorRate * 1000) / 1000,
    avgResponseMs: avgMs,
    p95ResponseMs: p95Ms,
    lastError: stats.lastError,
    last5xx: stats.last5xx
  };
}

function apiMonitorMiddleware() {
  return (req, res, next) => {
    const pathOnly = req.originalUrl?.split('?')[0] || req.url;
    if (!shouldMonitorPath(pathOnly)) return next();

    const start = Date.now();
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
  apiMonitorMiddleware,
  shouldMonitorPath,
  isBenignClientStatus
};
