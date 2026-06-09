const liveStore = require('./live-store');
const { refreshLiveDashboard, getDashboard } = require('./live-aggregator');

const LIVE_ADMIN_PIN =
  process.env.LIVE_ADMIN_PIN || process.env.RECRUITING_ADMIN_PIN || process.env.CONTENT_ADMIN_PIN || 'GV2026admin';

function verifyAdminPin(pin) {
  return !!pin && pin === LIVE_ADMIN_PIN;
}

function pinFromReq(req) {
  return req.headers['x-live-pin'] || req.headers['x-recruiting-pin'] || req.body?.pin || req.query?.pin;
}

function mountLiveRoutes(app) {
  app.get('/api/live/dashboard', async (req, res) => {
    try {
      const dash = getDashboard({ feedLimit: parseInt(req.query.limit || '60', 10) });
      return res.json({ ok: true, ...dash });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/live/feed', (req, res) => {
    try {
      const feed = liveStore.getFeedItems({
        limit: parseInt(req.query.limit || '50', 10),
        since: req.query.since,
        categoriesOnly: req.query.all !== '1'
      });
      return res.json({ ok: true, feed, updatedAt: liveStore.nowIso() });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/live/beat', (req, res) => {
    try {
      const { getBeatPosts } = require('./live-beat');
      const beat = getBeatPosts(parseInt(req.query.limit || '40', 10));
      return res.json({ ok: true, ...beat });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/live/beat/status', async (req, res) => {
    try {
      const { validateXBearerToken, getXTokenStatus } = require('./live-beat');
      const status = req.query.validate === '1' ? await validateXBearerToken({ force: true }) : getXTokenStatus();
      return res.json({ ok: true, status });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/live/podcasts', (req, res) => {
    try {
      const { getPodcastHub } = require('./live-podcasts');
      return res.json({ ok: true, ...getPodcastHub() });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/live/refresh', async (req, res) => {
    const pin = pinFromReq(req);
    const isCron = req.headers['x-live-cron'] === process.env.LIVE_CRON_SECRET;
    if (!isCron && !verifyAdminPin(pin)) {
      return res.status(401).json({ ok: false, error: 'Invalid admin PIN' });
    }
    try {
      const result = await refreshLiveDashboard();
      return res.json({ ok: true, result, dashboard: getDashboard() });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/live/admin/item', (req, res) => {
    if (!verifyAdminPin(pinFromReq(req))) {
      return res.status(401).json({ ok: false, error: 'Invalid admin PIN' });
    }
    try {
      const item = liveStore.addManualFeedItem(req.body || {});
      return res.json({ ok: true, item });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/live/admin/purge-test', (req, res) => {
    if (!verifyAdminPin(pinFromReq(req))) {
      return res.status(401).json({ ok: false, error: 'Invalid admin PIN' });
    }
    const remaining = liveStore.purgeTestFeedItems();
    return res.json({ ok: true, remaining });
  });

  app.post('/api/live/admin/purge-non-uf-beat', async (req, res) => {
    if (!verifyAdminPin(pinFromReq(req))) {
      return res.status(401).json({ ok: false, error: 'Invalid admin PIN' });
    }
    try {
      const { purgeNonFloridaBeatContent, refreshBeatStream } = require('./live-beat');
      const purged = await purgeNonFloridaBeatContent({ refreshDashboard: true });
      const refreshed = await refreshBeatStream();
      return res.json({ ok: true, purged, refreshed, beat: require('./live-beat').getBeatPosts(40) });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });
}

module.exports = { mountLiveRoutes };
