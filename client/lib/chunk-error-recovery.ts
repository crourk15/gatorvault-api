const RETRY_PREFIX = 'gv-chunk-retry:';

/** True when a failed script/chunk load likely caused the error. */
export function isChunkLoadError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return /Loading chunk [\d]+ failed|ChunkLoadError|dynamically imported module|Importing a module script failed|Failed to fetch dynamically imported module/i.test(
    msg
  );
}

/** Hard-navigate once with cache-bust query — returns false if already retried this path. */
export function recoverFromChunkError(): boolean {
  if (typeof window === 'undefined') return false;
  const key = `${RETRY_PREFIX}${window.location.pathname}`;
  try {
    if (sessionStorage.getItem(key)) return false;
    sessionStorage.setItem(key, String(Date.now()));
  } catch {
    /* private mode */
  }
  const url = new URL(window.location.href);
  url.searchParams.set('gv_retry', String(Date.now()));
  window.location.replace(url.toString());
  return true;
}

export function tryRecoverFromChunkError(err: unknown): boolean {
  if (!isChunkLoadError(err)) return false;
  return recoverFromChunkError();
}
