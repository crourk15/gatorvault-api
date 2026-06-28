const { verifyAdminPin, pinFromReq } = require('./admin-pin');
const { previewPlayerIntel, enterPlayerIntel } = require('./player-intel-entry');
const { syncSlugsFromJson } = require('./sync-json-players-to-store');
const store = require('./recruiting-store');

function mountPlayerIntelEntryRoutes(app) {
  app.post('/api/admin/player-intel/preview', async (req, res) => {
    if (!verifyAdminPin(pinFromReq(req)) && !verifyAdminPin(req.body?.pin)) {
      return res.status(401).json({ ok: false, error: 'Invalid admin PIN' });
    }
    try {
      const name = String(req.body?.name || '').trim();
      const classYear = parseInt(req.body?.classYear, 10);
      const offer = req.body?.offer;
      if (!name) return res.status(400).json({ ok: false, error: 'name is required' });
      if (!Number.isFinite(classYear)) {
        return res.status(400).json({ ok: false, error: 'classYear is required' });
      }
      const result = await previewPlayerIntel({ name, classYear, offer });
      return res.json(result);
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/admin/player-intel/entry', async (req, res) => {
    if (!verifyAdminPin(pinFromReq(req)) && !verifyAdminPin(req.body?.pin)) {
      return res.status(401).json({ ok: false, error: 'Invalid admin PIN' });
    }
    try {
      const name = String(req.body?.name || '').trim();
      const classYear = parseInt(req.body?.classYear, 10);
      const offer = req.body?.offer;
      const rebuildSnapshots = req.body?.rebuildSnapshots !== false;
      if (!name) return res.status(400).json({ ok: false, error: 'name is required' });
      if (!Number.isFinite(classYear)) {
        return res.status(400).json({ ok: false, error: 'classYear is required' });
      }
      const result = await enterPlayerIntel({ name, classYear, offer, rebuildSnapshots });
      return res.json(result);
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/admin/recruiting/sync-json-slugs', async (req, res) => {
    if (!verifyAdminPin(pinFromReq(req)) && !verifyAdminPin(req.body?.pin)) {
      return res.status(401).json({ ok: false, error: 'Invalid admin PIN' });
    }
    try {
      const slugs = Array.isArray(req.body?.slugs) ? req.body.slugs : [];
      const warmHub = req.body?.warmHub !== false;
      const result = await syncSlugsFromJson(slugs, { warmHub });
      return res.json({ ok: result.ok, ...result });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/admin/player-intel/search', async (req, res) => {
    if (!verifyAdminPin(pinFromReq(req))) {
      return res.status(401).json({ ok: false, error: 'Invalid admin PIN' });
    }
    try {
      const q = String(req.query.q || '').trim().toLowerCase();
      if (!q || q.length < 2) {
        return res.json({ ok: true, players: [] });
      }
      const all = await store.getAllPlayers();
      const players = all
        .filter((p) => String(p.name || '').toLowerCase().includes(q) || String(p.slug || '').includes(q))
        .slice(0, 20)
        .map((p) => ({
          slug: p.slug,
          name: p.name,
          classYear: p.classYear,
          pos: p.pos,
          category: p.category,
          committedTo: p.committedTo,
        }));
      return res.json({ ok: true, players });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });
}

module.exports = { mountPlayerIntelEntryRoutes };
