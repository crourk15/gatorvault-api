module.exports = (app) => {
  app.get('/api/health', (req, res) => {
    let dashboard = null;
    try {
      dashboard = require('./live-dashboard-cache').getCacheMeta();
    } catch {
      dashboard = { ready: false };
    }
    res.status(200).json({
      status: 'ok',
      time: Date.now(),
      ready: dashboard.ready === true,
      dashboard
    });
  });
};
