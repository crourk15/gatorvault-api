const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const { parseRssItems } = require('./rss-parse');
const { withRetries } = require('./ingest-resilience');
const store = require('./live-store');
const beatFilters = require('./beat-writer-filters');
const ingestGate = require('./beat-recruiting-ingest-gate');
const { shouldIncludeBeatPost } = beatFilters;

const NITTER_BASES = (process.env.NITTER_BASES || 'https://nitter.poast.org,https://nitter.privacydev.net')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

/** Default tweets pulled per writer — keep low to conserve X API credits. */
const DEFAULT_MAX_POSTS = Math.min(
  20,
  Math.max(5, parseInt(process.env.X_BEAT_MAX_POSTS_PER_WRITER || '5', 10) || 5)
);
const NATIONAL_MAX_POSTS = Math.min(
  DEFAULT_MAX_POSTS,
  Math.max(3, parseInt(process.env.X_BEAT_NATIONAL_MAX_POSTS || '3', 10) || 3)
);

/** Multi-sport / national accounts — fewer tweets (most get filtered as non-UF-football). */
const CREDIT_THROTTLED_HANDLES = new Set([
  ...beatFilters.NATIONAL_UF_ONLY_HANDLES,
  ...beatFilters.REQUIRES_UF_CONTEXT_HANDLES,
  'floridagators',
  'ufathletics',
  'on3recruits',
  'rivalsportal',
  'ejhollandon3'
]);

/** Skip polling multi-sport athletics accounts (GatorsFB covers football official). */
const SKIP_FETCH_HANDLES = new Set(
  String(process.env.X_BEAT_SKIP_HANDLES || 'floridagators,ufathletics')
    .split(',')
    .map((s) => s.trim().toLowerCase().replace(/^@/, ''))
    .filter(Boolean)
);

const USER_ID_CACHE_PATH = path.join(__dirname, '..', 'data', 'live', 'x-user-ids.json');
let _userIdCache = null;

function loadUserIdCache() {
  if (_userIdCache) return _userIdCache;
  try {
    _userIdCache = JSON.parse(fs.readFileSync(USER_ID_CACHE_PATH, 'utf8'));
  } catch {
    _userIdCache = {};
  }
  return _userIdCache;
}

function saveUserIdCache() {
  try {
    fs.mkdirSync(path.dirname(USER_ID_CACHE_PATH), { recursive: true });
    fs.writeFileSync(USER_ID_CACHE_PATH, JSON.stringify(_userIdCache || {}, null, 2));
  } catch (e) {
    console.warn('[live-beat] user id cache write failed:', e.message);
  }
}

function maxPostsForHandle(handle) {
  const h = String(handle || '')
    .toLowerCase()
    .replace(/^@/, '');
  if (CREDIT_THROTTLED_HANDLES.has(h)) return NATIONAL_MAX_POSTS;
  return DEFAULT_MAX_POSTS;
}

let _xTokenStatus = {
  configured: false,
  ok: false,
  error: null,
  checkedAt: null
};

function getXBearerToken() {
  const rawToken = process.env.X_BEARER_TOKEN || process.env.TWITTER_BEARER_TOKEN;
  if (!rawToken) return null;
  return rawToken.trim();
}

function xAuthHeaders() {
  const rawToken = getXBearerToken();
  if (!rawToken) return null;
  return { Authorization: `Bearer ${rawToken}` };
}

