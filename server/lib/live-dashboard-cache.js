/**
 * In-memory live dashboard snapshot — hot path for GET /api/live/dashboard.
 * Avoids sync file reads during cold starts, deploys, and live-refresh I/O spikes.
 */
const { getDashboard } = require('./live-aggregator');

const REFRESH_MS = parseInt(process.env.LIVE_DASHBOARD_CACHE_MS || '45000', 10);
const DEFAULT_FEED_LIMIT = parseInt(process.env.LIVE_DASHBOARD_FEED_LIMIT || '60', 10);
const BEAT_LIMIT = parseInt(process.env.LIVE_DASHBOARD_BEAT_LIMIT || '24', 10);

let snapshot = null;
let snapshotAt = 0;
let warming = false;
let serverReady = false;
let mobileRefreshSignal = 0;

function bumpMobileRefreshSignal() {
  mobileRefreshSignal = Date.now();
  return mobileRefreshSignal;
}

function getMobileRefreshSignal() {
  return mobileRefreshSignal;
}

function minimalFallback(reason) {
  return {
    feed: [],
    beat: { posts: [], fetchedAt: null, source: null, error: reason || null, tokenStatus: null },
    podcasts: { shows: [], fetchedAt: null, errors: [] },
    updatedAt: new Date().toISOString(),
    stale: true,
    degraded: true,
    cacheReason: reason || 'empty',
    mobileRefreshSignal: getMobileRefreshSignal()
  };
}

function trimBeatPosts(beat) {
  if (!beat || typeof beat !== 'object') return { posts: [], fetchedAt: null, source: null, error: null };
  const posts = (beat.posts || []).slice(0, BEAT_LIMIT).map((p) => ({
    id: p.id,
    writerId: p.writerId,
    writerName: p.writerName,
    handle: p.handle,
    outlet: p.outlet,
    text: p.text,
    url: p.url,
    publishedAt: p.publishedAt,
    source: p.source
  }));
  return {
    posts,
    fetchedAt: beat.fetchedAt || null,
    source: beat.source || null,
    error: beat.error || null,
    tokenStatus: beat.tokenStatus || null,
    writerCount: beat.writerCount
  };
}

function buildSnapshot(feedLimit = DEFAULT_FEED_LIMIT) {
  const raw = getDashboard({ feedLimit: Math.min(Math.max(feedLimit, 10), 80) });
  return {
    feed: raw.feed || [],
    beat: trimBeatPosts(raw.beat),
    podcasts: raw.podcasts || { shows: [], fetchedAt: null, errors: [] },
    updatedAt: raw.updatedAt || new Date().toISOString(),
    stale: false,
    degraded: false,
    cachedAt: new Date().toISOString()
  };
}

function warmDashboardCache(feedLimit = DEFAULT_FEED_LIMIT) {
  if (warming) return snapshot;
  warming = true;
  try {
    snapshot = buildSnapshot(feedLimit);
    snapshotAt = Date.now();
    serverReady = true;
    return snapshot;
  } catch (err) {
    console.warn('[live-dashboard-cache] warm failed:', err.message);
    if (!snapshot) snapshot = minimalFallback(err.message);
    else snapshot = { ...snapshot, stale: true, warmError: err.message };
    serverReady = true;
    return snapshot;
  } finally {
    warming = false;
  }
}

function scheduleAsyncWarm(feedLimit = DEFAULT_FEED_LIMIT) {
  if (warming) return;
  setImmediate(() => {
    try {
      warmDashboardCache(feedLimit);
    } catch (err) {
      console.warn('[live-dashboard-cache] async warm:', err.message);
    }
  });
}

function getCachedDashboard({ feedLimit = DEFAULT_FEED_LIMIT, allowStale = true } = {}) {
  const now = Date.now();
  const stale = !snapshotAt || now - snapshotAt > REFRESH_MS;

  if (!snapshot || stale) {
    scheduleAsyncWarm(feedLimit);
  }

  if (!snapshot) {
    return { ...minimalFallback(snapshot ? 'warming' : 'cache_miss'), ok: true };
  }

  const limit = Math.min(Math.max(parseInt(feedLimit, 10) || DEFAULT_FEED_LIMIT, 10), 80);
  const out = {
    ...snapshot,
    feed: (snapshot.feed || []).slice(0, limit),
    stale: stale || snapshot.stale === true,
    degraded: snapshot.degraded === true,
    cacheAgeMs: snapshotAt ? now - snapshotAt : null,
    mobileRefreshSignal: getMobileRefreshSignal()
  };

  if (!allowStale && out.stale && !warming) {
    scheduleAsyncWarm(limit);
  }

  return out;
}

function isReady() {
  return serverReady && !!snapshot;
}

function getCacheMeta() {
  return {
    ready: isReady(),
    cachedAt: snapshot?.cachedAt || (snapshotAt ? new Date(snapshotAt).toISOString() : null),
    cacheAgeMs: snapshotAt ? Date.now() - snapshotAt : null,
    feedCount: snapshot?.feed?.length || 0,
    beatCount: snapshot?.beat?.posts?.length || 0,
    stale: snapshot?.stale === true,
    mobileRefreshSignal: getMobileRefreshSignal()
  };
}

function scheduleBackgroundRefresh() {
  setInterval(() => {
    try {
      warmDashboardCache();
    } catch (err) {
      console.warn('[live-dashboard-cache] background refresh:', err.message);
    }
  }, REFRESH_MS).unref?.();
}

function clearDashboardCache() {
  snapshot = null;
  snapshotAt = 0;
  warming = false;
  serverReady = false;
}

module.exports = {
  warmDashboardCache,
  getCachedDashboard,
  isReady,
  getCacheMeta,
  scheduleBackgroundRefresh,
  minimalFallback,
  bumpMobileRefreshSignal,
  getMobileRefreshSignal,
  clearDashboardCache,
  REFRESH_MS
};
