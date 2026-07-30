/**
 * Resolve nameless / teaser beat posts (e.g. Corey Bender "Top-100 prospect… cousin of …")
 * to a real prospect via On3 article URLs + relational-name exclusion.
 */
'use strict';

const ON3_NEWS_RE = /on3\.com\/(?:teams\/[^/]+\/)?news\//i;
const ON3_ANY_RE = /on3\.com/i;

const RELATIONAL_NAME_RES = [
  // "his cousin and Florida safety Lagonza Hayward"
  /\b(?:his|her|their)\s+cousin\s+and\s+(?:(?:a|the)\s+)?(?:florida\s+)?(?:safety|db|cb|wr|qb|rb|te|ol|dl|lb|ath|edge|de|dt|s|ot|og|c|defender)\s+([A-Z][A-Za-z'.-]+(?:\s+[A-Z][A-Za-z'.-]+){1,2})\b/gi,
  // "cousin of Florida safety Lagonza Hayward" / "cousins with former Florida defender X"
  /\bcousins?\s+(?:of|to|with)\s+(?:(?:a|the|his|her|their)\s+)?(?:former\s+)?(?:florida\s+)?(?:safety|db|cb|wr|qb|rb|te|ol|dl|lb|ath|edge|de|dt|s|ot|og|c|defender)\s+([A-Z][A-Za-z'.-]+(?:\s+[A-Z][A-Za-z'.-]+){1,2})\b/gi,
  // "cousin of Lagonza Hayward"
  /\bcousins?\s+(?:of|to|with)\s+([A-Z][A-Za-z'.-]+(?:\s+[A-Z][A-Za-z'.-]+){1,2})\b/gi,
  // "brother/sister of …"
  /\b(?:brother|sister|uncle|nephew|relative)s?\s+(?:of|to)\s+([A-Z][A-Za-z'.-]+(?:\s+[A-Z][A-Za-z'.-]+){1,2})\b/gi
];

function normalizeNameKey(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function relationalNamesInText(text) {
  const t = String(text || '');
  const out = new Set();
  for (const re of RELATIONAL_NAME_RES) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(t))) {
      const n = String(m[1] || '').trim();
      if (n) out.add(normalizeNameKey(n));
    }
  }
  return out;
}

