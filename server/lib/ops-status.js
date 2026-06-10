/**
 * GV-OM status aggregator — builds dashboard tiles from all subsystems.
 */
const fs = require('fs');
const path = require('path');
const opsMonitor = require('./ops-monitor');
const deployMonitor = require('./deploy-monitor');
const apiMonitor = require('./api-monitor');
const dbMonitor = require('./db-monitor');
const opsAlerts = require('./ops-alerts');
const opsJobs = require('./ops-jobs');
const pipelineHealth = require('./pipeline-health');

const DATA = path.join(__dirname, '..', 'data');

function readJson(rel, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA, rel), 'utf8'));
  } catch {
    return fallback;
  }
}

function fileMtime(rel) {
  try {
    return fs.statSync(path.join(DATA, rel)).mtime.toISOString();
  } catch {
    return null;
  }
}

function hoursAgo(iso) {
  if (!iso) return null;
  return Math.round((Date.now() - new Date(iso).getTime()) / 3600000);
}

function tile(id, label, status, fields = {}) {
  return {
    id,
    label,
    status,
    ...fields
  };
}

function freshnessStatus(iso, warningHours, criticalHours) {
  const h = hoursAgo(iso);
  if (h == null) return { status: 'red', hours: null };
  if (h <= warningHours) return { status: 'green', hours: h };
  if (h <= criticalHours) return { status: 'yellow', hours: h };
  return { status: 'red', hours: h };
}

function buildCronTiles(config, heartbeats) {
  const subs = heartbeats.subsystems || {};
  return opsJobs.listJobs().map((job) => {
    const hb = subs[job.subsystem] || {};
    const errors24h = opsMonitor.getErrorCount24h(job.subsystem);
    let status = 'green';
    if (hb.lastStatus === 'error' || (hb.failureStreak || 0) >= 2) status = 'red';
    else if (hb.lastStatus === 'warning' || errors24h > 0) status = 'yellow';
    else if (!hb.lastRun) status = 'yellow';

    return {
      jobId: job.id,
      label: job.label,
      subsystem: job.subsystem,
      schedule: job.schedule,
      status,
      lastRun: hb.lastRun || null,
      lastStatus: hb.lastStatus || null,
      lastMessage: hb.lastMessage || null,
      failureStreak: hb.failureStreak || 0,
      errors24h,
      canRerun: true
    };
  });
}

function buildInsiderArticlesTile(heartbeats) {
  let draftCount = 0;
  let publishedCount = 0;
  try {
    const insiderStore = require('./insider-articles-store');
    draftCount = insiderStore.countDraftsPending();
    publishedCount = insiderStore.countPublished();
  } catch {
    /* optional module */
  }

  const hb = heartbeats.subsystems?.['cron:article-engine'] || {};
  const errors24h = opsMonitor.getErrorCount24h('cron:article-engine');
  let status = 'green';
  if (errors24h > 2 || hb.lastStatus === 'error') status = 'red';
  else if (draftCount === 0 && !hb.lastRun) status = 'yellow';
  else if (draftCount > 0) status = 'yellow';

  return tile('insider-articles', 'Insider Articles', status, {
    lastRun: hb.lastRun || null,
    draftCount,
    publishedCount,
    summary: `${draftCount} draft${draftCount === 1 ? '' : 's'} pending · ${publishedCount} published`,
    errors24h
  });
}

