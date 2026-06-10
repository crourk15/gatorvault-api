/**
 * GV-OM job registry — manual re-run + cron metadata.
 */
const opsMonitor = require('./ops-monitor');

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
    schedule: 'Manual',
    async run() {
      const rosterStore = require('./roster-store');
      const players = rosterStore.getAllRosterPlayers();
      return { ok: true, processedCount: players.length };
    }
  },
  'game-zone-refresh': {
    label: 'Game Zone lines refresh',
    subsystem: 'cron:game-zone',
    schedule: 'Manual',
    async run() {
      try {
        const betting = require('./betting-lines');
        if (typeof betting.refreshLines === 'function') return betting.refreshLines();
      } catch {
        /* optional module */
      }
      return { ok: true, skipped: true, reason: 'no_refresh_handler' };
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

function listJobs() {
  return Object.entries(JOBS).map(([id, job]) => ({
    id,
    label: job.label,
    subsystem: job.subsystem,
    schedule: job.schedule
  }));
}

async function runJob(jobId, opts = {}) {
  const job = JOBS[jobId];
  if (!job) {
    const err = new Error(`Unknown job: ${jobId}`);
    err.code = 'UNKNOWN_JOB';
    throw err;
  }
  return opsMonitor.wrapJob(jobId, job.subsystem, () => job.run(opts), {
    message: `${job.label} manual run`
  });
}

module.exports = {
  JOBS,
  listJobs,
  runJob
};
