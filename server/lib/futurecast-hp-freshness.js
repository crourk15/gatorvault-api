/**
 * FutureCast high-priority plate freshness — shared by health, pipeline monitor, ops tiles.
 * Keep max-age aligned with DISK-STALE rebuild gate in response-cache / high-priority GET.
 */
'use strict';

const path = require('path');
const fs = require('fs');

/** Must match HP_DISK_MAX_AGE_MS in server/api/futurecast/response-cache.ts */
const HP_DISK_MAX_AGE_MS = 36 * 60 * 60 * 1000; // 36h

const DEFAULT_YEARS = [2027, 2028];

function highPriorityRuntimeCandidates(year) {
  const { resolveRecruitingDataDir, BUNDLE_DIR } = require('./recruiting-data-dir');
  const name = `high-priority-${year}.json`;
  return [
    path.join(resolveRecruitingDataDir(), 'futurecast-runtime', name),
    path.join(BUNDLE_DIR, 'futurecast-runtime', name),
  ];
}

function readHighPriorityRuntimeRaw(year) {
  for (const filePath of highPriorityRuntimeCandidates(year)) {
    try {
      if (!fs.existsSync(filePath)) continue;
      const doc = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (doc && typeof doc === 'object') {
        return { doc, path: filePath };
      }
    } catch {
      /* try next */
    }
  }
  return null;
}

function isHpPlateFresh(payload, maxAgeMs = HP_DISK_MAX_AGE_MS) {
  if (!payload || typeof payload !== 'object') return false;
  const ts = Date.parse(String(payload.updatedAt || payload.lastUpdated || ''));
  if (!Number.isFinite(ts)) return false;
  return Date.now() - ts <= maxAgeMs;
}

/**
 * @param {number|string} year
 * @param {{ maxAgeMs?: number }} [opts]
 */
function getHighPriorityPlateFreshness(year, opts = {}) {
  const y = Number(year) || 0;
  const maxAgeMs = Number(opts.maxAgeMs) > 0 ? Number(opts.maxAgeMs) : HP_DISK_MAX_AGE_MS;
  const hit = y ? readHighPriorityRuntimeRaw(y) : null;
  const doc = hit?.doc || null;
  const updatedAt = doc
    ? String(doc.updatedAt || doc.lastUpdated || '') || null
    : null;
  const ts = updatedAt ? Date.parse(updatedAt) : NaN;
  const ageMs = Number.isFinite(ts) ? Math.max(0, Date.now() - ts) : null;
  const playerCount = Array.isArray(doc?.players) ? doc.players.length : 0;
  const missing = !doc || playerCount === 0;
  const stale = missing || ageMs == null || ageMs > maxAgeMs;
  return {
    year: y,
    updatedAt: Number.isFinite(ts) ? new Date(ts).toISOString() : updatedAt,
    ageHours: ageMs == null ? null : Math.round((ageMs / 3600000) * 10) / 10,
    ageMs,
    playerCount,
    missing,
    stale,
    maxAgeHours: Math.round(maxAgeMs / 3600000),
    path: hit?.path || null,
  };
}

/**
 * @param {number[]} [years]
 * @param {{ maxAgeMs?: number }} [opts]
 */
function getHighPriorityFreshnessReport(years = DEFAULT_YEARS, opts = {}) {
  const byYear = {};
  let anyStale = false;
  let anyMissing = false;
  for (const year of years) {
    const row = getHighPriorityPlateFreshness(year, opts);
    byYear[String(year)] = row;
    if (row.stale) anyStale = true;
    if (row.missing) anyMissing = true;
  }
  return {
    byYear,
    stale: anyStale,
    missing: anyMissing,
    maxAgeHours: Math.round((opts.maxAgeMs || HP_DISK_MAX_AGE_MS) / 3600000),
    checkedAt: new Date().toISOString(),
  };
}

/**
 * When plates are stale, schedule cooldown rebuilds (same gate as DISK-STALE GET).
 * Safe to call from monitors — does not sync-build on the request path.
 */
function scheduleStaleHighPriorityRebuilds(years = [2028], reason = 'freshness-monitor') {
  const scheduled = [];
  let scheduleFn = null;
  let buildFn = null;
  try {
    const rc = require('../api/futurecast/response-cache.ts');
    scheduleFn = rc.scheduleHighPriorityDiskRebuild;
  } catch (err) {
    console.warn(
      '[hp-freshness] schedule import failed:',
      err instanceof Error ? err.message : String(err)
    );
    return { scheduled, error: 'schedule_import_failed' };
  }
  try {
    const hp = require('../api/futurecast/high-priority.ts');
    buildFn = hp.buildHighPriorityPayload;
  } catch (err) {
    console.warn(
      '[hp-freshness] build import failed:',
      err instanceof Error ? err.message : String(err)
    );
    return { scheduled, error: 'build_import_failed' };
  }
  if (typeof scheduleFn !== 'function' || typeof buildFn !== 'function') {
    return { scheduled, error: 'schedule_unavailable' };
  }
  for (const year of years) {
    const row = getHighPriorityPlateFreshness(year);
    if (!row.stale) continue;
    try {
      scheduleFn(Number(year), () => buildFn(Number(year)));
      scheduled.push(Number(year));
      console.warn(
        `[hp-freshness] scheduled rebuild year=${year} reason=${reason} ageHours=${row.ageHours}`
      );
    } catch (err) {
      console.warn(
        `[hp-freshness] schedule year=${year} failed:`,
        err instanceof Error ? err.message : String(err)
      );
    }
  }
  return { scheduled, reason };
}

module.exports = {
  HP_DISK_MAX_AGE_MS,
  DEFAULT_YEARS,
  isHpPlateFresh,
  getHighPriorityPlateFreshness,
  getHighPriorityFreshnessReport,
  scheduleStaleHighPriorityRebuilds,
  readHighPriorityRuntimeRaw,
};
