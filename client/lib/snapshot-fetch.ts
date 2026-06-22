/**
 * Data fetch — live API only in production (see data-mode.ts).
 */
import { apiFetch, type ApiFetchInit } from './api-fetch';
import { LIVE_DATA_ONLY } from './data-mode';
import { snapshotPathForApi } from './snapshot-paths';

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

/** Live API fetch; snapshot CDN path used only when LIVE_DATA_ONLY is false. */
export function snapshotFirstFetch<T>(
  apiPath: string,
  liveFetch: () => Promise<T>,
  _init?: ApiFetchInit
): Promise<T> {
  if (LIVE_DATA_ONLY) {
    return liveFetch();
  }
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

/** Live API via apiFetch. */
export function snapshotLiveFetch<T>(apiPath: string, init?: ApiFetchInit): Promise<T> {
  return apiFetch<T>(apiPath, init);
}

export const DEFAULT_SNAPSHOT_FETCH_OPTS = {
  retries: 2,
  timeoutMs: 12_000,
  retryDelayMs: 2_000,
} as const satisfies ApiFetchInit;
