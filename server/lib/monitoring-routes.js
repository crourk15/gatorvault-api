const path = require('path');
const monitoring = require('./recruiting-monitoring');

const ADMIN_PIN =
  process.env.RECRUITING_ADMIN_PIN || process.env.EMAIL_TEST_PIN || 'GV2026admin';
const CRON_SECRET = process.env.INGEST_CRON_SECRET || ADMIN_PIN;

function verifyAdminPin(pin) {
  return !!pin && pin === ADMIN_PIN;
}

function pinFromReq(req) {
  return (
    req.headers['x-monitoring-secret'] ||
    req.headers['x-recruiting-pin'] ||
    req.headers['x-ingest-secret'] ||
    req.body?.pin ||
    req.query?.pin
  );
}

function mountMonitoringRoutes(app) {
  app.get('/admin/monitoring', (req, res) => {
    const page = path.join(__dirname, '..', 'admin-monitoring.html');
    if (req.query.embed === '1') return res.sendFile(page);
    return res.redirect(302, '/admin#recruiting/monitoring');
  });

  app.post('/api/internal/monitoring/alert', async (req, res) => {
    const secret = pinFromReq(req);
    if (!monitoring.verifyMonitoringSecret(secret) && !verifyAdminPin(secret)) {
      return res.status(401).json({ ok: false, error: 'Invalid monitoring secret' });
    }
    try {
      const result = await monitoring.sendMonitoringAlert(req.body || {});
      return res.json({ ok: true, ...result });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/internal/monitoring/alerts', (req, res) => {
    const secret = pinFromReq(req);
    if (!monitoring.verifyMonitoringSecret(secret) && !verifyAdminPin(secret)) {
      return res.status(401).json({ ok: false, error: 'Invalid monitoring secret' });
    }
    try {
      const limit = parseInt(req.query.limit || String(monitoring.MAX_ALERTS), 10);
      const data = monitoring.listAlerts({ limit });
      return res.json({ ok: true, ...data });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/internal/monitoring/healthcheck', async (req, res) => {
    const secret = pinFromReq(req);
    const isCron = req.headers['x-monitoring-cron'] === CRON_SECRET;
    if (!isCron && !monitoring.verifyMonitoringSecret(secret) && !verifyAdminPin(secret)) {
      return res.status(401).json({ ok: false, error: 'Invalid monitoring secret' });
    }
    try {
      const report = await monitoring.runHealthCheck();
      return res.json({ ok: true, report });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });
}

module.exports = { mountMonitoringRoutes };
