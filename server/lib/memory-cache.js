/**
 * Simple in-memory TTL cache for hot API responses.
 */
function createMemoryCache(defaultTtlMs = 60_000) {
  /** @type {Map<string, { expires: number; value: unknown }>} */
  const store = new Map();

  function get(key) {
    const hit = store.get(key);
    if (!hit) return null;
    if (hit.expires <= Date.now()) return null;
    return hit.value;
  }

  /** Last cached value even after TTL — for stale-while-revalidate. */
  function getStale(key) {
    return store.get(key)?.value ?? null;
  }

  function set(key, value, ttlMs = defaultTtlMs) {
    store.set(key, { expires: Date.now() + ttlMs, value });
  }

  async function wrap(key, fn, ttlMs = defaultTtlMs) {
    const hit = get(key);
    if (hit != null) return { value: hit, hit: true };
    const value = await fn();
    set(key, value, ttlMs);
    return { value, hit: false };
  }

  function remove(key) {
    store.delete(key);
  }

  function clear() {
    store.clear();
  }

  return { get, getStale, set, wrap, remove, clear };
}

module.exports = { createMemoryCache };
