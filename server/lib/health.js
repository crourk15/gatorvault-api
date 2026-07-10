module.exports = (app) => {
  /** Render liveness probe — must return 2xx while the process is listening. */
  app.get('/health', (_req, res) => {
    const rssMb = Math.round(process.memoryUsage().rss / 1024 / 1024);
    res.status(200).json({
      ok: true,
      alive: true,
      ready: global.__GV_API_ROUTES_READY__ === true,
      memoryMb: rssMb,
      time: Date.now()
    });
  });

  /**
   * Readiness probe — must stay 200 while the process is listening.
   * Route wiring can take 30s+ on Starter; returning 503 here causes Render
   * restart loops (health timeout → kill → boot again).
   */
  app.get('/ready', (_req, res) => {
    const routesReady = global.__GV_API_ROUTES_READY__ === true;
    let hubReady = false;
    let hubMeta = {};
    try {
      hubMeta = require('./recruiting-hub-cache').getMeta() || {};
      hubReady = hubMeta.ready === true;
    } catch {
      hubReady = false;
    }
    const fullyReady = routesReady && hubReady;
    res.status(200).json({
      ok: true,
      alive: true,
      ready: fullyReady,
      deployReady: routesReady,
      routesReady,
      hubReady,
      hubMeta,
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
