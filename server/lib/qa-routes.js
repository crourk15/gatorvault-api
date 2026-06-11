/**
 * QA Crawler HTTP routes + dashboard API.
 */
const path = require('path');
const qaStore = require('./qa/qa-store');
const mobileBehaviorStore = require('./qa/qa-mobile-behavior-store');
const { runQaCrawl } = require('./qa/qa-runner');
const { runMobileBehaviorChecks } = require('./qa/qa-mobile-behavior-checks');

const ADMIN_PIN =
  process.env.OPS_ADMIN_PIN ||
  process.env.RECRUITING_ADMIN_PIN ||
  process.env.EMAIL_TEST_PIN ||
  'GV2026admin';
const CRON_SECRET = process.env.INGEST_CRON_SECRET || ADMIN_PIN;

function verifyAdminPin(pin) {
  return !!pin && pin === ADMIN_PIN;
}

function pinFromReq(req) {
  return (
    req.headers['x-ops-pin'] ||
    req.headers['x-monitoring-secret'] ||
    req.headers['x-recruiting-pin'] ||
    req.headers['x-ingest-secret'] ||
    req.headers['x-monitoring-cron'] ||
    req.body?.pin ||
    req.query?.pin
  );
}

function requireQaAuth(req, res) {
  const secret = pinFromReq(req);
  const isCron = req.headers['x-monitoring-cron'] === CRON_SECRET;
  if (!isCron && !verifyAdminPin(secret)) {
    res.status(401).json({ ok: false, error: 'Admin PIN required' });
    return false;
  }
  return true;
}

function mountQaRoutes(app) {
  const qaPage = path.join(__dirname, '..', 'admin-qa.html');
  const qaMobilePage = path.join(__dirname, '..', 'admin-qa-mobile.html');

  app.get('/admin/qa', (req, res) => {
    if (req.query.embed === '1') return res.sendFile(qaPage);
    return res.redirect(302, '/admin#qa/monitor');
  });

  app.get('/admin/qa/mobile-behavior', (req, res) => {
    if (req.query.embed === '1') return res.sendFile(qaMobilePage);
    return res.redirect(302, '/admin#qa/mobile-behavior');
  });

  app.get('/api/qa/dashboard', (req, res) => {
    if (!requireQaAuth(req, res)) return;
    try {
      const dashboard = qaStore.getDashboard();
      return res.json({ ok: true, ...dashboard });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/qa/runs', (req, res) => {
    if (!requireQaAuth(req, res)) return;
    try {
      const doc = qaStore.readDoc();
      const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
      return res.json({ ok: true, runs: (doc.runs || []).slice(0, limit) });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/qa/errors', (req, res) => {
    if (!requireQaAuth(req, res)) return;
    try {
      const doc = qaStore.readDoc();
      const limit = Math.min(parseInt(req.query.limit || '50', 10), 100);
      return res.json({ ok: true, errors: (doc.errors || []).slice(0, limit) });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/qa/run', async (req, res) => {
    if (!requireQaAuth(req, res)) return;
    try {
      const result = await runQaCrawl({ force: req.body?.force === true });
      return res.json({ ok: true, ...result });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/qa/screenshot/:filename', (req, res) => {
    if (!requireQaAuth(req, res)) return;
    const full = qaStore.getScreenshotPath(req.params.filename);
    if (!full) return res.status(404).json({ ok: false, error: 'Screenshot not found' });
    return res.sendFile(full);
  });

  app.get('/api/qa/health', (req, res) => {
    const doc = qaStore.readDoc();
    const last = doc.lastRun;
    const mobile = mobileBehaviorStore.readDoc().lastRun;
    return res.json({
      ok: true,
      enabled: process.env.QA_CRAWLER_ENABLED !== 'false',
      lastRun: last,
      mobileBehavior: mobile,
      healthy: last ? last.pass : null,
      uptime: doc.uptime
    });
  });

  app.get('/api/qa/mobile-behavior/dashboard', (req, res) => {
    if (!requireQaAuth(req, res)) return;
    try {
      const dashboard = mobileBehaviorStore.getDashboard();
      return res.json({ ok: true, ...dashboard });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/qa/mobile-behavior/run', async (req, res) => {
    if (!requireQaAuth(req, res)) return;
    try {
      const result = await runMobileBehaviorChecks({ standalone: true });
      return res.json({ ok: true, ...result });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  console.log(
    '[qa] routes mounted: /api/qa/dashboard, /api/qa/errors, /api/qa/runs, POST /api/qa/run, /api/qa/health, /api/qa/mobile-behavior/*'
  );
}

module.exports = { mountQaRoutes };
