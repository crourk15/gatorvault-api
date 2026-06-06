const rosterStore = require('./roster-store');

const ROSTER_ADMIN_PIN =
  process.env.ROSTER_ADMIN_PIN || process.env.RECRUITING_ADMIN_PIN || process.env.EMAIL_TEST_PIN || 'GV2026admin';

function verifyAdminPin(pin) {
  return !!pin && pin === ROSTER_ADMIN_PIN;
}

function pinFromReq(req) {
  return req.headers['x-recruiting-pin'] || req.body?.pin || req.query?.pin;
}

function mountRosterRoutes(app) {
  app.get('/api/roster/headshots', (req, res) => {
    try {
      return res.json({ ok: true, headshots: rosterStore.getHeadshotMap() });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/roster/players', (req, res) => {
    try {
      return res.json({ ok: true, players: rosterStore.getAllRosterPlayers() });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/roster/players/:slug', (req, res) => {
    try {
      const player = rosterStore.getRosterPlayerBySlug(req.params.slug);
      if (!player) return res.status(404).json({ ok: false, error: 'Player not found' });
      return res.json({ ok: true, player });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/roster/players/:slug', (req, res) => {
    if (!verifyAdminPin(pinFromReq(req))) {
      return res.status(401).json({ ok: false, error: 'Invalid admin PIN' });
    }
    try {
      const existing = rosterStore.getRosterPlayerBySlug(req.params.slug);
      const slug = req.params.slug;
      const player = rosterStore.upsertRosterPlayer({
        ...(existing || {}),
        ...req.body,
        slug,
        name: req.body.name || (existing && existing.name)
      });
      if (req.body.headshotUrl !== undefined || req.body.headshotMap) {
        rosterStore.updateHeadshotMapping(slug, req.body.headshotUrl || req.body.headshotMap);
        const refreshed = rosterStore.getRosterPlayerBySlug(slug);
        return res.json({ ok: true, player: refreshed || player });
      }
      return res.json({ ok: true, player });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  });
}

module.exports = { mountRosterRoutes };