async function validateXBearerToken({ force = false } = {}) {
  const headers = xAuthHeaders();
  if (!headers) {
    _xTokenStatus = {
      configured: false,
      ok: false,
      error:
        'X_BEARER_TOKEN is not set. In Render → gatorvault-api → Environment, add X_BEARER_TOKEN with your Twitter API v2 Bearer Token, then redeploy.',
      checkedAt: store.nowIso()
    };
    return _xTokenStatus;
  }

  const stale =
    !_xTokenStatus.checkedAt ||
    Date.now() - new Date(_xTokenStatus.checkedAt).getTime() > 5 * 60 * 1000;
  if (!force && _xTokenStatus.configured && _xTokenStatus.ok && !stale) {
    return _xTokenStatus;
  }

  try {
    const res = await fetch('https://api.twitter.com/2/users/by/username/Corey_Bender', { headers });
    if (res.status === 401 || res.status === 403) {
      _xTokenStatus = {
        configured: true,
        ok: false,
        error: `X_BEARER_TOKEN was rejected (HTTP ${res.status}). Regenerate the Bearer Token in the X Developer Portal and update Render.`,
        checkedAt: store.nowIso()
      };
      return _xTokenStatus;
    }
    if (res.status === 402) {
      _xTokenStatus = {
        configured: true,
        ok: false,
        error:
          'X API credits depleted (HTTP 402). Restore posting/read credits in the X Developer Portal billing plan.',
        checkedAt: store.nowIso()
      };
      return _xTokenStatus;
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      _xTokenStatus = {
        configured: true,
        ok: false,
        error: `X API validation failed (HTTP ${res.status})${body ? `: ${body.slice(0, 120)}` : ''}.`,
        checkedAt: store.nowIso()
      };
      return _xTokenStatus;
    }
    _xTokenStatus = {
      configured: true,
      ok: true,
      error: null,
      checkedAt: store.nowIso()
    };
    return _xTokenStatus;
  } catch (e) {
    _xTokenStatus = {
      configured: true,
      ok: false,
      error: `X API unreachable: ${e.message}`,
      checkedAt: store.nowIso()
    };
    return _xTokenStatus;
  }
}

function getXTokenStatus() {
  return { ..._xTokenStatus };
}

async function fetchText(url, timeoutMs = 12000) {
  return withRetries(
    async () => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        const res = await fetch(url, {
          signal: ctrl.signal,
          headers: {
            'User-Agent': 'GatorVaultLive/1.0 (+https://gatorvaultinsider.com)',
            Accept: 'application/rss+xml, application/xml, text/xml, */*'
          }
        });
        if (!res.ok) {
          const err = new Error(`HTTP ${res.status}`);
          err.status = res.status;
          throw err;
        }
        return await res.text();
      } finally {
        clearTimeout(timer);
      }
    },
    { label: `fetch ${url}`, attempts: 3, baseDelayMs: 1000 }
  );
}

async function resolveXUserId(handle, headers) {
  const key = String(handle || '')
    .toLowerCase()
    .replace(/^@/, '');
  const cache = loadUserIdCache();
  if (cache[key]?.id) return cache[key].id;

  const userJson = await withRetries(
    async () => {
      const userRes = await fetch(
        `https://api.twitter.com/2/users/by/username/${encodeURIComponent(handle)}?user.fields=profile_image_url`,
        { headers }
      );
      if (!userRes.ok) {
        const err = new Error(`X user lookup ${userRes.status}`);
        err.status = userRes.status;
        throw err;
      }
      return userRes.json();
    },
    { label: `X user @${handle}`, attempts: 2, baseDelayMs: 1000 }
  );

  const userId = userJson.data?.id;
  if (!userId) return null;
  cache[key] = { id: userId, cachedAt: store.nowIso() };
  _userIdCache = cache;
  saveUserIdCache();
  return userId;
}

