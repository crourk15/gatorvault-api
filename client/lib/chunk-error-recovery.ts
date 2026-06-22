const RETRY_PREFIX = 'gv-chunk-retry:';
const MAX_CHUNK_RETRIES = 3;

/** True when a failed script/chunk load likely caused the error. */
export function isChunkLoadError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return /Loading chunk [\d]+ failed|ChunkLoadError|dynamically imported module|Importing a module script failed|Failed to fetch dynamically imported module/i.test(
    msg
  );
}

/** Hard-navigate with cache-bust query — up to MAX_CHUNK_RETRIES per path per session. */
export function recoverFromChunkError(): boolean {
  if (typeof window === 'undefined') return false;
  const key = `${RETRY_PREFIX}${window.location.pathname}`;
  try {
    const prev = sessionStorage.getItem(key);
    const count = prev ? parseInt(prev, 10) || 0 : 0;
    if (count >= MAX_CHUNK_RETRIES) return false;
    sessionStorage.setItem(key, String(count + 1));
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
