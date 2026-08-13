const pricing = require('./pricing-config');
const filmRoom = require('./film-room-feed');
const store = require('./film-room-knowledge-store');
const betting = require('./betting-lines');
const feedback = require('./feedback-store');
const access = require('./access-config');
const pointsStore = require('./points-store');
const personas = require('./persona-config');
const { getSessionFromReq, effectiveTier, sessionHasTier } = require('./session-auth');

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

  app.get('/api/personas', (req, res) => {
    try {
      return res.json(personas.buildPersonasPayload());
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/personas/:id', (req, res) => {
    try {
      const persona = personas.getPersona(String(req.params.id || '').trim());
      if (!persona) return res.status(404).json({ ok: false, error: 'Persona not found' });
      return res.json({ ok: true, persona });
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
        paymentTier: effectiveTier(session) || 'locker',
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
      if (req.query.sync === '1' || req.query.force === '1') {
        try {
          store.reloadKnowledge();
        } catch (reloadErr) {
          console.warn('[film-room] knowledge reload skipped:', reloadErr.message);
        }
      }
      const catalog = filmRoom.buildFilmRoomCatalog();
      const session = getSessionFromReq(req);
      const unlocked = sessionHasTier(session, 'film');
      const items = (catalog.items || []).map((item) => {
        return { ...item, minPaymentTier: 'film', locked: !unlocked };
      });
      return res.json({ ...catalog, items });
    } catch (err) {
      console.error('[film-room] catalog error:', err.message);
      return res.json({
        ok: true,
        mode: 'degraded',
        items: [],
        categories: filmRoom.FILM_ROOM_CATEGORIES || [],
        hubs: filmRoom.FILM_HUBS || [],
        byCategory: {},
        counts: { total: 0, knowledgeLessons: 0, legacyVideos: 0, validated: 0, skipped: 0 },
        degraded: true,
        warning: err.message,
      });
    }
  });

  app.get('/api/game-week/meta', (req, res) => {
    try {
      const gameWeek = require('./game-week-feed');
      return res.json(gameWeek.buildGameWeekPayload());
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  /** Live schedule slate — edit server/data/schedule/<year>-season.json (or /var/data) without Codemagic. */
  app.get('/api/schedule', (req, res) => {
    try {
      const scheduleBoard = require('./schedule-board');
      const season = Number(req.query.year || req.query.season || 2026) || 2026;
      return res.json(scheduleBoard.toApiPayload(scheduleBoard.getScheduleBoard(season)));
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.put('/api/schedule', (req, res) => {
    const pin = String(req.body?.pin || req.get('X-Recruiting-Pin') || req.query.pin || '');
    if (!verifyAdminPin(pin)) {
      return res.status(401).json({ ok: false, error: 'Invalid admin PIN' });
    }
    try {
      const scheduleBoard = require('./schedule-board');
      const season = Number(req.body?.season || req.query.year || 2026) || 2026;
      const saved = scheduleBoard.saveScheduleBoard(req.body || {}, season);
      return res.json({ ok: true, ...scheduleBoard.toApiPayload(saved), path: saved.path });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/film-room/lesson/:id', (req, res) => {
    try {
      const session = getSessionFromReq(req);
      if (!sessionHasTier(session, 'film')) {
        return res.status(403).json({ ok: false, error: 'Film tier required', locked: true });
      }
      const out = filmRoom.getLessonDetail(req.params.id);
      if (!out.ok) return res.status(422).json(out);
      return res.json(out);
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
      const catalog = filmRoom.rebuildFilmRoomCatalog();
      return res.json({
        ok: true,
        scope: 'knowledge_engine',
        message: 'Film Room rebuilt from verified knowledge database — no external video sync.',
        catalog
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  /**
   * Pull new UF football pressers + GNFP film reviews from YouTube RSS into the durable cache.
   * Auth: admin PIN or monitoring cron secret.
   */
  app.post('/api/film-room/admin/sync-youtube', async (req, res) => {
    try {
      const pin = String(req.body.pin || req.get('X-Recruiting-Pin') || req.query.pin || '');
      const cronSecret = process.env.MONITORING_CRON_SECRET || process.env.CRON_SECRET || '';
      const cronHeader = String(req.get('x-monitoring-cron') || req.get('x-cron-secret') || '');
      const cronOk = Boolean(cronSecret && cronHeader && cronHeader === cronSecret);
      if (!cronOk && !verifyAdminPin(pin)) {
        return res.status(401).json({ ok: false, error: 'Invalid admin PIN or cron secret' });
      }
      const { stayGreenSkipPayload } = require('./api-stay-green');
      const skipped = stayGreenSkipPayload('film-room-youtube-sync');
      if (skipped) {
        console.log('[film-room] stay-green skip youtube sync');
        return res.json(skipped);
      }
      const { syncFilmRoomYouTube } = require('./film-room-youtube-ingest');
      const sync = await syncFilmRoomYouTube();
      const catalog = filmRoom.rebuildFilmRoomCatalog();
      return res.json({
        ok: true,
        scope: 'youtube_rss',
        message: 'Film Room YouTube sync complete (Florida Gators football pressers + GNFP reviews).',
        sync,
        catalogCounts: {
          items: Array.isArray(catalog?.items) ? catalog.items.length : null,
        },
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/feedback/submit', (req, res) => {
    try {
      const row = feedback.addSubmission(req.body || {});
      return res.json({ ok: true, id: row.id, message: 'Thanks — your feedback was received.' });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/feedback/categories', (req, res) => {
    return res.json({ ok: true, categories: feedback.FEEDBACK_CATEGORIES });
  });

  app.get('/api/points/admin/lookup', (req, res) => {
    try {
      const pin = String(req.query.pin || req.get('X-Recruiting-Pin') || '');
      if (!verifyAdminPin(pin)) return res.status(401).json({ ok: false, error: 'Invalid PIN' });
      const email = String(req.query.email || '').trim();
      if (!email) return res.status(400).json({ ok: false, error: 'Email required' });
      const row = pointsStore.getUserPoints(email);
      return res.json({ ok: true, email, ...row });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/points/admin/set', (req, res) => {
    try {
      const pin = String(req.body.pin || req.get('X-Recruiting-Pin') || req.query.pin || '');
      if (!verifyAdminPin(pin)) return res.status(401).json({ ok: false, error: 'Invalid PIN' });
      const email = String(req.body.email || '').trim();
      const points = parseInt(req.body.points, 10);
      if (!email) return res.status(400).json({ ok: false, error: 'Email required' });
      if (Number.isNaN(points) || points < 0) return res.status(400).json({ ok: false, error: 'Invalid points' });
      const out = pointsStore.setPoints(email, points);
      return res.json({ ok: true, email, ...out });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/points/admin/award', (req, res) => {
    try {
      const pin = String(req.body.pin || req.get('X-Recruiting-Pin') || req.query.pin || '');
      if (!verifyAdminPin(pin)) return res.status(401).json({ ok: false, error: 'Invalid PIN' });
      const email = String(req.body.email || '').trim();
      const amount = parseInt(req.body.amount, 10);
      const reason = String(req.body.reason || 'admin award').slice(0, 80);
      if (!email) return res.status(400).json({ ok: false, error: 'Email required' });
      if (!amount || amount < 1 || amount > 5000) {
        return res.status(400).json({ ok: false, error: 'Amount must be 1–5000' });
      }
      const out = pointsStore.awardPoints(email, amount, reason);
      return res.json({ ok: true, email, ...out });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
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
        surveys: feedback.listSurveys(),
        submissions: feedback.listSubmissions()
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });
}

module.exports = { mountPlatformRoutes };
