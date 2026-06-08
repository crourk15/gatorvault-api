const fs = require('fs');
const path = require('path');
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
      const players = rosterStore.getAllRosterPlayers();
      return res.json({ ok: true, count: players.length, players });
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

  app.post('/api/roster/players/:slug/headshot', (req, res) => {
    if (!verifyAdminPin(pinFromReq(req))) {
      return res.status(401).json({ ok: false, error: 'Invalid admin PIN' });
    }
    try {
      const slug = req.params.slug;
      const dataUrl = req.body?.dataUrl || req.body?.headshotDataUrl;
      if (!dataUrl || typeof dataUrl !== 'string') {
        return res.status(400).json({ ok: false, error: 'dataUrl required' });
      }
      const match = dataUrl.match(/^data:image\/([\w+.-]+);base64,(.+)$/);
      if (!match) return res.status(400).json({ ok: false, error: 'Invalid image data URL' });
      let ext = match[1].toLowerCase().replace('jpeg', 'jpg');
      if (!['png', 'jpg', 'webp', 'gif', 'svg+xml', 'svg'].includes(ext)) {
        return res.status(400).json({ ok: false, error: 'Unsupported image type' });
      }
      if (ext === 'svg+xml') ext = 'svg';
      const buf = Buffer.from(match[2], 'base64');
      fs.mkdirSync(rosterStore.HEADSHOTS_DIR, { recursive: true });
      const filename = `${slug}.${ext}`;
      fs.writeFileSync(path.join(rosterStore.HEADSHOTS_DIR, filename), buf);
      const headshotUrl = `/headshots/${filename}`;
      rosterStore.updateHeadshotMapping(slug, headshotUrl);
      const existing = rosterStore.getRosterPlayerBySlug(slug);
      const player = rosterStore.upsertRosterPlayer({
        ...(existing || {}),
        slug,
        name: existing?.name || slug,
        headshotUrl
      });
      return res.json({ ok: true, headshotUrl, player });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
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
