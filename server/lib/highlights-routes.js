const { loadClips, getClipBySlug } = require('./highlights-store');

function mountHighlightsRoutes(app) {
  app.get('/api/highlights/clips', (req, res) => {
    try {
      let clips = loadClips();
      if (req.query.featured === '1') {
        clips = clips.filter((c) => c.featured);
      }
      clips = clips.slice().sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
      return res.json({ ok: true, clips });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/highlights/clips/:slug', (req, res) => {
    try {
      const clip = getClipBySlug(req.params.slug);
      if (!clip) return res.status(404).json({ ok: false, error: 'Highlight not found' });
      return res.json({ ok: true, clip });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });
}

module.exports = { mountHighlightsRoutes };
