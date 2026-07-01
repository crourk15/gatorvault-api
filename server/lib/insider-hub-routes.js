/**
 * Insider Articles hub API — featured, storylines, heat index, tags.
 */
const contentStore = require('./content-store');
const {
  insiderAuthors,
  insiderHeatIndex,
  insiderStorylinesFallback,
  insiderTags,
  categoryFromBadge,
  parseStorylineTitle,
} = require('./insider-hub-data');

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
      return res.json(insiderAuthors);
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

  app.get('/api/insider/tags', (req, res) => {
    try {
      return res.json(insiderTags);
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });
}

module.exports = { mountInsiderHubRoutes };