async function fetchXUserTimeline(handle, { maxPosts } = {}) {
  const headers = xAuthHeaders();
  if (!headers) return null;

  const capped = maxPosts != null ? maxPosts : maxPostsForHandle(handle);
  const userId = await resolveXUserId(handle, headers);
  if (!userId) return [];

  const maxResults = Math.min(100, Math.max(5, capped));
  const tweetsJson = await withRetries(
    async () => {
      const tweetsRes = await fetch(
        `https://api.twitter.com/2/users/${userId}/tweets?max_results=${maxResults}&tweet.fields=created_at,entities&exclude=retweets,replies`,
        { headers }
      );
      if (!tweetsRes.ok) {
        const err = new Error(`X tweets ${tweetsRes.status}`);
        err.status = tweetsRes.status;
        // Don't burn retries on credit/auth failures
        if (tweetsRes.status === 402 || tweetsRes.status === 401 || tweetsRes.status === 403) {
          err.noRetry = true;
        }
        throw err;
      }
      return tweetsRes.json();
    },
    { label: `X tweets @${handle}`, attempts: 2, baseDelayMs: 1000 }
  );
  const writer = store.loadWriters().find((w) => w.handle.toLowerCase() === handle.toLowerCase());
  return (tweetsJson.data || []).map((t) => {
    const attachmentUrls = (t.entities?.urls || []).map((u) => u.expanded_url || u.url).filter(Boolean);
    return {
      id: `x_${t.id}`,
      writerId: writer?.id || handle,
      writerName: writer?.name || handle,
      handle,
      outlet: writer?.outlet || '',
      text: t.text,
      url: `https://x.com/${handle}/status/${t.id}`,
      publishedAt: t.created_at,
      source: 'x',
      attachmentUrls
    };
  });
}

async function fetchNitterRss(handle, { maxPosts = 8 } = {}) {
  const cached = (store.loadBeatCache().posts || []).filter(
    (p) => String(p.handle || '').toLowerCase() === String(handle).toLowerCase()
  );
  let lastErr = null;
  for (const base of NITTER_BASES) {
    try {
      const xml = await fetchText(`${base.replace(/\/$/, '')}/${handle}/rss`);
      const items = parseRssItems(xml, Math.min(25, Math.max(5, maxPosts)));
      const writer = store.loadWriters().find((w) => w.handle.toLowerCase() === handle.toLowerCase());
      return items.map((item) => ({
        id: `nitter_${handle}_${item.id}`,
        writerId: writer?.id || handle,
        writerName: writer?.name || handle,
        handle,
        outlet: writer?.outlet || '',
        text: item.title || item.summary,
        url: item.link,
        publishedAt: item.publishedAt,
        source: 'nitter'
      }));
    } catch (e) {
      lastErr = e;
    }
  }
  if (cached.length) return cached;
  throw lastErr || new Error('Nitter unavailable');
}

async function fetchWriterPosts(writer, { maxPosts } = {}) {
  const capped = maxPosts != null ? maxPosts : maxPostsForHandle(writer.handle);
  try {
    if (getXBearerToken()) {
      try {
        const posts = await fetchXUserTimeline(writer.handle, { maxPosts: capped });
        if (posts && posts.length) return posts;
      } catch (e) {
        /* fall through to Nitter */
      }
    }
    return await fetchNitterRss(writer.handle, { maxPosts: capped });
  } catch (e) {
    return [];
  }
}

/** Fetch last N posts per writer directly (for late-ingest sweep). */
async function fetchAllWriterPostsFresh({ maxPostsPerWriter = 20 } = {}) {
  const tokenStatus = await validateXBearerToken({ force: false });
  const writers = store.loadWriters().filter(isAllowedFetchWriter);
  const all = [];
  let errors = 0;

  for (const writer of writers) {
    const posts = await fetchWriterPosts(writer, { maxPosts: maxPostsPerWriter });
    if (!posts.length) errors += 1;
    posts.forEach((p) => all.push(p));
  }

  all.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  return {
    posts: all,
    writerCount: writers.length,
    fetchErrors: errors,
    tokenStatus: { configured: tokenStatus.configured, ok: tokenStatus.ok }
  };
}

function recordBlockedNationalPost(post, reason) {
  if (!beatFilters.isNationalUfOnlyReporter(post)) return;
  try {
    const monitoring = require('./recruiting-monitoring');
    monitoring
      .sendMonitoringAlert({
        level: 'info',
        type: 'national_skip',
        reason: reason === 'hard_block_non_uf' ? 'Non-Florida content (hard block)' : 'Non-Florida content',
        source: post.writerName || post.handle || 'national_beat',
        player: post.writerName || post.handle,
        detail: String(post.text || '').slice(0, 280),
        meta: { handle: post.handle, blockReason: reason, postId: post.id }
      })
      .catch((e) => console.warn('[live-beat] monitoring alert failed:', e.message));
  } catch {
    /* optional */
  }
}

