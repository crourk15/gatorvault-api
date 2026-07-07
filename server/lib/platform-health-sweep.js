/**
 * Platform health sweep — detects stale ops tiles and re-runs the matching refresh jobs.
 * Keeps Recruiting Board, NIL, Game Zone, Depth Chart, and related data green without manual clicks.
 */
const opsMonitor = require('./ops-monitor');
const opsJobs = require('./ops-jobs');

const SWEEP_SUBSYSTEM = 'ops:platform-sweep';

/** Tile id -> job ids to run when that tile is yellow/red. */
const TILE_JOB_MAP = {
  'recruiting-board': ['recruiting-ingest'],
  'portal-tracker': ['portal-ingest'],
  'nil-tracker': ['nil-refresh'],
  'film-room': ['film-room-weekly'],
  'depth-gamezone': ['depth-chart-refresh', 'game-zone-refresh']
};

function envEnabled(name) {
  const v = process.env[name];
  if (v == null || v === '') return true;
  return v === 'true' || v === '1';
}

function pickStaleTiles(report) {
  const tiles = report?.tiles || [];
  const stale = [];
  for (const t of tiles) {
    if (!TILE_JOB_MAP[t.id]) continue;
    if (t.status === 'yellow' || t.status === 'red') stale.push(t);
  }
  return stale;
}

function jobsForTile(tile) {
  const all = TILE_JOB_MAP[tile.id] || [];
  if (tile.id !== 'depth-gamezone') return all;

  const jobs = [];
  if (envEnabled('DEPTH_CHART_ENABLED')) jobs.push('depth-chart-refresh');
  if (envEnabled('GAME_ZONE_ENABLED')) jobs.push('game-zone-refresh');
  return jobs.length ? jobs : all;
}

async function runJob(jobId) {
  const { JOBS, resolveJobId } = opsJobs;
  const resolvedId = resolveJobId(jobId);
  const job = JOBS[resolvedId];
  if (!job?.run) return { jobId, ok: false, error: 'unknown_job' };
  try {
    const result = await opsMonitor.wrapJob(jobId, job.subsystem, () => job.run({ sweep: true }));
    return { jobId, ok: result?.ok !== false && result?.skipped !== true, result };
  } catch (err) {
    return { jobId, ok: false, error: err.message };
  }
}

async function runPlatformHealthSweep({ force = false } = {}) {
  const { buildOpsStatusReport } = require('./ops-status');
  const before = await buildOpsStatusReport();
  const staleTiles = pickStaleTiles(before);

  if (!staleTiles.length && !force) {
    return {
      ok: true,
      skipped: true,
      reason: 'all_green',
      overall: before.overall,
      healed: []
    };
  }

  const planned = [];
  const seen = new Set();
  for (const tile of staleTiles) {
    for (const jobId of jobsForTile(tile)) {
      if (seen.has(jobId)) continue;
      seen.add(jobId);
      planned.push({ tileId: tile.id, jobId, tileStatus: tile.status });
    }
  }

  const healed = [];
  for (const entry of planned) {
    const outcome = await runJob(entry.jobId);
    healed.push({ ...entry, ...outcome });
  }

  const after = await buildOpsStatusReport();
  const stillStale = pickStaleTiles(after).map((t) => ({ id: t.id, status: t.status }));

  const summary = {
    ok: stillStale.length === 0,
    overallBefore: before.overall,
    overallAfter: after.overall,
    staleBefore: staleTiles.map((t) => ({ id: t.id, status: t.status })),
    stillStale,
    healed
  };

  opsMonitor.logEvent({
    subsystem: SWEEP_SUBSYSTEM,
    status: summary.ok ? 'success' : stillStale.some((t) => t.status === 'red') ? 'error' : 'warning',
    message: summary.ok
      ? `Sweep healed ${healed.length} job(s) — all tiles green`
      : `Sweep ran ${healed.length} job(s) — ${stillStale.length} tile(s) still stale`,
    details: summary
  });

  return summary;
}

function startPlatformHealthSweepScheduler() {
  const pipelineGuards = require('./pipeline-guards');
  if (!pipelineGuards.guardScheduledJobStart('platform-health-sweep')) return null;

  const intervalMs = parseInt(process.env.PLATFORM_HEALTH_SWEEP_INTERVAL_MS || '21600000', 10);
  const bootDelayMs = parseInt(process.env.PLATFORM_HEALTH_SWEEP_BOOT_DELAY_MS || '300000', 10);

  const tick = () => {
    runPlatformHealthSweep()
      .then((r) => {
        if (!r.skipped) {
          console.log(
            '[platform-sweep]',
            r.overallBefore,
            '->',
            r.overallAfter,
            `(${r.healed?.length || 0} jobs)`
          );
        }
      })
      .catch((err) => console.warn('[platform-sweep] failed:', err.message));
  };

  const boot = setTimeout(tick, bootDelayMs);
  const interval = setInterval(tick, intervalMs);
  console.log(`[platform-sweep] every ${Math.round(intervalMs / 3600000)}h (boot in ${Math.round(bootDelayMs / 60000)}m)`);
  return { boot, interval };
}

module.exports = {
  runPlatformHealthSweep,
  startPlatformHealthSweepScheduler,
  TILE_JOB_MAP,
  SWEEP_SUBSYSTEM
};
