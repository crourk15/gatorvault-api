module.exports = (app) => {
  /** Render liveness probe — must return 2xx while the process is listening. */
  app.get('/health', (_req, res) => {
    res.status(200).json({
      ok: true,
      alive: true,
      ready: global.__GV_API_ROUTES_READY__ === true,
      time: Date.now()
    });
  });

  app.get('/api/health', (req, res) => {
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
        frontendVersion: deploy?.frontend?.version || null
      },
      systems,
      guardian: guardian?.details || null
    };

    res.status(ok ? 200 : 503).json(body);
  });
};
