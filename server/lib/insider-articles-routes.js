/**
 * Insider Articles API routes.
 */
const store = require('./insider-articles-store');
const engine = require('./insider-articles-engine');

const ADMIN_PIN =
  process.env.OPS_ADMIN_PIN ||
  process.env.RECRUITING_ADMIN_PIN ||
  process.env.EMAIL_TEST_PIN ||
  'GV2026admin';

function verifyAdminPin(pin) {
  return !!pin && pin === ADMIN_PIN;
}

function pinFromReq(req) {
  return (
    req.headers['x-ops-pin'] ||
    req.headers['x-recruiting-pin'] ||
    req.body?.pin ||
    req.query?.pin
  );
}

function requireAdmin(req, res) {
  if (!verifyAdminPin(pinFromReq(req))) {
    res.status(401).json({ ok: false, error: 'Admin PIN required' });
    return false;
  }
  return true;
}

function mountInsiderArticlesRoutes(app) {
  app.get('/api/articles/published', (req, res) => {
    try {
      const items = store.listPublished().map(store.toPublicArticle);
      return res.json({ ok: true, articles: items, count: items.length });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/articles/drafts', (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const drafts = store.listDrafts({ status: 'draft' });
      return res.json({ ok: true, drafts, count: drafts.length });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/articles/drafts/generate', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const result = await engine.generateWeeklyDrafts({
        force: req.body?.force === true,
        maxDrafts: Math.min(5, parseInt(req.body?.maxDrafts || '5', 10) || 5)
      });
      return res.json({ ok: true, ...result });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/articles/drafts/:id/approve', (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const article = store.approveDraft(req.params.id);
      return res.json({ ok: true, article: store.toPublicArticle(article) });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/articles/drafts/:id/reject', (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const article = store.rejectDraft(req.params.id);
      return res.json({ ok: true, article });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/articles/:id', (req, res) => {
    try {
      const article = store.getArticleById(req.params.id);
      if (!article || article.status !== 'published') {
        return res.status(404).json({ ok: false, error: 'Article not found' });
      }
      return res.json({ ok: true, article: store.toPublicArticle(article) });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/articles/:id/refresh', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const existing = store.getArticleById(req.params.id);
      if (!existing || existing.status !== 'published') {
        return res.status(404).json({ ok: false, error: 'Published article not found' });
      }
      const patch = await engine.refreshArticleContent(existing);
      const article = store.refreshPublished(req.params.id, patch);
      return res.json({ ok: true, article: store.toPublicArticle(article) });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/articles/:id/retire', (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const article = store.retirePublished(req.params.id);
      return res.json({ ok: true, article });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  });
}

module.exports = { mountInsiderArticlesRoutes, verifyAdminPin };
