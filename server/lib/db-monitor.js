/**
 * GV-OM database / file-store health monitor.
 */
const fs = require('fs');
const path = require('path');
const opsMonitor = require('./ops-monitor');

const DATA_ROOT = path.join(__dirname, '..', 'data');
const SLOW_MS = parseInt(process.env.OPS_DB_SLOW_MS || '500', 10);

const stats = {
  reads: 0,
  writes: 0,
  errors: [],
  slowQueries: [],
  tableSizes: {}
};

function pruneArrays() {
  if (stats.errors.length > 100) stats.errors = stats.errors.slice(-100);
  if (stats.slowQueries.length > 100) stats.slowQueries = stats.slowQueries.slice(-100);
}

function recordDbError(operation, target, error) {
  const entry = {
    at: new Date().toISOString(),
    operation,
    target: String(target || '').slice(0, 200),
    message: String(error?.message || error || '').slice(0, 400)
  };
  stats.errors.push(entry);
  pruneArrays();
  opsMonitor.logEvent({
    subsystem: 'db:health',
    status: 'error',
    message: `DB ${operation} failed: ${entry.target}`,
    details: { error: entry.message }
  });
}

function recordSlowQuery(operation, target, durationMs) {
  if (durationMs < SLOW_MS) return;
  const entry = {
    at: new Date().toISOString(),
    operation,
    target: String(target || '').slice(0, 200),
    durationMs: Math.round(durationMs)
  };
  stats.slowQueries.push(entry);
  pruneArrays();
  opsMonitor.logEvent({
    subsystem: 'db:health',
    status: 'warning',
    message: `Slow ${operation}: ${entry.target}`,
    details: { durationMs: entry.durationMs }
  });
}

function timedReadSync(filePath) {
  const start = Date.now();
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    stats.reads += 1;
    const ms = Date.now() - start;
    recordSlowQuery('read', filePath, ms);
    return data;
  } catch (err) {
    recordDbError('read', filePath, err);
    throw err;
  }
}

function timedWriteSync(filePath, data) {
  const start = Date.now();
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, data);
    stats.writes += 1;
    const ms = Date.now() - start;
    recordSlowQuery('write', filePath, ms);
  } catch (err) {
    recordDbError('write', filePath, err);
    throw err;
  }
}

function scanTableSizes() {
  const tables = [
    'recruiting/players.json',
    'recruiting/intel.json',
    'recruiting/events.json',
    'live/feed-items.json',
    'live/beat-cache.json',
    'x/autoposter-queue.json',
    'nil/nil_events.json',
    'roster/players.json',
    'film-room-knowledge/catalog.json'
  ];
  const out = {};
  for (const rel of tables) {
    const full = path.join(DATA_ROOT, rel);
    try {
      const st = fs.statSync(full);
      out[rel] = { bytes: st.size, mtime: st.mtime.toISOString() };
    } catch {
      out[rel] = { bytes: 0, mtime: null, missing: true };
    }
  }
  stats.tableSizes = out;
  return out;
}

function getDbHealthReport(config = {}) {
  const slowThreshold = config.dbSlowQueryMs ?? SLOW_MS;
  const sizes = scanTableSizes();
  const recentErrors = stats.errors.filter(
    (e) => Date.now() - new Date(e.at).getTime() < 24 * 3600000
  );
  const recentSlow = stats.slowQueries.filter(
    (e) => Date.now() - new Date(e.at).getTime() < 24 * 3600000
  );

  let status = 'green';
  if (recentErrors.length >= 5) status = 'red';
  else if (recentErrors.length > 0 || recentSlow.length >= 10) status = 'yellow';

  return {
    status,
    reads: stats.reads,
    writes: stats.writes,
    errors24h: recentErrors.length,
    slowQueries24h: recentSlow.length,
    slowThresholdMs: slowThreshold,
    lastError: stats.errors[stats.errors.length - 1] || null,
    lastSlowQuery: stats.slowQueries[stats.slowQueries.length - 1] || null,
    tableSizes: sizes
  };
}

module.exports = {
  recordDbError,
  recordSlowQuery,
  timedReadSync,
  timedWriteSync,
  scanTableSizes,
  getDbHealthReport
};
