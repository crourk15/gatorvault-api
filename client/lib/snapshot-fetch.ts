/**
 * Data fetch — live API only in production (see data-mode.ts).
 */
import {
  apiFetch,
  API_FETCH_TIMEOUT_MS,
  API_FETCH_RETRIES,
  API_FETCH_RETRY_MS,
  type ApiFetchInit,
} from './api-fetch';
import { LIVE_DATA_ONLY } from './data-mode';
import { snapshotPathForApi } from './snapshot-paths';
import { cacheFirstApiFetch } from './stale-while-revalidate';

function snapshotPayloadUsable(body: unknown): boolean {
  if (body == null || typeof body !== 'object') return false;
  const record = body as Record<string, unknown>;
  if (typeof record.error === 'string' && record.error.length > 0) return false;
  if (record.unavailable === true && record.degraded === true) return false;
  return true;
}

export async function fetchSnapshotJson<T>(snapPath: string): Promise<T> {
  const res = await fetch(snapPath, { headers: { Accept: 'application/json' }, cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Snapshot unavailable (${res.status})`);
  }
  const body = (await res.json()) as T;
  if (!snapshotPayloadUsable(body)) {
    throw new Error('Snapshot payload unusable');
  }
  return body;
}

/**
 * Live API fetch with browser stale-while-revalidate.
 * First visit awaits live; revisits paint last-good JSON instantly and refresh in background.
 * CDN hub-snapshot path used only when LIVE_DATA_ONLY is false.
 */
export function snapshotFirstFetch<T>(
  apiPath: string,
  liveFetch: () => Promise<T>,
  _init?: ApiFetchInit
): Promise<T> {
  if (LIVE_DATA_ONLY) {
    return cacheFirstApiFetch(apiPath, liveFetch);
  }
  const snapPath = snapshotPathForApi(apiPath);
  if (snapPath) {
    return fetchSnapshotJson<T>(snapPath)
      .then((snapshot) => {
        void liveFetch().catch(() => {});
        return snapshot;
      })
      .catch(() => cacheFirstApiFetch(apiPath, liveFetch));
  }
  return cacheFirstApiFetch(apiPath, liveFetch);
}

/** Live API via apiFetch. */
export function snapshotLiveFetch<T>(apiPath: string, init?: ApiFetchInit): Promise<T> {
  return apiFetch<T>(apiPath, init);
}

/** Match warm-v3-premium apiFetch profile — snapshot callers were stuck on 12s/2 retries. */
export const DEFAULT_SNAPSHOT_FETCH_OPTS = {
  retries: API_FETCH_RETRIES,
  timeoutMs: API_FETCH_TIMEOUT_MS,
  retryDelayMs: API_FETCH_RETRY_MS,
} as const satisfies ApiFetchInit;
