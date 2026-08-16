/**
 * Browser cache-first fetch: paint last-good JSON immediately, refresh live in background.
 * Used so Vault pages feel instant on revisit while staying live-updating.
 */

export type SwrOptions<T = unknown> = {
  /** Prefer localStorage so reopening the app still paints instantly. Default true. */
  durable?: boolean;
  /** Fresh window   still returned immediately; live refresh always starts. Default 5m. */
  freshTtlMs?: number;
  /** Max age to still paint (stale-while-revalidate). Default 24h. */
  maxStaleMs?: number;
  /** Reject cached payloads that look like errors. */
  isUsable?: (data: unknown) => boolean;
  /** Called when a background live refresh finishes after a cache hit. */
  onFresh?: (data: T) => void;
};

const CACHE_PREFIX = 'gv_swr_v1:';
const DEFAULT_FRESH_MS = 5 * 60 * 1000;
const DEFAULT_MAX_STALE_MS = 24 * 60 * 60 * 1000;

const NO_CACHE_PREFIXES = [
  '/api/auth',
  '/api/session',
  '/api/account',
  '/api/billing',
  '/api/iap',
  '/api/membership',
  '/api/admin',
  '/api/ops',
  '/api/user',
  '/api/me',
  // Game Week / schedule intel must not stick on a stale SWR paint — live keys
  // (e.g. Expected visitors) never reached the UI when onFresh was unused.
  '/api/schedule',
];

type CacheEnvelope<T> = { at: number; data: T };

function defaultUsable(data: unknown): boolean {
  if (data == null) return false;
  if (typeof data !== 'object') return true;
  const record = data as Record<string, unknown>;
  if (typeof record.error === 'string' && record.error.length > 0) return false;
  if (record.unavailable === true && record.degraded === true) return false;
  if (record.status === 'building') return false;
  return true;
}

function storageFor(durable: boolean): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return durable ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

export function swrCacheKey(apiPath: string): string {
  return `${CACHE_PREFIX}${apiPath}`;
}

export function shouldSkipSwrCache(apiPath: string): boolean {
  const path = apiPath.split('?')[0] || apiPath;
  return NO_CACHE_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

export function readSwrCache<T>(key: string, opts: SwrOptions<T> = {}): T | null {
  const store = storageFor(opts.durable !== false);
  if (!store) return null;
  const maxStale = opts.maxStaleMs ?? DEFAULT_MAX_STALE_MS;
  const usable = opts.isUsable ?? defaultUsable;
  try {
    const raw = store.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEnvelope<T>;
    if (!parsed?.data || typeof parsed.at !== 'number') return null;
    if (Date.now() - parsed.at > maxStale) return null;
    if (!usable(parsed.data)) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

export function writeSwrCache<T>(key: string, data: T, opts: SwrOptions<T> = {}): void {
  const store = storageFor(opts.durable !== false);
  if (!store) return;
  const usable = opts.isUsable ?? defaultUsable;
  if (!usable(data)) return;
  try {
    store.setItem(key, JSON.stringify({ at: Date.now(), data } satisfies CacheEnvelope<T>));
  } catch {
    /* quota / private mode */
  }
}

/**
 * Return cached data immediately (if any), always kick live fetch to refresh storage.
 * First visit with empty cache awaits live.
 * When serving from cache, `onFresh` receives the background live result.
 */
export function cacheFirstFetch<T>(
  key: string,
  liveFetch: () => Promise<T>,
  opts: SwrOptions<T> = {}
): Promise<T> {
  const cached = readSwrCache<T>(key, opts);
  const live = liveFetch().then((data) => {
    writeSwrCache(key, data, opts);
    return data;
  });
  if (cached != null) {
    void live
      .then((data) => {
        opts.onFresh?.(data);
      })
      .catch(() => {});
    return Promise.resolve(cached);
  }
  return live;
}

/** API-path keyed helper for snapshotFirstFetch / page loaders. */
export function cacheFirstApiFetch<T>(
  apiPath: string,
  liveFetch: () => Promise<T>,
  opts: SwrOptions<T> = {}
): Promise<T> {
  if (shouldSkipSwrCache(apiPath)) {
    return liveFetch();
  }
  return cacheFirstFetch(swrCacheKey(apiPath), liveFetch, opts);
}
