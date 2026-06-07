const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data', 'live');
const WRITERS_PATH = path.join(DATA_DIR, 'writers.json');
const PODCASTS_PATH = path.join(DATA_DIR, 'podcasts.json');
const FEED_PATH = path.join(DATA_DIR, 'feed-items.json');
const BEAT_CACHE_PATH = path.join(DATA_DIR, 'beat-cache.json');
const PODCAST_CACHE_PATH = path.join(DATA_DIR, 'podcast-cache.json');

const FEED_TYPES = [
  'commit',
  'portal',
  'staff',
  'injury',
  'depth',
  'beat',
  'breaking',
  'podcast',
  'article'
];

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

function getFeedItems({ limit = 80, since } = {}) {
  let items = loadFeedItems().map(normalizeFeedItem);
  if (since) {
    const ts = new Date(since).getTime();
    items = items.filter((i) => new Date(i.createdAt).getTime() > ts);
  }
  return items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, limit);
}

function purgeTestFeedItems() {
  const items = loadFeedItems().filter((i) => {
    const t = `${i.title || ''} ${i.summary || ''}`.toLowerCase();
    const slug = String(i.meta?.playerSlug || '').toLowerCase();
    if (slug === 'test-recruit') return false;
    if (t.includes('test recruit')) return false;
    if (t.includes('maxwell hiller') && i.source === 'manual') return false;
    if (t.includes('preview:') || t.includes('ingest') || i.meta?.preview) return false;
    return true;
  });
  saveFeedItems(items);
  return items.length;
}

module.exports = {
  DATA_DIR,
  FEED_TYPES,
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
  upsertFeedItem,
  addManualFeedItem,
  getFeedItems,
  purgeTestFeedItems,
  newId,
  nowIso
};
