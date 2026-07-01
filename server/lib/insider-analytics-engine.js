/** Insider Analytics Engine */
function mountAnalyticsRoutes(app) {
  app.get('/api/analytics/win-probability', (req, res) => res.json({ ok: true, model: { games: [] } }));
  app.get('/api/analytics/opponent-strength', (req, res) => res.json({ ok: true, strengthIndex: 50 }));
  app.get('/api/analytics/returning-production', (req, res) => res.json({ ok: true, returningCount: 0 }));
  app.get('/api/analytics/portal-impact', (req, res) => res.json({ ok: true, net: 0 }));
  app.get('/api/analytics/depth-chart', (req, res) => res.json({ ok: true, units: [] }));
  app.get('/api/analytics/scheme', (req, res) => res.json({ ok: true, scheme: '3-3-5 hybrid' }));
}
module.exports = { mountAnalyticsRoutes };
