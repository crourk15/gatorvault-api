const fetch = require('node-fetch');
const { parseRssItems } = require('./rss-parse');
const store = require('./live-store');

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
  const envToken = process.env.X_BEARER_TOKEN || process.env.TWITTER_BEARER_TOKEN || null;
  if (!envToken) return null;
  try {
    return decodeURIComponent(envToken);
  } catch {
    return envToken;
  }
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
  return (tweetsJson.data || []).map((t) => ({
    id: `x_${t.id}`,
    writerId: writer?.id || handle,
    writerName: writer?.name || handle,
    handle,
    outlet: writer?.outlet || '',
    text: t.text,
    url: `https://x.com/${handle}/status/${t.id}`,
    publishedAt: t.created_at,
    source: 'x'
  }));
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

async function refreshBeatStream() {
  const tokenStatus = await validateXBearerToken({ force: true });
  const cache = store.loadBeatCache();
  const writers = store.loadWriters();

  if (!tokenStatus.ok) {
    const next = {
      posts: cache.posts || [],
      fetchedAt: store.nowIso(),
      source: 'x_token_error',
      error: tokenStatus.error
    };
    store.saveBeatCache(next);
    return next;
  }

  const all = [];
  let errors = 0;

  for (const writer of writers) {
    const posts = await fetchWriterPosts(writer);
    if (!posts.length) errors += 1;
    posts.forEach((p) => all.push(p));
  }

  all.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

  const merged = all.length ? all.slice(0, 80) : cache.posts || [];
  const next = {
    posts: merged,
    fetchedAt: store.nowIso(),
    source: all.length ? 'x' : errors === writers.length ? 'x_empty' : 'x',
    error: all.length ? null : 'X API token is valid but no beat writer posts were returned yet. Retrying on the next poll.'
  };
  store.saveBeatCache(next);

  merged.slice(0, 30).forEach((post) => {
    store.upsertFeedItem({
      id: post.id,
      dedupeKey: post.id,
      type: 'beat',
      title: `${post.writerName}: ${String(post.text || '').slice(0, 120)}`,
      summary: post.text,
      url: post.url,
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
  return {
    posts: (cache.posts || []).slice(0, limit),
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
  getXBearerToken
};
