const path = require('path');
const opsMonitor = require('./ops-monitor');
const opsJobs = require('./ops-jobs');
const opsAlerts = require('./ops-alerts');
const deployMonitor = require('./deploy-monitor');
const { buildOpsStatusReport } = require('./ops-status');

const { verifyAdminPin, primaryAdminPin, pinFromReq, normalizePin } = require('./admin-pin');
const CRON_SECRET = process.env.INGEST_CRON_SECRET || primaryAdminPin();

function requireOpsAuth(req, res) {
  const secret = pinFromReq(req);
  const isCron = req.headers['x-monitoring-cron'] === CRON_SECRET;
  if (!isCron && !verifyAdminPin(secret)) {
    res.status(401).json({ ok: false, error: 'Admin PIN required' });
    return false;
  }
  return true;
}

function mountOpsRoutes(app) {
  const opsPage = path.join(__dirname, '..', 'admin-ops.html');

  app.get('/admin/ops', (req, res) => {
    if (req.query.embed === '1') return res.sendFile(opsPage);
    return res.redirect(302, '/admin#dashboard');
  });

  app.get('/admin/ops/identity-patterns', (req, res) => {
    if (req.query.embed === '1') {
      return res.sendFile(path.join(__dirname, '..', 'admin-ops-identity-patterns.html'));
    }
    return res.redirect(302, '/admin#gm2/identity');
  });

  app.get('/admin-ops/articles/edit/:id', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'admin-ops-article-edit.html'));
  });

  app.get('/admin/ops/articles/edit/:id', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'admin-ops-article-edit.html'));
  });

  app.get('/admin-ops/articles/:id', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'admin-ops-article-view.html'));
  });

  app.get('/admin/ops/articles/:id', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'admin-ops-article-view.html'));
  });

  app.get('/vault/ops', (req, res) => {
    res.redirect(302, '/admin#dashboard');
  });

  app.get('/api/ops/verify-pin', (req, res) => {
    const pin = normalizePin(pinFromReq(req));
    if (!verifyAdminPin(pin)) {
      return res.status(401).json({ ok: false, authenticated: false, error: 'Invalid PIN' });
    }
    return res.status(200).json({ ok: true, authenticated: true });
  });

  app.post('/api/ops/verify-pin', (req, res) => {
    const pin = normalizePin(pinFromReq(req));
    if (!verifyAdminPin(pin)) {
      return res.status(401).json({ ok: false, authenticated: false, error: 'Invalid PIN' });
    }
    return res.status(200).json({ ok: true, authenticated: true });
  });

  app.get('/api/ops/status', async (req, res) => {
    if (!requireOpsAuth(req, res)) return;
    try {
      const evaluateAlerts = req.query.evaluateAlerts === '1';
      const report = await buildOpsStatusReport({ evaluateAlerts });
      return res.status(200).json({ ok: true, authenticated: true, ...report });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/ops/logs', (req, res) => {
    if (!requireOpsAuth(req, res)) return;
    try {
      const data = opsMonitor.getLogs({
        subsystem: req.query.subsystem || null,
        limit: req.query.limit || 100,
        since: req.query.since || null,
        status: req.query.status || null
      });
      return res.json({ ok: true, ...data });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/ops/jobs', (req, res) => {
    if (!requireOpsAuth(req, res)) return;
    try {
      const heartbeats = opsMonitor.getHeartbeats();
      const jobs = opsJobs.listJobs().map((job) => ({
        ...job,
        heartbeat: heartbeats.subsystems[job.subsystem] || null
      }));
      return res.json({ ok: true, jobs });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/ops/run-job', async (req, res) => {
    if (!requireOpsAuth(req, res)) return;
    const jobId = req.body?.jobId;
    if (!jobId) return res.status(400).json({ ok: false, error: 'jobId required' });

    try {
      const { jobId: resolvedId, requestedId, result } = await opsJobs.runJob(jobId, req.body?.options || {});
      const failed = result && result.ok === false && !result.skipped;
      return res.status(failed ? 422 : 200).json({
        ok: !failed,
        jobId: resolvedId,
        requestedId,
        result,
        completedAt: new Date().toISOString()
      });
    } catch (err) {
      if (err.code === 'UNKNOWN_JOB') {
        return res.status(404).json({ ok: false, error: err.message, jobId });
      }
      return res.status(500).json({ ok: false, error: err.message, jobId });
    }
  });

  app.get('/api/ops/alerts', (req, res) => {
    if (!requireOpsAuth(req, res)) return;
    try {
      const data = opsAlerts.listAlerts({ limit: req.query.limit || 50 });
      return res.json({ ok: true, ...data });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/ops/deploy/record', (req, res) => {
    if (!requireOpsAuth(req, res)) return;
    try {
      const component = req.body?.component || 'frontend';
      let state;
      if (component === 'api') state = deployMonitor.recordApiBoot();
      else state = deployMonitor.recordFrontendDeploy(req.body || {});
      return res.json({ ok: true, deploy: state });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/ops/log', (req, res) => {
    const secret = pinFromReq(req);
    const isCron = req.headers['x-monitoring-cron'] === CRON_SECRET;
    if (!isCron && !verifyAdminPin(secret)) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }
    try {
      const event = opsMonitor.logEvent(req.body || {});
      return res.json({ ok: true, event });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });
}

module.exports = { mountOpsRoutes, verifyAdminPin, pinFromReq };
