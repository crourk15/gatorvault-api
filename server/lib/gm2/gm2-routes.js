/**
 * GM 2.0 — admin API routes (quarantine, decisions, repair).
 */
const gm2 = require('./index');
const quarantine = require('./quarantine-store');
const decisionLog = require('./decision-log');

const ADMIN_PIN =
  process.env.OPS_ADMIN_PIN ||
  process.env.RECRUITING_ADMIN_PIN ||
  process.env.CONTENT_ADMIN_PIN ||
  'GV2026admin';

function verifyAdminPin(pin) {
  return !!pin && pin === ADMIN_PIN;
}

function pinFromReq(req) {
  return req.headers['x-ops-pin'] || req.headers['x-recruiting-pin'] || req.body?.pin || req.query?.pin;
}

function mountGm2Routes(app) {
  app.get('/api/gm2/status', (req, res) => {
    try {
      return res.json({ ok: true, ...gm2.getDashboard() });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/gm2/quarantine', (req, res) => {
    const pin = pinFromReq(req);
    if (!verifyAdminPin(pin)) return res.status(401).json({ ok: false, error: 'Admin PIN required' });
    try {
      return res.json({
        ok: true,
        players: quarantine.listQuarantinedPlayers(),
        signals: quarantine.listQuarantinedSignals({ limit: parseInt(req.query.limit || '50', 10) }),
        status: quarantine.getStatus()
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/gm2/decisions', (req, res) => {
    const pin = pinFromReq(req);
    if (!verifyAdminPin(pin)) return res.status(401).json({ ok: false, error: 'Admin PIN required' });
    try {
      return res.json({
        ok: true,
        decisions: decisionLog.listDecisions({
          limit: parseInt(req.query.limit || '100', 10),
          layer: req.query.layer || null,
          feature: req.query.feature || null
        }),
        counts24h: decisionLog.countByAction(86400000)
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/gm2/repair/player', async (req, res) => {
    const pin = pinFromReq(req);
    if (!verifyAdminPin(pin)) return res.status(401).json({ ok: false, error: 'Admin PIN required' });
    try {
      const slug = String(req.body.slug || '').trim();
      if (!slug) return res.status(400).json({ ok: false, error: 'slug required' });
      const result = await gm2.rebuildAndReleasePlayer(slug);
      if (!result.ok) return res.status(400).json(result);
      return res.json({ ok: true, ...result });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/gm2/repair/all', async (req, res) => {
    const pin = pinFromReq(req);
    if (!verifyAdminPin(pin)) return res.status(401).json({ ok: false, error: 'Admin PIN required' });
    try {
      const result = await gm2.repairAllQuarantinedPlayers({
        source: 'admin-bulk-repair',
        limit: parseInt(req.body.limit || '0', 10) || undefined
      });
      return res.json({ ok: true, ...result });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/gm2/sanitize/all', async (req, res) => {
    const pin = pinFromReq(req);
    if (!verifyAdminPin(pin)) return res.status(401).json({ ok: false, error: 'Admin PIN required' });
    try {
      const result = await gm2.sanitizeAllPlayers({
        source: 'admin-sanitize',
        limit: parseInt(req.body.limit || '0', 10) || undefined
      });
      return res.json({ ok: true, ...result });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/gm2/auto-repair/run', async (req, res) => {
    const pin = pinFromReq(req);
    if (!verifyAdminPin(pin)) return res.status(401).json({ ok: false, error: 'Admin PIN required' });
    try {
      const result = await gm2.runAutoRepair({ source: 'admin-manual', ...req.body });
      return res.json({ ok: true, ...result });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/gm2/quarantine/release', (req, res) => {
    const pin = pinFromReq(req);
    if (!verifyAdminPin(pin)) return res.status(401).json({ ok: false, error: 'Admin PIN required' });
    try {
      const slug = String(req.body.slug || '').trim();
      if (!slug) return res.status(400).json({ ok: false, error: 'slug required' });
      const released = quarantine.releasePlayer(slug);
      return res.json({ ok: true, released });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/admin/ops/gm2', (req, res) => {
    res.sendFile(require('path').join(__dirname, '..', '..', 'admin-ops-gm2.html'));
  });
}

module.exports = { mountGm2Routes, verifyAdminPin };
