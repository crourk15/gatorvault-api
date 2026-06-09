const fetch = require('node-fetch');
const { parseRssItems } = require('./rss-parse');
const store = require('./live-store');
const beatFilters = require('./beat-writer-filters');
const { shouldIncludeBeatPost } = beatFilters;

const NITTER_BASES = (process.env.NITTER_BASES || 'https://nitter.poast.org,https://nitter.privacydev.net')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

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
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchXUserTimeline(handle) {
  const headers = xAuthHeaders();
  if (!headers) return null;
  const userRes = await fetch(
    `https://api.twitter.com/2/users/by/username/${encodeURIComponent(handle)}?user.fields=profile_image_url`,
    { headers }
  );
  if (!userRes.ok) throw new Error(`X user lookup ${userRes.status}`);
  const userJson = await userRes.json();
  const userId = userJson.data?.id;
  if (!userId) return [];

  const tweetsRes = await fetch(
    `https://api.twitter.com/2/users/${userId}/tweets?max_results=10&tweet.fields=created_at,entities&exclude=retweets,replies`,
    { headers }
  );
  if (!tweetsRes.ok) throw new Error(`X tweets ${tweetsRes.status}`);
  const tweetsJson = await tweetsRes.json();
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

async function fetchNitterRss(handle) {
  let lastErr = null;
  for (const base of NITTER_BASES) {
    try {
      const xml = await fetchText(`${base.replace(/\/$/, '')}/${handle}/rss`);
      const items = parseRssItems(xml, 8);
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
  throw lastErr || new Error('Nitter unavailable');
}

async function fetchWriterPosts(writer) {
  try {
    if (getXBearerToken()) {
      const posts = await fetchXUserTimeline(writer.handle);
      if (posts && posts.length) return posts;
      return [];
    }
    return await fetchNitterRss(writer.handle);
  } catch (e) {
    return [];
  }
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

async function refreshBeatStream() {
  const tokenStatus = await validateXBearerToken({ force: true });
  const cache = store.loadBeatCache();
  const writers = store.loadWriters();

  if (!tokenStatus.ok) {
    const { kept } = filterBeatPosts(cache.posts || []);
    const next = {
      posts: kept,
      fetchedAt: store.nowIso(),
      source: 'x_token_error',
      error: tokenStatus.error
    };
    store.saveBeatCache(next);
    return next;
  }

  const all = [];
  let errors = 0;
  let blocked = 0;

  for (const writer of writers) {
    const posts = await fetchWriterPosts(writer);
    if (!posts.length) errors += 1;
    const filtered = filterBeatPosts(posts, { alertBlocks: true });
    blocked += filtered.blocked;
    filtered.kept.forEach((p) => all.push(p));
  }

  all.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

  const purgedExisting = filterBeatPosts(cache.posts || []);
  const merged = (all.length ? all : purgedExisting.kept).slice(0, 80);

  const next = {
    posts: merged,
    fetchedAt: store.nowIso(),
    source: all.length ? 'x' : errors === writers.length ? 'x_empty' : 'x',
    blockedNational: blocked,
    error: all.length ? null : 'X API token is valid but no beat writer posts were returned yet. Retrying on the next poll.'
  };
  store.saveBeatCache(next);

  purgeNonFloridaBeatFromFeed();

  try {
    const { runBeatVisitIntelIngest } = require('./beat-visit-intel-ingest');
    runBeatVisitIntelIngest().catch((err) => console.warn('[visit-intel]', err.message));
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
  validateXBearerToken,
  getXTokenStatus,
  getXBearerToken,
  purgeNonFloridaBeatContent,
  purgeNonFloridaBeatCache,
  purgeNonFloridaBeatFromFeed,
  filterBeatPosts
};