function isRelationalMention(text, name) {
  const key = normalizeNameKey(name);
  if (!key) return false;
  if (relationalNamesInText(text).has(key)) return true;
  const esc = String(name || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (!esc) return false;
  const loose = new RegExp(
    `(?:cousin|brother|sister|uncle|nephew|relative).{0,48}${esc}|${esc}.{0,48}(?:cousin|brother|sister)`,
    'i'
  );
  return loose.test(String(text || ''));
}

function textWithoutRelationalNames(text) {
  let t = String(text || '');
  for (const re of RELATIONAL_NAME_RES) {
    t = t.replace(re, ' ');
  }
  return t.replace(/\s+/g, ' ').trim();
}

function collectPostUrls(post = {}) {
  try {
    const filters = require('./beat-writer-filters');
    if (typeof filters.postUrls === 'function') return filters.postUrls(post);
  } catch {
    /* fall through */
  }
  const urls = [];
  if (Array.isArray(post.attachmentUrls)) urls.push(...post.attachmentUrls);
  const text = String(post.text || '');
  const fromText = text.match(/https?:\/\/[^\s<>"']+/g) || [];
  urls.push(...fromText);
  if (post.url) urls.push(post.url);
  if (post.articleUrl) urls.push(post.articleUrl);
  return [...new Set(urls.map((u) => String(u || '').trim()).filter(Boolean))];
}

const SHORT_URL_HOST_RE = /^(?:t\.co|bit\.ly|tinyurl\.com|ow\.ly|buff\.ly)$/i;
const _shortUrlCache = new Map();

function isShortUrl(url) {
  try {
    const u = new URL(String(url || '').trim());
    return SHORT_URL_HOST_RE.test(u.hostname);
  } catch {
    return false;
  }
}

/**
 * Expand t.co / short links so On3 article URLs become visible to teaser resolve.
 * HEAD first; follow redirects without downloading the body.
 */
async function expandShortUrl(url, { fetchImpl = null, timeoutMs = 4500 } = {}) {
  const raw = String(url || '').trim();
  if (!raw || !isShortUrl(raw)) return raw;
  if (_shortUrlCache.has(raw)) return _shortUrlCache.get(raw);

  const fetchFn =
    fetchImpl ||
    (typeof fetch === 'function'
      ? fetch
      : (...args) => import('node-fetch').then(({ default: f }) => f(...args)));

  let resolved = raw;
  try {
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
    const res = await fetchFn(raw, {
      method: 'HEAD',
      redirect: 'follow',
      signal: ctrl?.signal
    });
    if (timer) clearTimeout(timer);
    if (res?.url && String(res.url).startsWith('http')) resolved = String(res.url);
  } catch {
    try {
      const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
      const res = await fetchFn(raw, {
        method: 'GET',
        redirect: 'follow',
        signal: ctrl?.signal,
        headers: { Range: 'bytes=0-0' }
      });
      if (timer) clearTimeout(timer);
      if (res?.url && String(res.url).startsWith('http')) resolved = String(res.url);
    } catch {
      resolved = raw;
    }
  }

  _shortUrlCache.set(raw, resolved);
  return resolved;
}

async function expandPostUrls(post = {}, opts = {}) {
  const urls = collectPostUrls(post);
  const expanded = [];
  for (const u of urls) {
    expanded.push(isShortUrl(u) ? await expandShortUrl(u, opts) : u);
  }
  return [...new Set(expanded.filter(Boolean))];
}

function pickOn3ArticleUrlFromList(urls = []) {
  return (
    urls.find((u) => ON3_NEWS_RE.test(u)) ||
    urls.find((u) => ON3_ANY_RE.test(u) && !/x\.com|twitter\.com|t\.co/i.test(u)) ||
    null
  );
}

function pickOn3ArticleUrl(post = {}) {
  return pickOn3ArticleUrlFromList(collectPostUrls(post));
}

async function pickOn3ArticleUrlExpanded(post = {}, opts = {}) {
  const urls = await expandPostUrls(post, opts);
  return pickOn3ArticleUrlFromList(urls);
}

function hasResolvableOn3Article(post = {}) {
  return !!pickOn3ArticleUrl(post);
}

function parseSyncOn3Identity(post = {}) {
  try {
    const { parseOn3BeatUrlIdentity } = require('./on3-recruit-discovery');
    const urls = collectPostUrls(post);
    const textBlob = [post.text, ...urls].filter(Boolean).join(' ');
    return parseOn3BeatUrlIdentity(textBlob, pickOn3ArticleUrl(post) || post.url || null);
  } catch {
    return null;
  }
}

/**
 * Sync resolve: never return a cousin/college relative as the prospect.
 */
function resolvePlayerFromBeatPostSync(postOrText) {
  const post =
    typeof postOrText === 'string' ? { text: postOrText } : postOrText || {};
  const text = String(post.text || '').trim();
  const cleaned = textWithoutRelationalNames(text);

  const urlIdentity = parseSyncOn3Identity(post);
  if (urlIdentity?.playerSlug && urlIdentity.playerName) {
    if (!isRelationalMention(text, urlIdentity.playerName)) {
      return {
        playerName: urlIdentity.playerName,
        playerSlug: urlIdentity.playerSlug,
        classYear: urlIdentity.classYear || null,
        matchMode: urlIdentity.source || 'on3_url',
        on3ArticleUrl: urlIdentity.on3ArticleUrl || pickOn3ArticleUrl(post)
      };
    }
  }

  try {
    const gate = require('./beat-recruiting-ingest-gate');
    const hit = gate.resolvePlayerFromTextSync(cleaned || text);
    if (hit?.playerName && !isRelationalMention(text, hit.playerName)) {
      return { ...hit, on3ArticleUrl: pickOn3ArticleUrl(post) };
    }
  } catch {
    /* optional */
  }

  try {
    const copy = require('./x-autoposter-copy');
    const { isValidPlayerName } = require('./x-autoposter-player-context');
    const { slugify } = require('./slug');
    const candidates = [
      copy.extractPlayerFromText(cleaned),
      ...(copy.extractAllPlayerNameCandidates?.(cleaned) || [])
    ].filter(Boolean);
    for (const name of candidates) {
      if (!isValidPlayerName(name)) continue;
      if (isRelationalMention(text, name)) continue;
      return {
        playerName: name,
        playerSlug: slugify(name),
        classYear: null,
        matchMode: 'text_extract_cleaned',
        on3ArticleUrl: pickOn3ArticleUrl(post)
      };
    }
  } catch {
    /* optional */
  }

  return null;
}

/**
 * Async: expand short links, then fetch On3 news pageProps when the tweet
 * teases without naming the prospect (common Bender On3+ pattern).
 */
async function resolvePlayerFromBeatPost(post = {}, opts = {}) {
  const expandedUrls = await expandPostUrls(post, opts);
  const articleUrl = pickOn3ArticleUrlFromList(expandedUrls);
  const postWithUrls = {
    ...post,
    attachmentUrls: [...new Set([...(post.attachmentUrls || []), ...expandedUrls])],
    articleUrl: articleUrl || post.articleUrl || null,
    url: articleUrl && (!post.url || isShortUrl(post.url) || /x\.com|twitter\.com/i.test(post.url))
      ? articleUrl
      : post.url
  };

  const sync = resolvePlayerFromBeatPostSync(postWithUrls);
  if (sync?.playerSlug && sync.matchMode !== 'text_extract') {
    // Prefer URL/article identity over bare text when available.
    if (sync.matchMode && String(sync.matchMode).startsWith('on3')) return sync;
  }

  if (!articleUrl || !ON3_NEWS_RE.test(articleUrl)) {
    return sync;
  }

  // Sync parse often works once t.co → on3.com is expanded (slug embeds the name).
  try {
    const { parseOn3BeatUrlIdentity } = require('./on3-recruit-discovery');
    const fromExpanded = parseOn3BeatUrlIdentity(postWithUrls.text || '', articleUrl);
    if (fromExpanded?.playerSlug && fromExpanded.playerName) {
      if (!isRelationalMention(post.text || '', fromExpanded.playerName)) {
        return {
          playerName: fromExpanded.playerName,
          playerSlug: fromExpanded.playerSlug,
          classYear: fromExpanded.classYear || null,
          pos: fromExpanded.pos || null,
          matchMode: fromExpanded.source || 'on3_news_url',
          on3ArticleUrl: articleUrl
        };
      }
    }
  } catch {
    /* optional */
  }

  try {
    const { resolveIdentityFromOn3ArticleUrl } = require('./teaser-rpm-identity');
    const identity = await resolveIdentityFromOn3ArticleUrl(articleUrl, {
      classYear: opts.classYear || 2028,
      fetchPageProps: opts.fetchPageProps || null
    });
    if (identity?.ok && identity.playerSlug && identity.playerName) {
      if (isRelationalMention(post.text || '', identity.playerName)) {
        return sync;
      }
      return {
        playerName: identity.playerName,
        playerSlug: identity.playerSlug,
        classYear: identity.classYear || null,
        pos: identity.pos || null,
        matchMode: `on3_article:${identity.source || 'pageProps'}`,
        confidence: identity.confidence || null,
        on3ArticleUrl: articleUrl,
        on3Slug: identity.on3Slug || null,
        title: identity.title || null
      };
    }
  } catch {
    /* optional network */
  }

  return sync;
}

/**
 * Enrich a raw beat post so downstream sync parsers see the real prospect name.
 */
async function enrichBeatPostIdentity(post = {}, opts = {}) {
  const resolved = await resolvePlayerFromBeatPost(post, opts);
  if (!resolved?.playerName) {
    return { post, resolved: null, enriched: false };
  }
  const articleUrl = resolved.on3ArticleUrl || pickOn3ArticleUrl(post);
  const prefix = `${resolved.playerName}`;
  const already = new RegExp(`\\b${resolved.playerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(
    post.text || ''
  );
  const enrichedPost = {
    ...post,
    text: already ? post.text : `${prefix} — ${post.text}`,
    articleUrl: articleUrl || post.articleUrl || null,
    attachmentUrls: collectPostUrls(post),
    _teaserResolved: resolved
  };
  // Prefer On3 article as canonical url for intel rows / unresolved queue.
  if (articleUrl && (!post.url || /x\.com|twitter\.com/i.test(post.url))) {
    enrichedPost.url = articleUrl;
  }
  return { post: enrichedPost, resolved, enriched: true };
}

module.exports = {
  relationalNamesInText,
  isRelationalMention,
  textWithoutRelationalNames,
  collectPostUrls,
  expandShortUrl,
  expandPostUrls,
  pickOn3ArticleUrl,
  pickOn3ArticleUrlExpanded,
  hasResolvableOn3Article,
  parseSyncOn3Identity,
  resolvePlayerFromBeatPostSync,
  resolvePlayerFromBeatPost,
  enrichBeatPostIdentity
};
