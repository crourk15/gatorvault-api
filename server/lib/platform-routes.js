const pricing = require('./pricing-config');
const filmRoom = require('./film-room-feed');
const betting = require('./betting-lines');
const feedback = require('./feedback-store');
const access = require('./access-config');
const pointsStore = require('./points-store');
const { getSessionFromReq } = require('./session-auth');

const ADMIN_PIN = process.env.RECRUITING_ADMIN_PIN || process.env.EMAIL_TEST_PIN || 'GV2026admin';

function verifyAdminPin(pin) {
  return !!pin && pin === ADMIN_PIN;
}

function mountPlatformRoutes(app) {
  app.get('/api/pricing', (req, res) => {
    try {
      return res.json(pricing.buildPricingPayload());
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/tiers', (req, res) => {
    try {
      return res.json(access.buildTierSystemPayload());
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/points/me', (req, res) => {
    try {
      const session = getSessionFromReq(req);
      if (!session?.email) {
        return res.json({
          ok: true,
          authenticated: false,
          points: 0,
          tier: 'scout',
          ...access.nextPointsTierInfo(0)
        });
      }
      const row = pointsStore.getUserPoints(session.email);
      return res.json({
        ok: true,
        authenticated: true,
        email: session.email,
        points: row.points,
        tier: row.tier,
        paymentTier: session.tier || 'locker',
        ...access.nextPointsTierInfo(row.points),
        history: row.history.slice(0, 10)
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/points/award', (req, res) => {
    try {
      const session = getSessionFromReq(req);
      if (!session?.email) return res.status(401).json({ ok: false, error: 'Sign in required' });
      const amount = parseInt(req.body?.amount, 10);
      const reason = String(req.body?.reason || 'activity').slice(0, 80);
      if (!amount || amount < 1 || amount > 100) {
        return res.status(400).json({ ok: false, error: 'Invalid points amount' });
      }
      const out = pointsStore.awardPoints(session.email, amount, reason);
      return res.json({ ok: true, ...out });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/film-room/catalog', async (req, res) => {
    try {
      const catalog = await filmRoom.buildFilmRoomCatalog({
        force: req.query.force === '1' || req.query.sync === '1'
      });
      const session = getSessionFromReq(req);
      const paymentTier = session?.tier || null;
      const items = (catalog.items || []).map((item) => {
        const cat = String(item.category || '').toLowerCase();
        const isFreeCategory = cat.includes('press') || cat.includes('highlight');
        const minPaymentTier = isFreeCategory ? null : 'film';
        let locked = false;
        if (minPaymentTier) {
          locked = !access.hasPaymentTier(paymentTier, minPaymentTier);
        }
        return { ...item, minPaymentTier: minPaymentTier || 'free', locked };
      });
      return res.json({ ...catalog, items });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/film-room/admin/rebuild', async (req, res) => {
    try {
      const pin = String(req.body.pin || req.get('X-Recruiting-Pin') || req.query.pin || '');
      if (!verifyAdminPin(pin)) {
        return res.status(401).json({ ok: false, error: 'Invalid admin PIN' });
      }
      const catalog = await filmRoom.buildFilmRoomCatalog({ force: true });
      const press = (catalog.items || []).filter((i) => i.category === 'Press Conferences');
      const micdUp = (catalog.items || []).filter((i) =>
        /mic[\u2018\u2019'']?\s*d\s*up/i.test(String(i.title || ''))
      );
      return res.json({
        ok: true,
        catalog,
        pressConferences: press.map((i) => ({ title: i.title, youtubeId: i.youtubeId })),
        micdUpItems: micdUp.map((i) => ({ title: i.title, category: i.category, youtubeId: i.youtubeId })),
        pressCount: press.length
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/betting/lines', async (req, res) => {
    try {
      const lines = await betting.getBettingLines();
      return res.json(lines);
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/feedback/suggestion', (req, res) => {
    try {
      const row = feedback.addSuggestion(req.body || {});
      return res.json({ ok: true, id: row.id, message: 'Thanks — your suggestion was received.' });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/feedback/survey', (req, res) => {
    try {
      const row = feedback.addSurveyResponse(req.body || {});
      return res.json({ ok: true, id: row.id, message: 'Survey submitted — thank you.' });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/feedback/admin/list', (req, res) => {
    try {
      const pin = String(req.query.pin || req.get('X-Recruiting-Pin') || '');
      if (!verifyAdminPin(pin)) return res.status(401).json({ ok: false, error: 'Invalid PIN' });
      return res.json({
        ok: true,
        suggestions: feedback.listSuggestions(),
        surveys: feedback.listSurveys()
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });
}

module.exports = { mountPlatformRoutes };
