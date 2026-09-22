/**
 * Short in-memory cache for public Community hub reads.
 * One build serves /page plus the older list GETs so cold opens are not 6x disk.
 */
const { createMemoryCache } = require('./memory-cache');
const store = require('./community-store');

const TTL_MS = parseInt(process.env.COMMUNITY_PAGE_CACHE_MS || '15000', 10) || 15_000;
const cache = createMemoryCache(TTL_MS);

function pageKey({ sort = 'recent', category = '', limit = 40, gameRoomLimit = 8 } = {}) {
  return `page:${sort}:${category || ''}:${Number(limit) || 40}:${Number(gameRoomLimit) || 8}`;
}

function getPage(opts = {}) {
  const key = pageKey(opts);
  const hit = cache.get(key);
  if (hit) return { ...hit, cacheHit: true };
  const value = store.getPublicPage(opts);
  cache.set(key, value, TTL_MS);
  return { ...value, cacheHit: false };
}

function invalidateCommunityPageCache() {
  cache.clear();
}

module.exports = {
  getPage,
  invalidateCommunityPageCache,
  pageKey,
};
