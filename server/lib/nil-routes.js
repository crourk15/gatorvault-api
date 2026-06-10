/**
 * NIL tracking API — SEC rankings and UF dashboard.
 */
const nilStore = require('./nil-store');

function mountNilRoutes(app) {
  app.get('/api/nil/dashboard', (req, res) => {
    try {
      const conference = String(req.query.conference || 'SEC').trim();
      const programId = String(req.query.programId || nilStore.UF_ID).trim();
      const dashboard = nilStore.buildDashboard({ conference, programId });
      return res.json({ ok: true, dashboard });
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
