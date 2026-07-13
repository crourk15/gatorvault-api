/**
 * Periodic depth chart, game zone, NIL, and portal sync when in-process schedulers are enabled.
 */
const pipelineGuards = require('./pipeline-guards');

function startPlatformMaintenanceSchedulers() {
  if (!pipelineGuards.guardScheduledJobStart('platform-maintenance')) return null;

  const opsMonitor = require('./ops-monitor');
  const timers = [];

  const scheduleJob = (label, envKey, defaultMs, bootDelayMs, runFn) => {
    const enabled = process.env[envKey];
    if (enabled === 'false' || enabled === '0') {
      console.log(`[platform] ${label} skipped — ${envKey}=false`);
      return;
    }
    const intervalMs = parseInt(process.env[`${envKey.replace(/_ENABLED$/, '_INTERVAL_MS')}`] || String(defaultMs), 10);
    const tick = () => {
      opsMonitor
        .wrapJob(label, `cron:${label}`, runFn)
        .then((r) => {
          if (!r?.skipped) console.log(`[platform] ${label}:`, r?.ok !== false ? 'ok' : r?.reason || r?.error || r);
        })
        .catch((err) => console.warn(`[platform] ${label} failed:`, err.message));
    };
    timers.push(setTimeout(tick, bootDelayMs));
    timers.push(setInterval(tick, intervalMs));
    console.log(`[platform] ${label} every ${Math.round(intervalMs / 3600000)}h`);
  };

  scheduleJob(
    'depth-chart',
    'DEPTH_CHART_ENABLED',
    21600000,
    parseInt(process.env.DEPTH_CHART_BOOT_DELAY_MS || '90000', 10),
    () => {
      const { refreshDepthChart } = require('./depth-chart-jobs');
      return refreshDepthChart();
    }
  );

  scheduleJob(
    'roster-stats',
    'ROSTER_STATS_SYNC_ENABLED',
    86400000,
    parseInt(process.env.ROSTER_STATS_BOOT_DELAY_MS || '180000', 10),
    () => {
      const { syncRosterProductionStats } = require('./roster-production-stats-sync');
      return syncRosterProductionStats();
    }
  );

  scheduleJob(
    'game-zone',
    'GAME_ZONE_ENABLED',
    21600000,
    parseInt(process.env.GAME_ZONE_BOOT_DELAY_MS || '120000', 10),
    () => {
      const { refreshLines } = require('./betting-lines');
      return refreshLines();
    }
  );

  scheduleJob(
    'nil-ingest',
    'NIL_REFRESH_ENABLED',
    21600000,
    parseInt(process.env.NIL_REFRESH_BOOT_DELAY_MS || '150000', 10),
    () => {
      const nilStore = require('./nil-store');
      const dash = nilStore.buildDashboard();
      return { ok: true, processedCount: dash?.secRankings?.length || 0, updatedAt: dash.updatedAt };
    }
  );

  if (process.env.ON3_PORTAL_SYNC_ENABLED !== 'false') {
    const portalInterval = parseInt(process.env.ON3_PORTAL_SYNC_INTERVAL_MS || '21600000', 10);
    const portalBoot = parseInt(process.env.ON3_PORTAL_SYNC_BOOT_DELAY_MS || '120000', 10);
    const portalTick = () => {
      const { syncPortalFromOn3 } = require('./on3-ingest');
      opsMonitor
        .wrapJob('portal-ingest', 'cron:portal-ingest', () => syncPortalFromOn3())
        .then((r) => console.log('[portal] scheduled sync:', r?.count ?? 0, 'players'))
        .catch((err) => console.warn('[portal] scheduled sync failed:', err.message));
    };
    timers.push(setTimeout(portalTick, portalBoot));
    timers.push(setInterval(portalTick, portalInterval));
    console.log('[platform] portal-ingest every', Math.round(portalInterval / 3600000), 'h');
  }

  return timers;
}

module.exports = { startPlatformMaintenanceSchedulers };
