const fs = require('fs');
const {
  loadClips,
  getClipBySlug,
  getMediaPathBySlug,
  auditMedia
} = require('./interviews-store');

function apiBaseFromReq(req) {
  if (process.env.MEDIA_CDN_BASE) return process.env.MEDIA_CDN_BASE.replace(/\/$/, '');
  const host = req.get('x-forwarded-host') || req.get('host');
  const proto = req.get('x-forwarded-proto') || req.protocol || 'https';
  return `${proto}://${host}`;
}

function streamVideoFile(req, res, filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(404).json({ ok: false, error: 'Video file not found on server' });
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    if (Number.isNaN(start) || start >= fileSize) {
      return res.status(416).send('Range not satisfiable');
    }
    const chunkSize = end - start + 1;
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': 'video/mp4',
      'Cache-Control': 'public, max-age=86400'
    });
    fs.createReadStream(filePath, { start, end }).pipe(res);
    return;
  }

  res.writeHead(200, {
    'Content-Length': fileSize,
    'Content-Type': 'video/mp4',
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'public, max-age=86400'
  });
  fs.createReadStream(filePath).pipe(res);
}

function mountInterviewsRoutes(app) {
  app.get('/api/interviews/status', (req, res) => {
    try {
      const audit = auditMedia();
      const ready = audit.filter((a) => a.mediaReady).length;
      return res.json({
        ok: true,
        total: audit.length,
        ready,
        clips: audit,
        cdnBase: apiBaseFromReq(req)
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/interviews/clips', (req, res) => {
    try {
      const base = apiBaseFromReq(req);
      let clips = loadClips({
        baseUrl: base,
        playerSlug: req.query.player || req.query.playerSlug,
        gameSlug: req.query.game || req.query.gameSlug
      });
      if (req.query.ready === '1') clips = clips.filter((c) => c.mediaReady);
      clips = clips.slice().sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
      return res.json({ ok: true, clips, cdnBase: base });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/interviews/clips/:slug', (req, res) => {
    try {
      const base = apiBaseFromReq(req);
      const clip = getClipBySlug(req.params.slug, { baseUrl: base });
      if (!clip) return res.status(404).json({ ok: false, error: 'Interview not found' });
      return res.json({ ok: true, clip });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/interviews/stream/:slug', (req, res) => {
    try {
      const filePath = getMediaPathBySlug(req.params.slug);
      return streamVideoFile(req, res, filePath);
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });
}

module.exports = { mountInterviewsRoutes };