function filterBeatPosts(posts, { alertBlocks = false } = {}) {
  const kept = [];
  let blocked = 0;
  for (const post of posts || []) {
    const include = shouldIncludeBeatPost(post, {
      onBlock: alertBlocks ? recordBlockedNationalPost : null
    });
    if (include) kept.push(post);
    else blocked += 1;
  }
  return { kept, blocked };
}

function purgeNonFloridaBeatFromFeed() {
  return store.removeFeedItemsMatching((item) => {
    if (item.type !== 'beat') return false;
    const post = {
      text: item.summary || item.title || '',
      title: item.title,
      writerName: item.author || item.meta?.writerName,
      handle: item.meta?.handle,
      url: item.source_url
    };
    return !shouldIncludeBeatPost(post);
  });
}

function purgeNonFloridaBeatCache() {
  const cache = store.loadBeatCache();
  const before = (cache.posts || []).length;
  const { kept, blocked } = filterBeatPosts(cache.posts || [], { alertBlocks: false });
  if (blocked > 0 || kept.length !== before) {
    store.saveBeatCache({
      ...cache,
      posts: kept,
      fetchedAt: store.nowIso(),
      purgedAt: store.nowIso(),
      purgedCount: blocked
    });
  }
  return { before, after: kept.length, removed: blocked };
}

async function purgeNonFloridaBeatContent({ refreshDashboard = true } = {}) {
  const cacheResult = purgeNonFloridaBeatCache();
  const feedResult = purgeNonFloridaBeatFromFeed();
  let refreshed = null;
  if (refreshDashboard) {
    try {
      const { refreshLiveDashboard } = require('./live-aggregator');
      refreshed = await refreshLiveDashboard({ beat: true, podcasts: false, recruiting: false });
    } catch (e) {
      refreshed = { error: e.message };
    }
  }
  return { cacheResult, feedResult, refreshed };
}

function isAllowedFetchWriter(writer) {
  const handle = String(writer?.handle || '')
    .toLowerCase()
    .replace(/^@/, '');
  if (SKIP_FETCH_HANDLES.has(handle)) return false;
  return ingestGate.isAllowedIngestAccount({
    handle: writer.handle,
    writerId: writer.id,
    writerName: writer.name,
    outlet: writer.outlet,
  });
}

async function refreshBeatStream() {
  const cache = store.loadBeatCache();
  try {
    return await refreshBeatStreamInner(cache);
  } catch (err) {
    console.warn('[live-beat] refresh soft failure, keeping cache:', err.message);
    const purgedExisting = filterBeatPosts(cache.posts || []);
    return {
      postCount: purgedExisting.kept.length,
      source: cache.source || 'cache',
      error: err.message,
      softFailure: true,
      cached: true,
    };
  }
}