function buildIdentityPatternsTile() {
  let playerCount = 0;
  let totalPatterns = 0;
  let storeUpdatedAt = null;
  try {
    const doc = readJson('recruiting/identity-patterns.json', { entries: {} });
    const entries = Object.values(doc.entries || {});
    playerCount = entries.length;
    totalPatterns = entries.reduce((sum, entry) => sum + (entry.patterns?.length || 0), 0);
    storeUpdatedAt = doc.updatedAt || null;
  } catch {
    /* optional */
  }

  const hb = opsMonitor.getHeartbeat('cron:identity-patterns') || {};
  const errors24h = opsMonitor.getErrorCount24h('cron:identity-patterns');
  const recentLogs = opsMonitor.getLogs({ subsystem: 'cron:identity-patterns', limit: 1 });
  const lastLog = recentLogs.events?.[0] || null;
  const lastRebuildAt = lastLog?.timestamp || storeUpdatedAt || hb.lastRun || null;
  const rebuildDurationMs = lastLog?.details?.durationMs ?? null;

  let status = 'green';
  if (errors24h > 0 || hb.lastStatus === 'error') status = 'red';
  else if (!playerCount) status = 'yellow';

  return tile('identity-patterns', 'Identity Patterns', status, {
    lastRun: lastRebuildAt,
    playerCount,
    totalPatterns,
    totalPlayers: playerCount,
    lastRebuildAt,
    rebuildDurationMs,
    summary: `${playerCount} players · ${totalPatterns} patterns`,
    href: '/admin/ops/identity-patterns',
    errors24h
  });
}

function buildAutoposterTile(config) {
  const pipeline = pipelineHealth.getHealthReport();
  const hb = opsMonitor.getHeartbeat('autoposter:predictions') || opsMonitor.getHeartbeat('autoposter:queue') || {};
  const posts24h = opsMonitor.countEventsSince('autoposter', 86400000, 'success');
  const skips24h = opsMonitor.countEventsSince('autoposter', 86400000, 'skipped');
  const errors24h = opsMonitor.getErrorCount24h('autoposter');
  const recentLogs = opsMonitor.getLogs({ subsystem: 'autoposter', limit: 5 });

  let scheduler = {};
  try {
    scheduler = require('./x-autoposter').getSchedulerStatus();
  } catch {
    scheduler = {};
  }

  let freshness = { status: 'yellow', lastPostLabel: 'unknown', minutesSinceLastPost: null, postsLast24h: posts24h };
  try {
    const autoposterFreshness = require('./autoposter-freshness');
    freshness = autoposterFreshness.getAutoposterStatus({
      scheduler: {
        ...scheduler,
        queuePending: pipeline.autoposter?.queuePending || 0
      }
    });
  } catch {
    /* optional */
  }

  const staleTooltip =
    freshness.status !== 'green' && freshness.minutesSinceLastPost != null
      ? `No post in ${freshness.minutesSinceLastPost} minutes — click Force Post Now to trigger a manual post.`
      : null;

  return tile('autoposter', 'Autoposter', freshness.status || 'yellow', {
    lastRun: hb.lastRun || pipeline.autoposter?.lastSentAt || null,
    lastStatus: hb.lastStatus || null,
    errors24h,
    posts24h: freshness.postsLast24h ?? posts24h,
    skips24h,
    posts7d: opsMonitor.countEventsSince('autoposter', 7 * 86400000, 'success'),
    skips7d: opsMonitor.countEventsSince('autoposter', 7 * 86400000, 'skipped'),
    queuePending: pipeline.autoposter?.queuePending || 0,
    schedulerEnabled: pipeline.autoposter?.schedulerEnabled,
    lastPostAt: freshness.lastPostAt || scheduler.lastPostAt || null,
    lastPostLabel: freshness.lastPostLabel || null,
    lastPostAttempt: freshness.lastPostAttempt || scheduler.lastPostAttempt || null,
    minutesSinceLastPost: freshness.minutesSinceLastPost,
    activityWindow: freshness.activityWindow,
    identityFailStreak: freshness.identityFailStreak || 0,
    staleTooltip,
    summary: `Last post: ${freshness.lastPostLabel || '—'} · ${freshness.postsLast24h ?? posts24h} posts (24h)`,
    lastError: recentLogs.events.find((e) => e.status === 'error') || null,
    lastMajorEvent: recentLogs.events[0] || null
  });
}

