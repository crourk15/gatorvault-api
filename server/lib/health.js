module.exports = (app) => {
  app.get('/api/health', (req, res) => {
    let dashboard = null;
    let deploy = null;
    try {
      dashboard = require('./live-dashboard-cache').getCacheMeta();
    } catch {
      dashboard = { ready: false };
    }
    try {
      deploy = require('./deploy-monitor').loadDeployState();
    } catch {
      deploy = null;
    }
    res.status(200).json({
      status: 'ok',
      time: Date.now(),
      ready: dashboard.ready === true,
      dashboard,
      deploy: deploy
        ? {
            apiVersion: deploy.api?.version || null,
            apiCommit: deploy.api?.commit || null,
            frontendVersion: deploy.frontend?.version || null
          }
        : null
    });
  });
};
