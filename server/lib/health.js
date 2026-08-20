module.exports = (app) => {
  /**
   * Public ops probe for durable auth + live beat disk (no secrets / emails).
   * Confirms Render /var/data mount + GV_* path env without Dashboard access.
   */
  app.get('/api/auth/store-status', (_req, res) => {
    try {
      const fs = require('fs');
      const userStore = require('./user-store');
      const users = userStore.getUsersStoreInfo();
      let live = null;
      try {
        live = require('./live-store').getLiveStoreInfo();
      } catch {
        live = null;
      }
      const diskMountPresent = fs.existsSync('/var/data');
      const pathIsDurable = String(users.path || '').startsWith('/var/data');
      return res.status(200).json({
        ok: true,
        auth: {
          durableEnv: users.durableEnv === true,
          pathIsDurable,
          diskMountPresent,
          accountCount: users.count,
          pathHint: pathIsDurable ? '/var/data/users.json' : 'ephemeral',
        },
        live: live
          ? {
              durableEnv: live.durableEnv === true,
              pathIsDurable: live.pathIsDurable === true,
              diskMountPresent: live.diskMountPresent === true,
              dataDirHint: live.pathIsDurable || live.durableEnv ? '/var/data/live' : 'ephemeral',
            }
          : null,
        confirmed: diskMountPresent && users.durableEnv === true && pathIsDurable,
      });
    } catch (err) {
      return res.status(200).json({ ok: false, error: err.message, confirmed: false });
    }
  });

  /** Render liveness probe — must return 2xx while the process is listening. */
  app.get('/health', (_req, res) => {
    // Keep this zero-cost: no module requires, no hub/cache I/O.
    // Render health checks time out at ~5s if the event loop is busy.
    const rssMb = Math.round(process.memoryUsage().rss / 1024 / 1024);
    res.status(200).json({
      ok: true,
      alive: true,
      ready: global.__GV_API_ROUTES_READY__ === true,
      memoryMb: rssMb,
      time: Date.now(),
    });
  });

  /**
   * Readiness probe — must stay 200 + fast while the process is listening.
   * Returning 503 (or taking >5s) causes Render restart loops during App Review.
   * Hub/cache meta is optional diagnostics only — never block the probe on it.
   */
  app.get('/ready', (_req, res) => {
    const routesReady = global.__GV_API_ROUTES_READY__ === true;
    // Cheap snapshot only — never require() heavy hub modules on the probe path.
    const hubMeta =
      global.__GV_HUB_META__ && typeof global.__GV_HUB_META__ === 'object'
        ? global.__GV_HUB_META__
        : { ready: false, probe: 'deferred' };
    const hubReady = hubMeta.ready === true;
    res.status(200).json({
      ok: true,
      alive: true,
      // Process is accepting traffic; hub warm is non-blocking for Render probes.
      ready: true,
      deployReady: routesReady,
      routesReady,
      hubReady,
      hubMeta,
      uptimeSec: Math.floor(process.uptime()),
      bootAt: global.__GV_BOOT_AT__ || null,
      time: Date.now(),
    });
  });

  app.get('/api/health', (req, res) => {
    const rssMb = Math.round(process.memoryUsage().rss / 1024 / 1024);
    // Keep /api/health cheap on Starter — full guardian checks can block the event loop.
    const lightweight = process.env.API_HEALTH_LIGHTWEIGHT !== 'false';
    if (lightweight) {
      let hub = null;
      try {
        hub = require('./recruiting-hub-cache').getMeta();
      } catch {
        hub = { ready: false };
      }
      let dashboard = null;
      try {
        dashboard = require('./live-dashboard-cache').getCacheMeta();
      } catch {
        dashboard = { ready: false };
      }
      return res.status(200).json({
        ok: true,
        status: dashboard?.ready && hub?.ready ? 'ok' : 'warming',
        time: Date.now(),
        ready: dashboard?.ready === true && hub?.ready === true,
        memoryMb: rssMb,
        dashboard,
        hub,
        lightweight: true
      });
    }

    let dashboard = null;
    let deploy = null;
    let systems = null;
    let guardian = null;

    try {
      dashboard = require('./live-dashboard-cache').getCacheMeta();
    } catch {
      dashboard = { ready: false };
    }

    let hub = null;
    try {
      hub = require('./recruiting-hub-cache').getMeta();
    } catch {
      hub = { ready: false };
    }

    try {
      deploy = require('./deploy-monitor').loadDeployState();
    } catch {
      deploy = null;
    }

    try {
      guardian = require('./guardian/system-health').checkAllSystems();
      systems = guardian.systems;
    } catch (err) {
      guardian = { ok: false, systems: {}, error: err.message };
      systems = {
        db: 'error',
        insiderArticles: 'error',
        gm2: 'error',
        productIntel: 'error',
        selfRunner: 'error'
      };
    }

    const apiVersion =
      deploy?.api?.version ||
      process.env.RENDER_GIT_COMMIT?.slice(0, 7) ||
      process.env.GV_BUILD ||
      null;

    const platformOk = guardian?.ok === true;
    const dashboardReady = dashboard?.ready === true;
    const hubReady = hub?.ready === true;
    const ok = platformOk;

    const body = {
      ok,
      status: !platformOk ? 'degraded' : dashboardReady && hubReady ? 'ok' : 'warming',
      time: Date.now(),
      ready: dashboardReady && hubReady,
      dashboard,
      hub,
      deploy: {
        apiVersion,
        apiCommit: deploy?.api?.commit || process.env.RENDER_GIT_COMMIT || null,
        frontendVersion: deploy?.frontend?.version || null,
        strategyEngine: process.env.X_AUTOPOST_STRATEGY_ENGINE === 'legacy' ? 'legacy' : 'v2'
      },
      systems,
      guardian: guardian?.details || null
    };

    res.status(ok ? 200 : 503).json(body);
  });
};
