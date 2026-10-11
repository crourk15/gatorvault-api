/**
 * In-memory live dashboard snapshot — hot path for GET /api/live/dashboard.
 * Avoids sync file reads during cold starts, deploys, and live-refresh I/O spikes.
 */
const { getDashboard } = require('./live-aggregator');

const REFRESH_MS = parseInt(process.env.LIVE_DASHBOARD_CACHE_MS || '45000', 10);
const DEFAULT_FEED_LIMIT = parseInt(process.env.LIVE_DASHBOARD_FEED_LIMIT || '60', 10);
const BEAT_LIMIT = parseInt(process.env.LIVE_DASHBOARD_BEAT_LIMIT || '24', 10);
const PODCAST_EPISODE_LIMIT = 2;
const PODCAST_DESCRIPTION_LIMIT = 160;
const WARM_WAIT_MS = Math.max(
  200,
  parseInt(process.env.LIVE_DASHBOARD_WARM_WAIT_MS || '1200', 10) || 1200
);

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

function trimDashboardPodcasts(podcasts) {
  const shows = Array.isArray(podcasts?.shows) ? podcasts.shows : [];
  return {
    shows: shows.map((show) => {
      const episodes = (Array.isArray(show.episodes) ? show.episodes : [])
        .slice(0, PODCAST_EPISODE_LIMIT)
        .map((ep) => ({
          id: ep.id,
          showId: ep.showId,
          showName: ep.showName,
          title: ep.title,
          description: String(ep.description || '').slice(0, PODCAST_DESCRIPTION_LIMIT),
          imageUrl: ep.imageUrl || null,
          playUrl: ep.playUrl || null,
          publishedAt: ep.publishedAt || null
        }));
      return {
        id: show.id,
        name: show.name,
        siteUrl: show.siteUrl || null,
        imageUrl: show.imageUrl || null,
        platforms: Array.isArray(show.platforms) ? show.platforms : [],
        episodes
      };
    }),
    fetchedAt: podcasts?.fetchedAt || null,
    errors: podcasts?.errors || []
  };
}

function beatPostsToFeedItems(posts) {
  return (posts || [])
    .filter((post) => String(post?.text || '').trim())
    .slice()
    .sort((a, b) => (Date.parse(b.publishedAt || '') || 0) - (Date.parse(a.publishedAt || '') || 0))
    .map((post) => {
      const writer = post.writerName || post.handle || post.outlet || 'Beat';
      const text = String(post.text || '').trim();
      return {
        id: post.id || post.url || `beat-${writer}`,
        type: 'beat',
        title: `${writer}: ${text}`,
        summary: text.slice(0, 280),
        source: post.outlet || writer,
        url: post.url || null,
        createdAt: post.publishedAt || null,
        author: writer
      };
    });
}

/** Beat posts lead the stream so GNL paints writer news ahead of older rankings rows. */
function leadFeedWithBeat(feed, posts, limit) {
  const cap = Math.min(Math.max(parseInt(limit, 10) || 40, 10), 80);
  const seen = new Set();
  const out = [];
  for (const item of [...beatPostsToFeedItems(posts), ...(feed || [])]) {
    const title = String(item?.title || '').trim();
    if (!title) continue;
    const idKey = String(item.id || '').trim().toLowerCase();
    const titleKey = title.toLowerCase();
    if (idKey && seen.has(`id:${idKey}`)) continue;
    if (seen.has(`t:${titleKey}`)) continue;
    if (idKey) seen.add(`id:${idKey}`);
    seen.add(`t:${titleKey}`);
    out.push({ ...item, title });
    if (out.length >= cap) break;
  }
  return out;
}

function snapshotHasLiveNews(snap) {
  if (!snap) return false;
  const feedCount = Array.isArray(snap.feed) ? snap.feed.length : 0;
  const beatCount = Array.isArray(snap.beat?.posts) ? snap.beat.posts.length : 0;
  return feedCount + beatCount > 0;
}

function buildSnapshot(feedLimit = DEFAULT_FEED_LIMIT) {
  const limit = Math.min(Math.max(feedLimit, 10), 80);
  const raw = getDashboard({ feedLimit: limit });
  const beat = trimBeatPosts(raw.beat);
  return {
    feed: leadFeedWithBeat(raw.feed || [], beat.posts, limit),
    beat,
    podcasts: trimDashboardPodcasts(raw.podcasts),
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

function getCachedDashboard({ feedLimit = DEFAULT_FEED_LIMIT, allowStale = true, force = false } = {}) {
  const now = Date.now();
  const stale = force || !snapshotAt || now - snapshotAt > REFRESH_MS;
  const limit = Math.min(Math.max(parseInt(feedLimit, 10) || DEFAULT_FEED_LIMIT, 10), 80);

  // Never sync-warm on the request path — warmDashboardCache blocks the event loop
  // long enough for Render's ~5s /health probe to kill the process (502 crash loop).
  if (!snapshot || stale) {
    scheduleAsyncWarm(limit);
  }

  const cacheAgeMs = snapshotAt ? Date.now() - snapshotAt : null;
  const stillStale = force ? false : cacheAgeMs == null || cacheAgeMs > REFRESH_MS;

  if (!snapshot) {
    return { ...minimalFallback('warming'), ok: true, stale: true };
  }

  const out = {
    ...snapshot,
    feed: (snapshot.feed || []).slice(0, limit),
    stale: stillStale || snapshot.stale === true,
    degraded: snapshot.degraded === true,
    cacheAgeMs,
    mobileRefreshSignal: getMobileRefreshSignal(),
    refreshedAt: new Date().toISOString()
  };

  if (!allowStale && out.stale && !warming) {
    scheduleAsyncWarm(limit);
  }

  return out;
}

/**
 * Cold GET only. getCachedDashboard stays synchronous and must not call getDashboard.
 * If that call scheduled an async warm, wait briefly so the phone gets beat news
 * instead of an empty warming body that locks the July seed until the next poll.
 */
function waitForDashboardNews(maxMs = WARM_WAIT_MS) {
  if (snapshotHasLiveNews(snapshot)) return Promise.resolve(snapshot);
  const budget = Math.max(0, Number(maxMs) || 0);
  return new Promise((resolve) => {
    const start = Date.now();
    const timer = setInterval(() => {
      if (snapshotHasLiveNews(snapshot) || Date.now() - start >= budget) {
        clearInterval(timer);
        resolve(snapshot);
      }
    }, 40);
  });
}

async function getDashboardForRequest(opts = {}) {
  const first = getCachedDashboard(opts);
  if (snapshotHasLiveNews(first)) return first;
  await waitForDashboardNews(WARM_WAIT_MS);
  return getCachedDashboard({ ...opts, force: false });
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
  // Opt-in — a 45s sync warm loop was crash-looping Render /health after boot.
  if (process.env.LIVE_DASHBOARD_BACKGROUND_REFRESH !== 'true') {
    console.log('[live-dashboard-cache] background refresh off (set LIVE_DASHBOARD_BACKGROUND_REFRESH=true)');
    return;
  }
  setInterval(() => {
    // Async only — sync warm here was stalling /health during App Review.
    scheduleAsyncWarm();
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
  getDashboardForRequest,
  waitForDashboardNews,
  leadFeedWithBeat,
  trimDashboardPodcasts,
  snapshotHasLiveNews,
  isReady,
  getCacheMeta,
  scheduleBackgroundRefresh,
  scheduleAsyncWarm,
  minimalFallback,
  bumpMobileRefreshSignal,
  getMobileRefreshSignal,
  clearDashboardCache,
  REFRESH_MS,
  WARM_WAIT_MS
};