async function refreshBeatStreamInner(cache) {
  const tokenStatus = await validateXBearerToken({ force: false });
  const writers = store.loadWriters().filter(isAllowedFetchWriter);
  const hasBearer = !!getXBearerToken() && tokenStatus.ok;

  const all = [];
  let errors = 0;
  let blocked = 0;
  let nitterHits = 0;
  let xHits = 0;

  for (const writer of writers) {
    const posts = await fetchWriterPosts(writer);
    if (!posts.length) errors += 1;
    posts.forEach((p) => {
      if (p.source === 'nitter') nitterHits += 1;
      else if (p.source === 'x') xHits += 1;
    });
    const filtered = filterBeatPosts(posts, { alertBlocks: true });
    blocked += filtered.blocked;
    filtered.kept.forEach((p) => all.push(p));
  }

  all.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

  const purgedExisting = filterBeatPosts(cache.posts || []);
  const merged = (all.length ? all : purgedExisting.kept).slice(0, 80);

  let source = 'nitter';
  if (xHits > 0) source = 'x';
  else if (nitterHits > 0) source = 'nitter';
  else if (hasBearer) source = 'x_empty';
  else if (!getXBearerToken()) source = 'nitter';

  let error = null;
  if (!all.length) {
    if (!getXBearerToken()) {
      error =
        errors === writers.length
          ? 'X_BEARER_TOKEN not set and Nitter fallback returned no posts. Check NITTER_BASES or add Bearer token on Render.'
          : 'X_BEARER_TOKEN not set — using Nitter fallback. No new beat posts this cycle.';
    } else if (!tokenStatus.ok) {
      error = `${tokenStatus.error} Nitter fallback also returned no posts.`;
    } else {
      error = 'Beat fetch returned no posts this cycle (X API + Nitter). Retrying on next poll.';
    }
  } else if (!hasBearer) {
    error = null;
  }

  const next = {
    posts: merged,
    fetchedAt: store.nowIso(),
    source,
    blockedNational: blocked,
    error,
    tokenStatus: { configured: tokenStatus.configured, ok: tokenStatus.ok }
  };
  store.saveBeatCache(next);

  try {
    const dashCache = require('./live-dashboard-cache');
    dashCache.clearDashboardCache();
    dashCache.warmDashboardCache();
    dashCache.bumpMobileRefreshSignal();
  } catch (e) {
    console.warn('[live-beat] dashboard cache refresh failed:', e.message);
  }

  try {
    if (process.env.X_INSIDER_STYLE_AUTO_REFRESH !== 'false' && merged.length) {
      const styleCorpus = require('./autoposter/insider-style-corpus');
      styleCorpus.refreshFromPosts(merged, { source: next.source || 'beat-cache' });
    }
  } catch (e) {
    console.warn('[live-beat] insider style corpus refresh failed:', e.message);
  }

  console.log('[live-beat] refresh complete', {
    posts: merged.length,
    source: next.source,
    xHits,
    nitterHits,
    error: next.error || null,
    tokenOk: tokenStatus.ok
  });

  purgeNonFloridaBeatFromFeed();

  try {
    const { runBeatVisitIntelIngest } = require('./beat-visit-intel-ingest');
    runBeatVisitIntelIngest().catch((err) => console.warn('[visit-intel]', err.message));
  } catch {
    /* optional */
  }

  try {
    // Optional — heavy identity/intel work can OOM Starter right after a successful beat pull.
    // Dedicated beat-ingest cron still runs this as its own step.
    if (process.env.BEAT_WRITER_INGEST_ON_REFRESH === 'true') {
      const { runBeatWriterIngest } = require('./beat-writer-ingest');
      runBeatWriterIngest().catch((err) => console.warn('[beat-writer-ingest]', err.message));
    }
  } catch {
    /* optional */
  }

  merged.slice(0, 30).forEach((post) => {
    if (!shouldIncludeBeatPost(post)) return;
    store.upsertFeedItem({
      id: post.id,
      dedupeKey: post.id,
      type: 'beat',
      title: `${post.writerName}: ${String(post.text || '').slice(0, 120)}`,
      summary: post.text,
      source_url: post.url || null,
      imageUrl: null,
      source: post.source,
      author: post.writerName,
      createdAt: post.publishedAt,
      meta: { handle: post.handle, outlet: post.outlet }
    });
  });

  return next;
}

function getBeatPosts(limit = 40) {
  const cache = store.loadBeatCache();
  const tokenStatus = getXTokenStatus();
  const { kept } = filterBeatPosts(cache.posts || []);
  return {
    posts: kept.slice(0, limit),
    fetchedAt: cache.fetchedAt,
    source: cache.source,
    error: cache.error || (!tokenStatus.ok ? tokenStatus.error : null),
    tokenStatus
  };
}

module.exports = {
  refreshBeatStream,
  getBeatPosts,
  fetchWriterPosts,
  fetchAllWriterPostsFresh,
  validateXBearerToken,
  getXTokenStatus,
  getXBearerToken,
  purgeNonFloridaBeatContent,
  purgeNonFloridaBeatCache,
  purgeNonFloridaBeatFromFeed,
  filterBeatPosts
};
