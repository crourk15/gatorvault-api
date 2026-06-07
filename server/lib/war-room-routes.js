const { getSessionFromReq, sessionHasTier } = require('./session-auth');
const warRoom = require('./war-room-store');

const WAR_ROOM_ADMIN_PIN =
  process.env.WAR_ROOM_ADMIN_PIN || process.env.RECRUITING_ADMIN_PIN || process.env.EMAIL_TEST_PIN || 'GV2026admin';

function verifyAdminPin(pin) {
  return !!pin && pin === WAR_ROOM_ADMIN_PIN;
}

function pinFromReq(req) {
  return req.headers['x-war-room-pin'] || req.headers['x-recruiting-pin'] || req.body?.pin || req.query?.pin;
}

function mountWarRoomRoutes(app) {
  app.get('/api/war-room/trusted-writers', (req, res) => {
    try {
      return res.json({
        ok: true,
        writers: warRoom.TRUSTED_WRITERS.map((w) => ({ id: w.id, name: w.name }))
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/war-room/breakdown/:slug', (req, res) => {
    try {
      const slug = String(req.params.slug || '').trim();
      if (!slug) return res.status(400).json({ ok: false, error: 'Player slug required' });

      const session = getSessionFromReq(req);
      if (!sessionHasTier(session, 'war')) {
        return res.json(warRoom.buildLockedResponse(slug));
      }

      return res.json(warRoom.buildBreakdownResponse(slug));
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/war-room/breakdowns', (req, res) => {
    try {
      const session = getSessionFromReq(req);
      const all = warRoom.getAllBreakdowns();
      if (!sessionHasTier(session, 'war')) {
        return res.json({
          ok: true,
          locked: true,
          tier: 'war',
          count: all.length,
          breakdowns: []
        });
      }

      const playerType = req.query.playerType ? String(req.query.playerType).toLowerCase() : null;
      let list = all;
      if (playerType) list = list.filter((b) => b.playerType === playerType);

      return res.json({
        ok: true,
        locked: false,
        count: list.length,
        breakdowns: list.map((b) => ({
          playerSlug: b.playerSlug,
          playerName: b.playerName,
          playerType: b.playerType,
          sources: b.sources.map((s) => s.writer),
          updatedAt: b.updatedAt
        }))
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/war-room/breakdown/:slug', (req, res) => {
    if (!verifyAdminPin(pinFromReq(req))) {
      return res.status(401).json({ ok: false, error: 'Invalid admin PIN' });
    }
    try {
      const slug = String(req.params.slug || '').trim();
      const entry = warRoom.upsertBreakdown(slug, { ...req.body, playerSlug: slug });
      return res.json({ ok: true, breakdown: entry });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  });

  app.delete('/api/war-room/breakdown/:slug', (req, res) => {
    if (!verifyAdminPin(pinFromReq(req))) {
      return res.status(401).json({ ok: false, error: 'Invalid admin PIN' });
    }
    try {
      const slug = String(req.params.slug || '').trim();
      const removed = warRoom.deleteBreakdown(slug);
      if (!removed) return res.status(404).json({ ok: false, error: 'Breakdown not found' });
      return res.json({ ok: true, removed: true, playerSlug: slug });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });
}

module.exports = { mountWarRoomRoutes, verifyAdminPin };
