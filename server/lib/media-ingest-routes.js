const { runMediaIngest } = require('./media-ingest');
const store = require('./media-ingest-store');
const brand = require('./media-brand');
const highlightsStore = require('./highlights-store');
const interviewsStore = require('./interviews-store');

const ADMIN_PIN = process.env.MEDIA_INGEST_PIN || process.env.RECRUITING_ADMIN_PIN || process.env.EMAIL_TEST_PIN || 'GV2026admin';
const CRON_SECRET = process.env.MEDIA_INGEST_CRON_SECRET || process.env.INGEST_CRON_SECRET || ADMIN_PIN;

function verifyPin(pin) {
  return !!pin && (pin === ADMIN_PIN || pin === CRON_SECRET);
}

function apiBaseFromReq(req) {
  if (process.env.MEDIA_CDN_BASE) return process.env.MEDIA_CDN_BASE.replace(/\/$/, '');
  const host = req.get('x-forwarded-host') || req.get('host');
  const proto = req.get('x-forwarded-proto') || req.protocol || 'https';
  return `${proto}://${host}`;
}

function mountMediaIngestRoutes(app) {
  app.get('/api/media-ingest/status', (req, res) => {
    try {
      return res.json({
        ok: true,
        enabled: process.env.MEDIA_INGEST_ENABLED === 'true',
        ffmpeg: brand.hasFfmpeg(),
        intervalMs: parseInt(process.env.MEDIA_INGEST_INTERVAL_MS || '900000', 10),
        ...store.getIngestStatus()
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/media-ingest/queue', (req, res) => {
    try {
      const queue = store.loadQueue();
      const status = req.query.status;
      const list = status ? queue.filter((q) => q.status === status) : queue;
      return res.json({ ok: true, queue: list.slice(0, 100) });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/media-ingest/sources', (req, res) => {
    try {
      return res.json({ ok: true, sources: store.loadAllSources() });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/media-ingest/run', async (req, res) => {
    try {
      const pin = String(req.body.pin || req.get('X-Media-Ingest-Pin') || req.get('X-Ingest-Secret') || '');
      if (!verifyPin(pin)) {
        return res.status(401).json({ ok: false, error: 'Invalid ingest PIN' });
      }
      const result = await runMediaIngest({
        discoverOnly: !!req.body.discoverOnly,
        limit: req.body.limit
      });
      return res.json(result);
    } catch (err) {
      console.error('media ingest error', err);
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/film-room/feed', (req, res) => {
    try {
      const base = apiBaseFromReq(req);
      const kind = String(req.query.kind || 'all').toLowerCase();
      const playerSlug = req.query.player || req.query.playerSlug;
      const gameSlug = req.query.game || req.query.gameSlug;

      let highlights = [];
      let interviews = [];

      if (kind === 'all' || kind === 'highlights' || kind === 'highlight') {
        highlights = highlightsStore.loadClips({ baseUrl: base, playerSlug, gameSlug });
      }
      if (kind === 'all' || kind === 'interviews' || kind === 'interview') {
        interviews = interviewsStore.loadClips({ baseUrl: base, playerSlug, gameSlug });
      }

      const items = [
        ...highlights.map((c) => ({ ...c, mediaKind: 'highlight' })),
        ...interviews.map((c) => ({ ...c, mediaKind: 'interview' }))
      ].sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

      return res.json({
        ok: true,
        items,
        counts: { highlights: highlights.length, interviews: interviews.length, total: items.length },
        cdnBase: base
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });
}

module.exports = { mountMediaIngestRoutes, verifyPin };
