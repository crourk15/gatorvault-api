/**
 * Insider Articles hub API — featured, storylines, heat index, tags.
 */
const contentStore = require('./content-store');
const { getRelatedArticles } = require('./insider-articles-related');
const {
  insiderHeatIndex,
  insiderStorylinesFallback,
  categoryFromBadge,
  parseStorylineTitle,
  deriveAuthorsFromArticles,
  deriveTagsFromArticles,
} = require('./insider-hub-data');

function articleMeta(a) {
  return {
    id: a.id,
    articleType: a.articleType || a.badge || '',
    angleKey: a.angleKey || '',
    topicKey: a.topicKey || '',
    rosterUnits: a.rosterUnits || [],
    recruitingTargets: a.recruitingTargets || [],
    schemeTags: a.schemeTags || [],
    analyticsTags: a.analyticsTags || [],
  };
}

function mapArticle(a, trending = false) {
  return {
    id: a.id,
    category: categoryFromBadge(a.badge),
    title: a.title,
    preview: a.excerpt || '',
    author: a.author || 'GatorVault Staff',
    date: a.date || '',
    readTime: a.readMin ?? 5,
    trending,
    articleType: a.articleType || a.badge || '',
  };
}

function mapStoryline(s) {
  const { icon, title } = parseStorylineTitle(s.title || '');
  return {
    id: s.id,
    icon,
    title,
    body: String(s.body || s.excerpt || '').replace(/<[^>]+>/g, '').trim(),
  };
}

function loadArticles() {
  const feed = contentStore.getPublishedFeed();
  return (feed.articles || []).map((a, i) => mapArticle(a, i < 2));
}

function loadStorylines() {
  const feed = contentStore.getPublishedFeed();
  const rows = feed.storylines || [];
  if (rows.length) return rows.map(mapStoryline);
  return insiderStorylinesFallback;
}

function mountInsiderHubRoutes(app) {
  app.get('/api/insider/articles', (req, res) => {
    try {
      return res.json(loadArticles());
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/insider/featured', (req, res) => {
    try {
      const articles = loadArticles();
      return res.json(articles[0] || null);
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/insider/storylines', (req, res) => {
    try {
      return res.json(loadStorylines());
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/insider/authors', (req, res) => {
    try {
      return res.json(deriveAuthorsFromArticles(loadArticles()));
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/insider/heat-index', (req, res) => {
    try {
      return res.json(insiderHeatIndex);
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/insider/articles/:id/related', (req, res) => {
    try {
      const feed = contentStore.getPublishedFeed();
      const articles = feed.articles || [];
      const current = articles.find((a) => a.id === req.params.id);
      if (!current) return res.status(404).json({ ok: false, error: 'Article not found' });
      const metas = articles.map(articleMeta);
      const related = getRelatedArticles(articleMeta(current), metas, 4)
        .map((m) => { const full = articles.find((a) => a.id === m.id); return full ? mapArticle(full) : null; })
        .filter(Boolean);
      return res.json({ ok: true, related, count: related.length });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/insider/tags', (req, res) => {
    try {
      return res.json(deriveTagsFromArticles(loadArticles()));
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });
}

module.exports = { mountInsiderHubRoutes };
