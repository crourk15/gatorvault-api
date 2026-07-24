/**
 * Simple in-memory TTL cache for hot API responses.
 * Supports stale-while-revalidate + single-flight rebuilds.
 */
function createMemoryCache(defaultTtlMs = 60_000) {
  /** @type {Map<string, { expires: number; value: unknown }>} */
  const store = new Map();
  /** @type {Map<string, Promise<unknown>>} */
  const inflight = new Map();

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

  function revalidate(key, fn, ttlMs = defaultTtlMs) {
    if (inflight.has(key)) return inflight.get(key);
    const pending = Promise.resolve()
      .then(() => fn())
      .then((value) => {
        set(key, value, ttlMs);
        return value;
      })
      .finally(() => {
        inflight.delete(key);
      });
    inflight.set(key, pending);
    return pending;
  }

  /**
   * Fresh hit → return immediately.
   * Expired but present → return stale and rebuild in background.
   * Missing → single-flight rebuild (concurrent callers share one build).
   */
  async function wrap(key, fn, ttlMs = defaultTtlMs) {
    const hit = get(key);
    if (hit != null) return { value: hit, hit: true, stale: false };

    const stale = getStale(key);
    if (stale != null) {
      void revalidate(key, fn, ttlMs).catch(() => {});
      return { value: stale, hit: true, stale: true };
    }

    try {
      const value = await revalidate(key, fn, ttlMs);
      return { value, hit: false, stale: false };
    } catch (err) {
      const fallback = getStale(key);
      if (fallback != null) return { value: fallback, hit: true, stale: true };
      throw err;
    }
  }

  function remove(key) {
    store.delete(key);
    inflight.delete(key);
  }

  function clear() {
    store.clear();
    inflight.clear();
  }

  return { get, getStale, set, wrap, revalidate, remove, clear };
}

module.exports = { createMemoryCache };
