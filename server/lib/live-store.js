const fs = require('fs');
const path = require('path');
const gvClass = require('./gv-classification');
const { feedDedupeKeyForCommit, commitFingerprint } = require('./commit-fingerprint');
const feedDedup = require('./live-feed-dedup');

const DATA_DIR = path.join(__dirname, '..', 'data', 'live');
const WRITERS_PATH = path.join(DATA_DIR, 'writers.json');
const PODCASTS_PATH = path.join(DATA_DIR, 'podcasts.json');
const FEED_PATH = path.join(DATA_DIR, 'feed-items.json');
const BEAT_CACHE_PATH = path.join(DATA_DIR, 'beat-cache.json');
const PODCAST_CACHE_PATH = path.join(DATA_DIR, 'podcast-cache.json');

const FEED_TYPES = [
  'commit',
  'portal',
  'offers',
  'article',
  'score',
  'thread',
  'staff',
  'injury',
  'depth',
  'beat',
  'breaking',
  'podcast'
];

/** Main Live Feed column — matches My Alerts categories */
const LIVE_FEED_CATEGORIES = gvClass.FEED_CATEGORIES;

const RECRUITING_PLAYERS_PATH = path.join(__dirname, '..', 'data', 'recruiting', 'players.json');

function loadPlayerIndex() {
  const players = readJson(RECRUITING_PLAYERS_PATH, []);
  const bySlug = new Map();
  const portalSlugs = new Set();
  players.forEach((p) => {
    if (p.slug) bySlug.set(p.slug, p);
    if (p.category === 'portal' && p.slug) portalSlugs.add(p.slug);
  });
  return { bySlug, portalSlugs };
}

function resolveLiveFeedType(item, playerIndex) {
  return gvClass.classifyFeedItemType(item, playerIndex);
}

function normalizeLiveFeedTitle(item, type) {
  if (type === 'portal') return gvClass.formatPortalTitle(item.title);
  return String(item.title || '').trim();
}

function classifyFeedItem(item, playerIndex) {
  const idx = playerIndex || loadPlayerIndex();
  const type = resolveLiveFeedType(item, idx);
  if (!type || !LIVE_FEED_CATEGORIES.includes(type)) return null;
  return normalizeFeedItem({
    ...item,
    type,
    title: normalizeLiveFeedTitle(item, type),
    meta: {
      ...(item.meta || {}),
      player: item.meta?.player || (item.meta?.playerSlug && idx.bySlug ? idx.bySlug.get(item.meta.playerSlug) : null) || undefined
    }
  });
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function nowIso() {
  return new Date().toISOString();
}

function newId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function loadWriters() {
  return readJson(WRITERS_PATH, []);
}

function loadPodcasts() {
  return readJson(PODCASTS_PATH, []);
}

function loadFeedItems() {
  return readJson(FEED_PATH, []);
}

function saveFeedItems(items) {
  writeJson(FEED_PATH, items.slice(0, 500));
}

function loadBeatCache() {
  return readJson(BEAT_CACHE_PATH, { posts: [], fetchedAt: null, source: null });
}

function saveBeatCache(cache) {
  writeJson(BEAT_CACHE_PATH, cache);
}

function loadPodcastCache() {
  return readJson(PODCAST_CACHE_PATH, { shows: [], fetchedAt: null });
}

function savePodcastCache(cache) {
  writeJson(PODCAST_CACHE_PATH, cache);
}

/** @returns {string|null} */
function normalizeFeedUrl(url) {
  if (url == null || url === '') return null;
  const s = String(url).trim();
  if (!s || s === 'undefined' || s === 'null') return null;
  return s;
}

function normalizeFeedItem(item) {
  const source_url = normalizeFeedUrl(item.source_url ?? item.url);
  return { ...item, source_url, url: source_url };
}

function upsertFeedItem(item) {
  const items = loadFeedItems();
  const key = item.dedupeKey || item.id;
  const idx = items.findIndex((i) => (i.dedupeKey || i.id) === key);
  const row = normalizeFeedItem({ ...item, updatedAt: nowIso() });
  if (idx >= 0) items[idx] = normalizeFeedItem({ ...items[idx], ...row });
  else items.unshift(row);
  items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  saveFeedItems(items);
  return row;
}

function addManualFeedItem({ type, title, summary, url, source_url, source, author, meta }) {
  if (!FEED_TYPES.includes(type)) throw new Error('Invalid feed type');
  return upsertFeedItem({
    id: newId('live'),
    dedupeKey: `manual:${type}:${title}`,
    type,
    title: String(title || '').trim(),
    summary: String(summary || '').trim(),
    source_url: normalizeFeedUrl(source_url ?? url),
    imageUrl: null,
    source: source || 'manual',
    author: author || 'GatorVault',
    createdAt: nowIso(),
    meta: meta || {}
  });
}

function getFeedItems({ limit = 80, since, categoriesOnly = false } = {}) {
  const playerIndex = loadPlayerIndex();
  let items = loadFeedItems().map(normalizeFeedItem);
  if (since) {
    const ts = new Date(since).getTime();
    items = items.filter((i) => new Date(i.createdAt).getTime() > ts);
  }
  if (categoriesOnly) {
    items = items
      .map((i) => classifyFeedItem(i, playerIndex))
      .filter(Boolean);
  }
  return items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, limit);
}

