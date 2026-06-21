/**
 * Snapshot-first fetch — instant Netlify CDN paint, live API revalidates in background.
 */
import { apiFetch, type ApiFetchInit } from './api-fetch';
import { snapshotPathForApi } from './snapshot-paths';

export async function fetchSnapshotJson<T>(snapPath: string): Promise<T> {
  const res = await fetch(snapPath, { headers: { Accept: 'application/json' }, cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Snapshot unavailable (${res.status})`);
  }
  return (await res.json()) as T;
}

/** Snapshot-first: return CDN JSON immediately; fire live fetch in background when mapped. */
export function snapshotFirstFetch<T>(
  apiPath: string,
  liveFetch: () => Promise<T>,
  init?: ApiFetchInit
): Promise<T> {
  const snapPath = snapshotPathForApi(apiPath);
  if (snapPath) {
    return fetchSnapshotJson<T>(snapPath)
      .then((snapshot) => {
        void liveFetch().catch(() => {});
        return snapshot;
      })
      .catch(() => liveFetch());
  }
  return liveFetch();
}

/** Live API via apiFetch — used as background revalidation target. */
export function snapshotLiveFetch<T>(apiPath: string, init?: ApiFetchInit): Promise<T> {
  return apiFetch<T>(apiPath, init);
}

export const DEFAULT_SNAPSHOT_FETCH_OPTS = {
  retries: 3,
  retryDelayMs: 2000,
  timeoutMs: 12_000,
} as const satisfies ApiFetchInit;
