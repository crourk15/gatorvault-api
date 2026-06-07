const store = require('./content-store');
const {
  loadOfficialNames,
  logValidationFailure,
  validateContentItem,
  resolveContentItem,
  LOG_PATH
} = require('./content-validator');
const fs = require('fs');

const CONTENT_ADMIN_PIN = process.env.CONTENT_ADMIN_PIN || process.env.RECRUITING_ADMIN_PIN || process.env.EMAIL_TEST_PIN || 'GV2026admin';

function verifyAdminPin(pin) {
  return !!pin && pin === CONTENT_ADMIN_PIN;
}

function pinFromReq(req) {
  return req.headers['x-content-pin'] || req.body?.pin || req.query?.pin;
}

function mountContentRoutes(app) {
  app.get('/api/content/official-names', (req, res) => {
    try {
      return res.json({ ok: true, official: loadOfficialNames() });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/content/published', (req, res) => {
    try {
      const feed = store.getPublishedFeed();
      return res.json({ ok: true, ...feed });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/content/articles/:id', (req, res) => {
    try {
      const article = store.getArticleById(req.params.id);
      if (!article) return res.status(404).json({ ok: false, error: 'Article not found' });
      return res.json({ ok: true, article });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/content/queue', (req, res) => {
    if (!verifyAdminPin(pinFromReq(req))) {
      return res.status(401).json({ ok: false, error: 'Invalid admin PIN' });
    }
    try {
      const status = req.query.status || null;
      return res.json({ ok: true, queue: store.getQueue(status) });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/content/validation-log', (req, res) => {
    if (!verifyAdminPin(pinFromReq(req))) {
      return res.status(401).json({ ok: false, error: 'Invalid admin PIN' });
    }
    try {
      const log = JSON.parse(fs.readFileSync(LOG_PATH, 'utf8'));
      return res.json({ ok: true, log });
    } catch (err) {
      return res.json({ ok: true, log: [] });
    }
  });

  app.post('/api/content/validate', (req, res) => {
    if (!verifyAdminPin(pinFromReq(req))) {
      return res.status(401).json({ ok: false, error: 'Invalid admin PIN' });
    }
    try {
      const result = validateContentItem(req.body || {});
      if (!result.valid) {
        logValidationFailure({
          action: 'validate_preview',
          title: req.body?.title,
          errors: result.errors,
          message: result.errors.map((e) => e.message).join('; ')
        });
      }
      return res.json({ ok: true, valid: result.valid, errors: result.errors, resolved: result.resolved });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/content/drafts', (req, res) => {
    if (!verifyAdminPin(pinFromReq(req))) {
      return res.status(401).json({ ok: false, error: 'Invalid admin PIN' });
    }
    try {
      const item = store.upsertDraft(req.body || {});
      return res.json({ ok: true, item });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/content/drafts/:id/validate', (req, res) => {
    if (!verifyAdminPin(pinFromReq(req))) {
      return res.status(401).json({ ok: false, error: 'Invalid admin PIN' });
    }
    try {
      const result = store.validateQueueItem(req.params.id);
      return res.json({ ok: true, ...result });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/content/drafts/:id/submit-review', (req, res) => {
    if (!verifyAdminPin(pinFromReq(req))) {
      return res.status(401).json({ ok: false, error: 'Invalid admin PIN' });
    }
    try {
      const result = store.submitForReview(req.params.id);
      if (!result.ok) return res.status(400).json(result);
      return res.json(result);
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/content/review/:id/publish', (req, res) => {
    if (!verifyAdminPin(pinFromReq(req))) {
      return res.status(401).json({ ok: false, error: 'Invalid admin PIN' });
    }
    try {
      const result = store.publishItem(req.params.id);
      if (!result.ok) return res.status(400).json(result);
      return res.json(result);
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/content/review/:id/reject', (req, res) => {
    if (!verifyAdminPin(pinFromReq(req))) {
      return res.status(401).json({ ok: false, error: 'Invalid admin PIN' });
    }
    try {
      const result = store.rejectItem(req.params.id, req.body?.notes);
      if (!result.ok) return res.status(400).json(result);
      return res.json(result);
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/content/preview-resolve', (req, res) => {
    try {
      const resolved = resolveContentItem(req.body || {});
      return res.json({ ok: true, resolved });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });
}

module.exports = { mountContentRoutes, verifyAdminPin };
