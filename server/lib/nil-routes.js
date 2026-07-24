/**
 * NIL tracking API — SEC rankings and UF dashboard + elite board bundle.
 */
const nilStore = require('./nil-store');
const { createMemoryCache } = require('./memory-cache');

const NIL_DASH_CACHE_MS = parseInt(process.env.NIL_DASHBOARD_CACHE_MS || '60000', 10);
const nilDashCache = createMemoryCache(NIL_DASH_CACHE_MS);

function mountNilRoutes(app) {
  app.get('/api/nil/elite', async (req, res) => {
    try {
      const { buildNilEliteBundle } = require('./nil-elite');
      const classYear = parseInt(String(req.query.classYear || '2027'), 10) || 2027;
      const bundle = await buildNilEliteBundle({ classYear });
      return res.json(bundle);
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/nil/dashboard', (req, res) => {
    try {
      const conference = String(req.query.conference || 'SEC').trim();
      const programId = String(req.query.programId || nilStore.UF_ID).trim();
      const cacheKey = `nil:dashboard:${conference}:${programId}`;
      const hit = nilDashCache.get(cacheKey);
      if (hit) {
        res.setHeader('X-GatorVault-Cache', 'HIT');
        return res.json(hit);
      }
      const dashboard = nilStore.buildDashboard({ conference, programId });
      const payload = { ok: true, dashboard };
      nilDashCache.set(cacheKey, payload, NIL_DASH_CACHE_MS);
      res.setHeader('X-GatorVault-Cache', 'MISS');
      return res.json(payload);
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/nil/rankings', (req, res) => {
    try {
      const rankings = nilStore.listSecRankings();
      return res.json({ ok: true, rankings, updatedAt: nilStore.loadManifest().updatedAt });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/nil/events', (req, res) => {
    try {
      const programId = String(req.query.programId || nilStore.UF_ID).trim();
      const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
      const events = nilStore
        .loadEvents()
        .filter((e) => !programId || e.programId === programId)
        .slice(0, limit);
      return res.json({ ok: true, events });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });
}

module.exports = { mountNilRoutes };