function removeFeedItemsMatching(predicate) {
  const items = loadFeedItems();
  const removed = items.filter(predicate);
  const kept = items.filter((i) => !predicate(i));
  saveFeedItems(kept);
  return { removed: removed.length, kept: kept.length };
}

function reclassifyFeedItems() {
  const playerIndex = loadPlayerIndex();
  const items = loadFeedItems();
  let changed = 0;
  const next = items
    .map((raw) => {
      const classified = classifyFeedItem(raw, playerIndex);
      if (!classified) return null;
      if (classified.type !== raw.type || classified.title !== raw.title) changed += 1;
      return classified;
    })
    .filter(Boolean);
  saveFeedItems(next);
  return { total: next.length, changed, removed: items.length - next.length };
}

function dedupeCommitFeedItems() {
  const items = loadFeedItems();
  const commitBySlug = new Map();
  const other = [];

  for (const raw of items) {
    const item = normalizeFeedItem(raw);
    if (item.type !== 'commit') {
      other.push(item);
      continue;
    }
    const slug = item.meta?.playerSlug || item.meta?.player?.slug;
    const fp = item.meta?.commitFingerprint || commitFingerprint(item.meta?.player || { slug });
    const key = fp ? feedDedupeKeyForCommit(slug, item.meta?.player) : slug ? `commit:${slug}` : null;
    if (!key) {
      other.push(item);
      continue;
    }
    const row = { ...item, id: key, dedupeKey: key, meta: { ...(item.meta || {}), commitFingerprint: fp } };
    const prev = commitBySlug.get(key);
    if (!prev || new Date(row.createdAt) > new Date(prev.createdAt)) {
      commitBySlug.set(key, row);
    }
  }

  const merged = feedDedup.collapseByFeedUrl([...commitBySlug.values(), ...other]);
  merged.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  saveFeedItems(merged);
  return { commits: commitBySlug.size, total: merged.length, removed: items.length - merged.length };
}

function purgeTestFeedItems() {
  const playerIndex = loadPlayerIndex();
  const items = loadFeedItems()
    .filter((i) => {
      const t = `${i.title || ''} ${i.summary || ''}`.toLowerCase();
      const slug = String(i.meta?.playerSlug || '').toLowerCase();
      if (slug === 'test-recruit') return false;
      if (t.includes('test recruit')) return false;
      if (t.includes('maxwell hiller') && i.source === 'manual') return false;
      if (t.includes('preview:') || t.includes('ingest') || i.meta?.preview) return false;
      return true;
    })
    .map((i) => classifyFeedItem(i, playerIndex))
    .filter(Boolean);
  saveFeedItems(items);
  return items.length;
}

module.exports = {
  DATA_DIR,
  FEED_TYPES,
  LIVE_FEED_CATEGORIES,
  loadWriters,
  loadPodcasts,
  loadFeedItems,
  saveFeedItems,
  loadBeatCache,
  saveBeatCache,
  loadPodcastCache,
  savePodcastCache,
  normalizeFeedUrl,
  normalizeFeedItem,
  loadPlayerIndex,
  classifyFeedItem,
  resolveLiveFeedType,
  reclassifyFeedItems,
  removeFeedItemsMatching,
  upsertFeedItem,
  addManualFeedItem,
  getFeedItems,
  purgeTestFeedItems,
  dedupeCommitFeedItems,
  newId,
  nowIso
};
