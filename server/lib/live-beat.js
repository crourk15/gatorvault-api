const fetch = require('node-fetch');
const { parseRssItems } = require('./rss-parse');
const store = require('./live-store');

const NITTER_BASES = (process.env.NITTER_BASES || 'https://nitter.poast.org,https://nitter.privacydev.net')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const X_BEARER = process.env.X_BEARER_TOKEN || process.env.TWITTER_BEARER_TOKEN || null;

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
  if (!X_BEARER) return null;
  const userRes = await fetch(
    `https://api.twitter.com/2/users/by/username/${encodeURIComponent(handle)}?user.fields=profile_image_url`,
    { headers: { Authorization: `Bearer ${X_BEARER}` } }
  );
  if (!userRes.ok) throw new Error(`X user lookup ${userRes.status}`);
  const userJson = await userRes.json();
  const userId = userJson.data?.id;
  if (!userId) return [];

  const tweetsRes = await fetch(
    `https://api.twitter.com/2/users/${userId}/tweets?max_results=10&tweet.fields=created_at,entities&exclude=retweets,replies`,
    { headers: { Authorization: `Bearer ${X_BEARER}` } }
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
    if (X_BEARER) {
      const posts = await fetchXUserTimeline(writer.handle);
      if (posts && posts.length) return posts;
    }
    return await fetchNitterRss(writer.handle);
  } catch (e) {
    return [];
  }
}

async function refreshBeatStream() {
  const writers = store.loadWriters();
  const all = [];
  let source = X_BEARER ? 'x' : 'nitter';
  let errors = 0;

  for (const writer of writers) {
    const posts = await fetchWriterPosts(writer);
    if (!posts.length) errors += 1;
    posts.forEach((p) => all.push(p));
  }

  if (!all.length && errors === writers.length) source = 'cache';

  all.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

  const cache = store.loadBeatCache();
  const merged = all.length ? all.slice(0, 80) : cache.posts || [];
  const next = {
    posts: merged,
    fetchedAt: store.nowIso(),
    source: all.length ? source : cache.source || 'unavailable'
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
  return {
    posts: (cache.posts || []).slice(0, limit),
    fetchedAt: cache.fetchedAt,
    source: cache.source
  };
}

module.exports = {
  refreshBeatStream,
  getBeatPosts,
  fetchWriterPosts
};
