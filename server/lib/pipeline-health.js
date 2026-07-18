/**
 * Live + ingest + autoposter pipeline health timestamps.
 * Persisted to data/live/pipeline-health.json
 */
const fs = require('fs');
const path = require('path');

function resolveStatusPath() {
  const liveDir = String(process.env.GV_LIVE_DATA_DIR || '').trim();
  if (liveDir) return path.join(liveDir, 'pipeline-health.json');
  try {
    if (process.env.NODE_ENV === 'production' && fs.existsSync('/var/data')) {
      return path.join('/var/data/live', 'pipeline-health.json');
    }
  } catch {
    /* ignore */
  }
  return path.join(__dirname, '..', 'data', 'live', 'pipeline-health.json');
}

const STATUS_PATH = resolveStatusPath();

function nowIso() {
  return new Date().toISOString();
}

function defaultStatus() {
  return {
    version: 1,
    updatedAt: null,
    lastLiveRefresh: null,
    lastArticlePull: null,
    lastBeatPull: null,
    lastBeatLateIngest: null,
    lastPodcastPull: null,
    lastRecruitingIngest: null,
    lastError: null,
    lastLiveRefreshError: null
  };
}

function load() {
  try {
    return { ...defaultStatus(), ...JSON.parse(fs.readFileSync(STATUS_PATH, 'utf8')) };
  } catch {
    return defaultStatus();
  }
}

function save(patch) {
  const next = { ...load(), ...patch, updatedAt: nowIso() };
  fs.mkdirSync(path.dirname(STATUS_PATH), { recursive: true });
  fs.writeFileSync(STATUS_PATH, JSON.stringify(next, null, 2));
  return next;
}

function recordLiveRefresh(results, error) {
  const patch = {
    lastLiveRefresh: nowIso(),
    lastLiveRefreshError: error || null
  };
  if (results) {
    if (results.content != null) patch.lastArticlePull = nowIso();
    if (results.beat && !results.beat.error) patch.lastBeatPull = results.beat.fetchedAt || nowIso();
    if (results.beat && results.beat.error) patch.lastLiveRefreshError = results.beat.error;
    if (results.podcasts && !results.podcasts.error) {
      patch.lastPodcastPull = results.podcasts.fetchedAt || nowIso();
    }
    if (results.recruiting != null || results.intel != null) {
      patch.lastRecruitingIngest = nowIso();
    }
  }
  if (error) patch.lastError = error;
  return save(patch);
}

function getHealthReport() {
  const status = load();
  let beatCache = {};
  let feedItems = [];
  try {
    const liveStore = require('./live-store');
    beatCache = liveStore.loadBeatCache() || {};
    feedItems = liveStore.loadFeedItems() || [];
  } catch {
    beatCache = readJson(path.join(__dirname, '..', 'data', 'live', 'beat-cache.json'), {});
    feedItems = readJson(path.join(__dirname, '..', 'data', 'live', 'feed-items.json'), []);
  }
  const feedCache = { items: feedItems, updatedAt: status.updatedAt || null };
  const on3Snap = readJson(path.join(__dirname, '..', 'data', 'recruiting', 'on3-snapshot.json'), {});
  const articlesRaw = readJson(path.join(__dirname, '..', 'data', 'content', 'articles.json'), []);
  const autoposterStatus = readJson(path.join(__dirname, '..', 'data', 'x', 'autoposter-status.json'), {});
  const autoposterQueue = readJson(path.join(__dirname, '..', 'data', 'x', 'autoposter-queue.json'), { items: [] });

  const published = (Array.isArray(articlesRaw) ? articlesRaw : articlesRaw.articles || []).filter(
    (a) => a.published !== false
  );
  const lastPublished = published
    .map((a) => a.publishedAt || a.date)
    .filter(Boolean)
    .sort()
    .reverse()[0] || null;

  const queueItems = autoposterQueue.items || [];
  const pending = queueItems.filter((i) => i.status === 'pending');
  const lastSent = queueItems
    .filter((i) => i.status === 'sent' && i.sentAt)
    .sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt))[0] || null;

  return {
    ...status,
    beatCache: {
      fetchedAt: beatCache.fetchedAt || null,
      source: beatCache.source || null,
      postCount: (beatCache.posts || []).length,
      error: beatCache.error || null,
      tokenStatus: beatCache.tokenStatus || null
    },
    feed: {
      itemCount: (feedCache.items || []).length,
      updatedAt: feedCache.updatedAt || null
    },
    articles: {
      publishedCount: published.length,
      lastPublishedAt: lastPublished
    },
    on3Ingest: {
      lastRun: on3Snap.lastRun || null,
      enabled: process.env.ON3_INGEST_ENABLED === 'true'
    },
    autoposter: {
      schedulerEnabled: process.env.X_AUTOPOST_ENABLED === 'true',
      ...autoposterStatus,
      queuePending: pending.length,
      queueDue: pending.filter((i) => new Date(i.scheduledAt).getTime() <= Date.now()).length,
      lastSentAt: lastSent?.sentAt || autoposterStatus.lastPostSuccess || null,
      lastSentTweetId: lastSent?.tweetId || null
    }
  };
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function recordBeatLateIngest(result) {
  return save({
    lastBeatLateIngest: nowIso(),
    lastBeatLateProcessed: result?.processedCount || 0
  });
}

/** Beat-only refresh (dedicated cron) — keep lastBeatPull current even when full live-refresh is off. */
function recordBeatPull(result) {
  const patch = {
    lastBeatPull: result?.fetchedAt || nowIso(),
  };
  if (result?.error) patch.lastLiveRefreshError = result.error;
  else if (result && !result.softFailure) patch.lastLiveRefreshError = null;
  return save(patch);
}

module.exports = {
  STATUS_PATH,
  load,
  save,
  recordLiveRefresh,
  recordBeatLateIngest,
  recordBeatPull,
  getHealthReport
};
