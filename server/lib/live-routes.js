const liveStore = require('./live-store');
const { refreshLiveDashboard, getDashboard } = require('./live-aggregator');
const gm2 = require('./gm2');

const { verifyAdminPin, pinFromReq: adminPinFromReq } = require('./admin-pin');
const { isIngestCronAuthorized } = require('./ingest-cron-auth');

function pinFromReq(req) {
  return adminPinFromReq(req) || req.headers['x-live-pin'];
}

/** Beat refresh auth — never treat undefined LIVE_CRON_SECRET as a match. */
function isBeatRefreshAuthorized(req) {
  const liveCron = String(process.env.LIVE_CRON_SECRET || '').trim();
  const headerLiveCron = String(req.headers['x-live-cron'] || '').trim();
  if (liveCron && headerLiveCron && headerLiveCron === liveCron) return true;
  if (isIngestCronAuthorized(req)) return true;
  if (verifyAdminPin(pinFromReq(req))) return true;
  return false;
}

function mountLiveRoutes(app) {
  app.get('/api/live/dashboard', (req, res) => {
    const feedLimit = parseInt(req.query.limit || '60', 10) || 60;
    const force = req.query.refresh === '1' || req.query.force === '1';
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    // Keep podcast episode titles warm even when full live-refresh cron is off.
    try {
      const { getPodcastHub, refreshPodcasts } = require('./live-podcasts');
      const hub = getPodcastHub();
      const staleMs = parseInt(process.env.PODCAST_STALE_MS || String(30 * 60 * 1000), 10);
      const age = hub.fetchedAt ? Date.now() - new Date(hub.fetchedAt).getTime() : Infinity;
      if (age > staleMs) {
        void refreshPodcasts()
          .then(() => {
            try {
              require('./live-dashboard-cache').scheduleAsyncWarm();
            } catch {
              /* optional */
            }
          })
          .catch((e) => console.warn('[live/dashboard] podcast refresh:', e.message));
      }
    } catch {
      /* optional */
    }
    try {
      const dashCache = require('./live-dashboard-cache');
      const dash = dashCache.getCachedDashboard({ feedLimit, force });
      if (dash.stale) res.set('X-GV-Dashboard-Stale', '1');
      return res.status(200).json({ ok: true, ...dash });
    } catch (err) {
      try {
        const dashCache = require('./live-dashboard-cache');
        const fallback = dashCache.minimalFallback(err.message);
        res.set('X-GV-Dashboard-Degraded', '1');
        return res.status(200).json({ ok: true, ...fallback, error: err.message });
      } catch {
        return res.status(200).json({
          ok: true,
          feed: [],
          beat: { posts: [] },
          podcasts: { shows: [] },
          updatedAt: new Date().toISOString(),
          degraded: true,
          error: err.message
        });
      }
    }
  });

  app.get('/api/live/dashboard/health', (req, res) => {
    try {
      const dashCache = require('./live-dashboard-cache');
      return res.status(200).json({ ok: true, ...dashCache.getCacheMeta() });
    } catch (err) {
      return res.status(200).json({ ok: true, ready: false, error: err.message });
    }
  });

  app.get('/api/live/feed', (req, res) => {
    try {
      const feed = gm2.filterPublicHeadlines(
        liveStore.getFeedItems({
          limit: parseInt(req.query.limit || '50', 10),
          since: req.query.since,
          categoriesOnly: req.query.all !== '1'
        })
      );
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      return res.json({ ok: true, feed, updatedAt: liveStore.nowIso() });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  /** GNL client alias — same live dashboard snapshot with forced cache refresh. */
  app.get('/api/gnl/feed', (req, res) => {
    const feedLimit = parseInt(req.query.limit || '40', 10) || 40;
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    try {
      const dashCache = require('./live-dashboard-cache');
      const dash = dashCache.getCachedDashboard({ feedLimit, force: true });
      if (dash.stale) res.set('X-GV-Dashboard-Stale', '1');
      return res.status(200).json({
        ok: true,
        feed: dash.feed || [],
        beat: dash.beat || { posts: [] },
        podcasts: dash.podcasts || { shows: [] },
        updatedAt: dash.updatedAt || liveStore.nowIso(),
        refreshedAt: dash.refreshedAt || liveStore.nowIso(),
        cacheAgeMs: dash.cacheAgeMs ?? null
      });
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
      const liveBeat = require('./live-beat');
      const liveStore = require('./live-store');
      const cache = liveStore.loadBeatCache();
      const status =
        req.query.validate === '1'
          ? await liveBeat.validateXBearerToken({ force: true })
          : liveBeat.getXTokenStatus();
      return res.json({
        ok: true,
        status,
        cache: {
          fetchedAt: cache.fetchedAt || null,
          postCount: (cache.posts || []).length,
          source: cache.source || null,
          error: cache.error || null,
          tokenStatus: cache.tokenStatus || null
        },
        env: {
          bearerConfigured: !!(process.env.X_BEARER_TOKEN || process.env.TWITTER_BEARER_TOKEN),
          nitterBases: (process.env.NITTER_BASES || '').split(',').filter(Boolean).length
        }
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/live/beat/refresh', async (req, res) => {
    if (!isBeatRefreshAuthorized(req)) {
      return res.status(401).json({ ok: false, error: 'Invalid admin PIN or cron secret' });
    }
    try {
      const liveBeat = require('./live-beat');
      const refreshed = await liveBeat.refreshBeatStream();
      const beat = liveBeat.getBeatPosts(parseInt(req.query.limit || '40', 10));
      try {
        const pipelineHealth = require('./pipeline-health');
        pipelineHealth.recordBeatPull(refreshed);
      } catch (healthErr) {
        console.warn('[live/beat/refresh] pipeline health:', healthErr.message);
      }
      try {
        const dashCache = require('./live-dashboard-cache');
        // Async only — sync clear+warm on the cron path blocked /health (~5s)
        // and crash-looped Render during App Review (HTML 502 on every route).
        dashCache.bumpMobileRefreshSignal();
        dashCache.scheduleAsyncWarm();
      } catch (cacheErr) {
        console.warn('[live/beat/refresh] dashboard cache warm:', cacheErr.message);
      }
      return res.json({ ok: true, refreshed, beat });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/live/podcasts', async (req, res) => {
    try {
      const { getPodcastHub, refreshPodcasts } = require('./live-podcasts');
      const staleMs = parseInt(process.env.PODCAST_STALE_MS || String(30 * 60 * 1000), 10);
      const force = req.query.refresh === '1' || req.query.refresh === 'true';
      let hub = getPodcastHub();
      const age = hub.fetchedAt ? Date.now() - new Date(hub.fetchedAt).getTime() : Infinity;
      if (force || age > staleMs) {
        try {
          hub = await refreshPodcasts();
        } catch (refreshErr) {
          console.warn('[live/podcasts] RSS refresh failed:', refreshErr.message);
        }
      }
      return res.json({ ok: true, cacheKey: 'live:podcasts', ...hub });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/live/pipeline/health', (req, res) => {
    try {
      const pipelineHealth = require('./pipeline-health');
      const report = pipelineHealth.getHealthReport();
      const staleMs = parseInt(process.env.PIPELINE_STALE_MS || String(15 * 60 * 1000), 10);
      const now = Date.now();
      function isStale(iso) {
        if (!iso) return true;
        return now - new Date(iso).getTime() > staleMs;
      }
      return res.json({
        ok: true,
        staleThresholdMs: staleMs,
        health: report,
        checks: {
          liveRefreshStale: isStale(report.lastLiveRefresh),
          articlePullStale: isStale(report.lastArticlePull),
          beatPullStale: isStale(report.lastBeatPull || report.beatCache?.fetchedAt),
          autoposterStale: isStale(
            report.autoposter?.lastSentAt ||
              report.autoposter?.lastPostSuccess ||
              report.autoposter?.lastPostAt
          ),
          autoposterSchedulerStale: isStale(report.autoposter?.lastRun),
          autoposterEnabled: report.autoposter?.schedulerEnabled === true,
          beatError: report.beatCache?.error || report.lastLiveRefreshError || null,
          autoposterError: report.autoposter?.lastError || null
        }
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/live/refresh', async (req, res) => {
    if (!isBeatRefreshAuthorized(req)) {
      return res.status(401).json({ ok: false, error: 'Invalid admin PIN' });
    }
    try {
      const result = await refreshLiveDashboard();
      return res.json({ ok: true, result, dashboard: getDashboard() });
    } catch (err) {
      console.error('[live/refresh] soft failure:', err.message);
      let dashboard = null;
      try {
        dashboard = getDashboard();
      } catch (e) {
        dashboard = null;
      }
      return res.status(200).json({
        ok: false,
        softFailure: true,
        error: err.message,
        dashboard,
        cached: true,
      });
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

  app.post('/api/live/admin/purge-headlines', async (req, res) => {
    if (!verifyAdminPin(pinFromReq(req))) {
      return res.status(401).json({ ok: false, error: 'Invalid admin PIN' });
    }
    try {
      const { runPurgeInvalidHeadlines } = require('./recruiting-public-alerts');
      const result = await runPurgeInvalidHeadlines({ refresh: req.body?.refresh !== false });
      return res.json({ ok: true, ...result, dashboard: getDashboard() });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/live/admin/purge-test', (req, res) => {
    if (!verifyAdminPin(pinFromReq(req))) {
      return res.status(401).json({ ok: false, error: 'Invalid admin PIN' });
    }
    const remaining = liveStore.purgeTestFeedItems();
    return res.json({ ok: true, remaining });
  });

  app.post('/api/live/admin/mobile-refresh-signal', (req, res) => {
    if (!verifyAdminPin(pinFromReq(req))) {
      return res.status(401).json({ ok: false, error: 'Invalid admin PIN' });
    }
    try {
      const dashCache = require('./live-dashboard-cache');
      const signal = dashCache.bumpMobileRefreshSignal();
      return res.json({ ok: true, mobileRefreshSignal: signal });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/live/admin/purge-non-uf-beat', async (req, res) => {
    if (!verifyAdminPin(pinFromReq(req))) {
      return res.status(401).json({ ok: false, error: 'Invalid admin PIN' });
    }
    try {
      const { purgeNonFloridaBeatContent } = require('./live-beat');
      const purged = await purgeNonFloridaBeatContent({ refreshDashboard: true });
      const refreshed = await require('./live-beat').refreshBeatStream();
      return res.json({ ok: true, purged, refreshed, beat: require('./live-beat').getBeatPosts(40) });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });
}

module.exports = { mountLiveRoutes };
