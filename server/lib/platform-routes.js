const pricing = require('./pricing-config');
const filmRoom = require('./film-room-feed');
const betting = require('./betting-lines');
const feedback = require('./feedback-store');

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

  app.get('/api/film-room/catalog', async (req, res) => {
    try {
      const catalog = await filmRoom.buildFilmRoomCatalog({
        force: req.query.force === '1' || req.query.sync === '1'
      });
      return res.json(catalog);
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