async function buildOpsStatusReport({ evaluateAlerts = false } = {}) {
  const config = opsAlerts.loadConfig();
  const thresholds = config.thresholds || {};
  const heartbeats = opsMonitor.getHeartbeats();
  const deploy = deployMonitor.getDeployReport();
  const api = apiMonitor.getApiHealthReport(thresholds);
  const db = dbMonitor.getDbHealthReport(thresholds);
  const pipeline = pipelineHealth.getHealthReport();

  const on3Snap = readJson('recruiting/on3-snapshot.json', {});
  const nilManifest = readJson('nil/manifest.json', {});
  const filmCatalog = readJson('film-room-knowledge/catalog.json', readJson('film-room/catalog.json', {}));
  const rosterMtime = fileMtime('roster/players.json');
  let depthMeta = null;
  let linesMeta = null;
  try {
    depthMeta = require('./depth-chart-jobs').getDepthChartMeta();
  } catch {
    /* optional */
  }
  try {
    linesMeta = require('./betting-lines').getLinesMeta();
  } catch {
    /* optional */
  }

  const recruitingUpdated = on3Snap.lastRun || pipeline.lastRecruitingIngest || fileMtime('recruiting/players.json');
  const portalUpdated = fileMtime('recruiting/players.json');
  const nilUpdated = nilManifest.updatedAt || fileMtime('nil/manifest.json');
  const filmUpdated =
    filmCatalog.updatedAt || opsMonitor.getHeartbeat('cron:film-room-weekly')?.lastSuccess || null;
  const depthUpdated =
    depthMeta?.updatedAt ||
    opsMonitor.getHeartbeat('cron:depth-chart')?.lastSuccess ||
    rosterMtime;
  const gameZoneUpdated =
    linesMeta?.updatedAt ||
    opsMonitor.getHeartbeat('cron:game-zone')?.lastSuccess ||
    fileMtime('betting/lines.json');

  const recruitingFresh = freshnessStatus(
    recruitingUpdated,
    thresholds.recruitingBoardStaleHours || 24,
    (thresholds.recruitingBoardStaleHours || 24) * 2
  );
  const portalFresh = freshnessStatus(
    portalUpdated,
    thresholds.portalTrackerStaleHours || 12,
    (thresholds.portalTrackerStaleHours || 12) * 2
  );
  const nilFresh = freshnessStatus(
    nilUpdated,
    (thresholds.nilDashboardStaleDays || 7) * 24,
    (thresholds.nilDashboardStaleDays || 7) * 48
  );
  const depthFresh = freshnessStatus(
    depthUpdated,
    thresholds.depthChartStaleHours || 24,
    (thresholds.depthChartStaleHours || 24) * 3
  );
  const gameZoneFresh = freshnessStatus(
    gameZoneUpdated,
    thresholds.gameZoneStaleHours || 48,
    (thresholds.gameZoneStaleHours || 48) * 2
  );
  const filmFresh = freshnessStatus(
    filmUpdated,
    (thresholds.filmRoomStaleDays || 8) * 24,
    (thresholds.filmRoomStaleDays || 8) * 36
  );

  const tiles = [
    tile('deployments', 'Deployments', deploy.status, {
      lastRun: deploy.api?.timestamp,
      summary: deploy.mismatch
        ? `Mismatch API ${deploy.api?.version} vs FE ${deploy.frontend?.version}`
        : `API ${deploy.api?.version || '—'} · FE ${deploy.frontend?.version || '—'}`,
      api: deploy.api,
      frontend: deploy.frontend,
      mismatch: deploy.mismatch,
      errors24h: 0
    }),
    tile('cron-jobs', 'Cron Jobs', 'green', {
      summary: `${opsJobs.listJobs().length} tracked jobs`,
      jobs: buildCronTiles(config, heartbeats),
      errors24h: opsMonitor.getErrorCount24h('cron')
    }),
    buildAutoposterTile(config),
    tile('recruiting-board', 'Recruiting Board', recruitingFresh.status, {
      lastRun: recruitingUpdated,
      lastUpdateHours: recruitingFresh.hours,
      summary: recruitingUpdated ? `Updated ${recruitingFresh.hours ?? '?'}h ago` : 'No timestamp',
      href: '/recruiting-board',
      errors24h: opsMonitor.getErrorCount24h('cron:recruiting-ingest')
    }),
    tile('portal-tracker', 'Portal Tracker', portalFresh.status, {
      lastRun: portalUpdated,
      lastUpdateHours: portalFresh.hours,
      summary: portalUpdated ? `Updated ${portalFresh.hours ?? '?'}h ago` : 'No timestamp',
      errors24h: opsMonitor.getErrorCount24h('cron:portal-ingest')
    }),
    tile('nil-tracker', 'NIL Tracker', nilFresh.status, {
      lastRun: nilUpdated,
      lastUpdateHours: nilFresh.hours,
      summary: nilUpdated ? `Updated ${nilFresh.hours ?? '?'}h ago` : 'No timestamp',
      errors24h: opsMonitor.getErrorCount24h('cron:nil-ingest')
    }),
    tile('depth-gamezone', 'Depth Chart / Game Zone', depthFresh.status === 'green' && gameZoneFresh.status !== 'red' ? depthFresh.status : gameZoneFresh.status === 'red' ? 'red' : 'yellow', {
      lastRun: depthUpdated > gameZoneUpdated ? depthUpdated : gameZoneUpdated,
      depthChartUpdated: depthUpdated,
      gameZoneUpdated: gameZoneUpdated,
      depthChartEnabled: process.env.DEPTH_CHART_ENABLED !== 'false' && process.env.DEPTH_CHART_ENABLED !== '0',
      gameZoneEnabled: process.env.GAME_ZONE_ENABLED !== 'false' && process.env.GAME_ZONE_ENABLED !== '0',
      summary: `Depth ${depthFresh.hours ?? '?'}h · Game Zone ${gameZoneFresh.hours ?? '?'}h`,
      errors24h: opsMonitor.getErrorCount24h('cron:depth-chart') + opsMonitor.getErrorCount24h('cron:game-zone')
    }),
    tile('film-room', 'Film Room Engine', filmFresh.status, {
      lastRun: filmUpdated,
      lastUpdateHours: filmFresh.hours,
      summary: filmUpdated ? `Catalog ${filmFresh.hours ?? '?'}h ago` : 'No catalog timestamp',
      errors24h: opsMonitor.getErrorCount24h('cron:film-room-weekly')
    }),
    buildInsiderArticlesTile(heartbeats),
    buildIdentityPatternsTile(),
    tile('api-health', 'API Health', api.status, {
      lastRun: new Date().toISOString(),
      summary: `${api.totalRequests} reqs · ${Math.round(api.errorRate * 100)}% err · ${api.avgResponseMs}ms avg`,
      ...api,
      errors24h: api.errors5xx + api.errors4xx
    }),
    tile('db-health', 'Database Health', db.status, {
      lastRun: db.lastError?.at || null,
      summary: `${db.errors24h} errors · ${db.slowQueries24h} slow (24h)`,
      ...db,
      errors24h: db.errors24h
    })
  ];

  const statuses = tiles.map((t) => t.status);
  let overall = 'green';
  if (statuses.includes('red')) overall = 'red';
  else if (statuses.includes('yellow')) overall = 'yellow';

  const report = {
    healthy: overall !== 'red',
    overall,
    updatedAt: new Date().toISOString(),
    deployments: deploy,
    pipeline,
    tiles,
    cronJobs: buildCronTiles(config, heartbeats),
    alerts: opsAlerts.listAlerts({ limit: 20 })
  };

  if (evaluateAlerts) {
    await opsAlerts.evaluateStatusReport(report);
  }

  return report;
}

module.exports = {
  buildOpsStatusReport,
  buildCronTiles,
  buildAutoposterTile,
  buildIdentityPatternsTile
};
