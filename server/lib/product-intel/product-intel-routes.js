/**
 * Product Intelligence — HTTP routes.
 */
const path = require('path');
const store = require('./product-intel-store');
const engine = require('./product-intel-engine');
const scoring = require('./product-intel-scoring');

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

function requireIntelAuth(req, res) {
  const secret = pinFromReq(req);
  const isCron = req.headers['x-monitoring-cron'] === CRON_SECRET;
  if (!isCron && !verifyAdminPin(secret)) {
    res.status(401).json({ ok: false, error: 'Admin PIN required' });
    return false;
  }
  return true;
}

function mountProductIntelRoutes(app) {
  const page = path.join(__dirname, '..', '..', 'admin-product-intel.html');

  app.get('/admin/product-health', (req, res) => {
    if (req.query.embed === '1') return res.sendFile(page);
    return res.redirect(302, '/admin#product-intel/health');
  });

  app.get('/api/product-intel/scores', (req, res) => {
    if (!requireIntelAuth(req, res)) return;
    try {
      return res.json({ ok: true, ...engine.getScoresPayload() });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/product-intel/summary', (req, res) => {
    if (!requireIntelAuth(req, res)) return;
    try {
      const doc = store.readDoc();
      const summary = store.getTodaySummary(doc) || (doc.dailySummaries || [])[0] || null;
      return res.json({
        ok: true,
        summary,
        recent: (doc.dailySummaries || []).slice(0, 7),
        lastComputedAt: doc.lastComputedAt
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/product-intel/weekly', (req, res) => {
    if (!requireIntelAuth(req, res)) return;
    try {
      const doc = store.readDoc();
      return res.json({
        ok: true,
        report: store.getLatestWeekly(doc),
        history: (doc.weeklyReports || []).slice(0, 8),
        snapshots: (doc.snapshots || []).slice(0, 14)
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/product-intel/fix-queue', (req, res) => {
    if (!requireIntelAuth(req, res)) return;
    try {
      const doc = store.readDoc();
      const open = (doc.fixQueue || []).filter((f) => !f.resolved);
      const severity = req.query.severity;
      const filtered = severity ? open.filter((f) => f.severity === severity) : open;
      return res.json({
        ok: true,
        items: filtered,
        total: open.length,
        bySeverity: countBySeverity(open),
        signalCounts: {
          open: open.length,
          total: (doc.fixQueue || []).length,
          byClassification: open.reduce((acc, f) => {
            const c = f.classification || 'unknown';
            acc[c] = (acc[c] || 0) + 1;
            return acc;
          }, {})
        }
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/product-intel/layers', (req, res) => {
    if (!requireIntelAuth(req, res)) return;
    try {
      return res.json({ ok: true, ...engine.getLayersPayload() });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/product-intel/recompute', async (req, res) => {
    if (!requireIntelAuth(req, res)) return;
    try {
      const weekly = req.body?.weekly === true;
      const result = await engine.recomputeFromLatestRun({ daily: true, weekly });
      if (!result.ok) {
        return res.status(404).json({ ok: false, error: result.reason || 'No QA runs to analyze' });
      }
      return res.json({
        ok: true,
        overall: result.scores?.overall,
        color: scoring.healthColor(result.scores?.overall ?? 0),
        fixQueue: (result.fixQueue || []).filter((f) => !f.resolved).length,
        intelligenceLayers: result.intelligenceLayers,
        signalCounts: result.signalCounts,
        weekly
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/product-intel/health', (req, res) => {
    const doc = store.readDoc();
    const open = (doc.fixQueue || []).filter((f) => !f.resolved);
    return res.json({
      ok: true,
      enabled: process.env.PRODUCT_INTEL_ENABLED !== 'false',
      overall: doc.scores?.overall ?? null,
      lastComputedAt: doc.lastComputedAt,
      fixQueueOpen: open.length,
      intelligenceLayers: doc.intelligenceLayers ?? null,
      byClassification: open.reduce((acc, f) => {
        const c = f.classification || 'unknown';
        acc[c] = (acc[c] || 0) + 1;
        return acc;
      }, {})
    });
  });

  console.log(
    '[product-intel] routes mounted: /api/product-intel/scores, /summary, /weekly, /fix-queue, /layers, POST /recompute'
  );
}

function countBySeverity(items) {
  const out = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  items.forEach((i) => {
    if (out[i.severity] != null) out[i.severity] += 1;
  });
  return out;
}

module.exports = { mountProductIntelRoutes };
