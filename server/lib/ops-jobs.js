/**
 * GV-OM job registry — manual re-run + cron metadata.
 */
const opsMonitor = require('./ops-monitor');

/** Alternate keys accepted by POST /api/ops/run-job */
const JOB_ALIASES = {
  depth_chart_refresh: 'depth-chart-refresh',
  game_zone_lines: 'game-zone-refresh'
};

const JOBS = {
  'film-room-weekly': {
    label: 'Film Room catalog refresh',
    subsystem: 'cron:film-room-weekly',
    schedule: 'Every 6h (FILM_ROOM_SYNC_ENABLED)',
    async run() {
      const { rebuildFilmRoomCatalog } = require('./film-room-feed');
      const c = rebuildFilmRoomCatalog();
      return { ok: true, count: c?.counts, processedCount: c?.counts?.total || null };
    }
  },
  'recruiting-ingest': {
    label: 'Recruiting ingest (On3)',
    subsystem: 'cron:recruiting-ingest',
    schedule: 'Every 2m (ON3_INGEST_ENABLED)',
    async run(opts = {}) {
      const { runOn3Ingest } = require('./on3-ingest');
      return runOn3Ingest(opts);
    }
  },
  'portal-ingest': {
    label: 'Portal sync (On3)',
    subsystem: 'cron:portal-ingest',
    schedule: 'Boot + manual',
    async run(opts = {}) {
      const { syncPortalFromOn3 } = require('./on3-ingest');
      return syncPortalFromOn3({ force: true, ...opts });
    }
  },
  'nil-refresh': {
    label: 'NIL dashboard refresh',
    subsystem: 'cron:nil-ingest',
    schedule: 'Static seed + manual',
    async run() {
      const nilStore = require('./nil-store');
      const dash = nilStore.buildDashboard();
      return { ok: true, processedCount: dash?.secRankings?.length || 0, dashboard: { updatedAt: dash.updatedAt } };
    }
  },
  'live-refresh': {
    label: 'Live dashboard refresh',
    subsystem: 'cron:live-refresh',
    schedule: 'Every 3m',
    async run() {
      const { refreshLiveDashboard } = require('./live-aggregator');
      return refreshLiveDashboard();
    }
  },
  'beat-writer-ingest': {
    label: 'Beat writer visit ingest',
    subsystem: 'autoposter:beat-writer',
    schedule: 'With live refresh',
    async run(opts = {}) {
      const { runBeatWriterIngest } = require('./beat-writer-ingest');
      return runBeatWriterIngest(opts);
    }
  },
  'beat-visit-ingest': {
    label: 'Beat visit cancel ingest',
    subsystem: 'cron:beat-visit-ingest',
    schedule: 'With live refresh',
    async run(opts = {}) {
      const { runBeatVisitIntelIngest } = require('./beat-visit-intel-ingest');
      return runBeatVisitIntelIngest(opts);
    }
  },
  'rivals-pm-ingest': {
    label: 'Rivals PM ingest',
    subsystem: 'cron:rivals-pm-ingest',
    schedule: 'Every 5m (RIVALS_PM_INGEST_ENABLED)',
    async run() {
      const { runRivalsPredictionIngest } = require('./rivals-prediction-ingest');
      return runRivalsPredictionIngest();
    }
  },
  'media-ingest': {
    label: 'Media ingest',
    subsystem: 'cron:media-ingest',
    schedule: 'Every 15m (MEDIA_INGEST_ENABLED)',
    async run() {
      const { runMediaIngest } = require('./media-ingest');
      return runMediaIngest();
    }
  },
  'x-autoposter-run': {
    label: 'X autoposter queue processor',
    subsystem: 'autoposter:queue',
    schedule: 'Every 60s (X_AUTOPOST_ENABLED)',
    async run() {
      const autoposter = require('./x-autoposter');
      if (typeof autoposter.processDuePosts === 'function') {
        return autoposter.processDuePosts();
      }
      const store = require('./x-autoposter-store');
      return { ok: true, queue: store.loadQueue().items?.length || 0 };
    }
  },
  'depth-chart-refresh': {
    label: 'Depth chart / roster refresh',
    subsystem: 'cron:depth-chart',
    schedule: 'Manual (DEPTH_CHART_ENABLED)',
    async run() {
      const { refreshDepthChart } = require('./depth-chart-jobs');
      return refreshDepthChart();
    }
  },
  'game-zone-refresh': {
    label: 'Game Zone lines refresh',
    subsystem: 'cron:game-zone',
    schedule: 'Manual (GAME_ZONE_ENABLED)',
    async run() {
      const { refreshLines } = require('./betting-lines');
      return refreshLines();
    }
  },
  'ops-healthcheck': {
    label: 'Full ops health evaluation',
    subsystem: 'ops:healthcheck',
    schedule: 'Manual / cron',
    async run() {
      const { buildOpsStatusReport } = require('./ops-status');
      const report = await buildOpsStatusReport({ evaluateAlerts: true });
      return { ok: report.healthy !== false, report };
    }
  }
};

function resolveJobId(jobId) {
  if (!jobId) return jobId;
  return JOB_ALIASES[jobId] || jobId;
}

function listJobs() {
  return Object.entries(JOBS).map(([id, job]) => ({
    id,
    label: job.label,
    subsystem: job.subsystem,
    schedule: job.schedule,
    aliases: Object.entries(JOB_ALIASES)
      .filter(([, canonical]) => canonical === id)
      .map(([alias]) => alias)
  }));
}

async function runJob(jobId, opts = {}) {
  const resolvedId = resolveJobId(jobId);
  opsMonitor.logEvent({
    subsystem: 'ops:run-job',
    status: 'started',
    message: `Job received: ${jobId}`,
    details: { jobId, resolvedId: resolvedId !== jobId ? resolvedId : undefined }
  });

  const job = JOBS[resolvedId];
  if (!job) {
    opsMonitor.logEvent({
      subsystem: 'ops:run-job',
      status: 'error',
      message: `Job failed: ${jobId}`,
      details: { jobId, resolvedId, reason: 'UNKNOWN_JOB' }
    });
    const err = new Error(`Unknown job: ${jobId}`);
    err.code = 'UNKNOWN_JOB';
    throw err;
  }

  opsMonitor.logEvent({
    subsystem: 'ops:run-job',
    status: 'started',
    message: `Job started: ${resolvedId}`,
    details: { jobId, resolvedId, label: job.label }
  });

  try {
    const result = await opsMonitor.wrapJob(resolvedId, job.subsystem, () => job.run(opts), {
      message: `${job.label} manual run`
    });

    const failed = result && result.ok === false && !result.skipped;
    opsMonitor.logEvent({
      subsystem: 'ops:run-job',
      status: failed ? 'error' : 'success',
      message: failed ? `Job failed: ${resolvedId}` : `Job completed: ${resolvedId}`,
      details: {
        jobId,
        resolvedId,
        result: result && typeof result === 'object' ? { ok: result.ok, skipped: result.skipped, reason: result.reason, updatedAt: result.updatedAt, processedCount: result.processedCount } : result
      }
    });

    return { jobId: resolvedId, requestedId: jobId, result };
  } catch (err) {
    opsMonitor.logEvent({
      subsystem: 'ops:run-job',
      status: 'error',
      message: `Job failed: ${resolvedId}`,
      details: { jobId, resolvedId, error: err.message }
    });
    throw err;
  }
}

module.exports = {
  JOBS,
  JOB_ALIASES,
  listJobs,
  resolveJobId,
  runJob
};
