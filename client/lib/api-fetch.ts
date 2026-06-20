/**
 * Same-origin API fetch — never exposes external API hostnames in the UI.
 * Retries 502/503 cold-start failures with QA-matched backoff.
 */
import { getApiBase } from './big-board-api';

/** Per-attempt timeout — matches QA_FETCH_TIMEOUT_MS (25s). */
export const API_FETCH_TIMEOUT_MS = 25_000;
/** Retry count — matches QA_LIVE_DASHBOARD_RETRIES (4 attempts total). */
export const API_FETCH_RETRIES = 3;
/** Base delay between retries — matches QA_LIVE_DASHBOARD_RETRY_MS (3s). */
export const API_FETCH_RETRY_MS = 3_000;
export const API_FETCH_RETRY_STATUSES = new Set([502, 503, 504, 429]);

export type ApiFetchInit = RequestInit & {
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
};

export class ApiFetchError extends Error {
  readonly status?: number;
  readonly unavailable?: boolean;
  readonly timedOut?: boolean;

  constructor(
    message: string,
    opts?: { status?: number; unavailable?: boolean; timedOut?: boolean }
  ) {
    super(message);
    this.name = 'ApiFetchError';
    this.status = opts?.status;
    this.unavailable = opts?.unavailable;
    this.timedOut = opts?.timedOut;
  }
}

function isRetryableError(err: unknown, status?: number): boolean {
  if (status != null && API_FETCH_RETRY_STATUSES.has(status)) return true;
  if (err instanceof ApiFetchError) {
    if (err.timedOut || err.unavailable) return true;
    if (err.status != null && API_FETCH_RETRY_STATUSES.has(err.status)) return true;
  }
  if (err instanceof DOMException && err.name === 'AbortError') return true;
  const msg = String((err as Error)?.message || err || '');
  return /fetch failed|network|ECONNRESET|ECONNREFUSED|Failed to fetch/i.test(msg);
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function apiFetchOnce<T>(url: string, init: RequestInit, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const externalSignal = init.signal;
  if (externalSignal?.aborted) {
    controller.abort();
  } else if (externalSignal) {
    externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) {
      let message = 'Something went wrong loading data. Please try again.';
      let unavailable = false;
      try {
        const body = (await res.json()) as { error?: string; unavailable?: boolean };
        if (body.unavailable) unavailable = true;
        if (body.error && !/https?:\/\//i.test(body.error)) {
          message = body.error;
        }
      } catch {
        /* ignore */
      }
      throw new ApiFetchError(message, { status: res.status, unavailable });
    }
    return res.json() as Promise<T>;
  } catch (err) {
    if (err instanceof ApiFetchError) throw err;
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiFetchError('Request timed out. Please try again.', { timedOut: true });
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function apiFetch<T>(path: string, init?: ApiFetchInit): Promise<T> {
  const base = getApiBase();
  const url = path.startsWith('http') ? path : `${base}${path.startsWith('/') ? path : `/${path}`}`;
  const timeoutMs = init?.timeoutMs ?? API_FETCH_TIMEOUT_MS;
  const retries = init?.retries ?? API_FETCH_RETRIES;
  const retryDelayMs = init?.retryDelayMs ?? API_FETCH_RETRY_MS;
  const { timeoutMs: _timeout, retries: _retries, retryDelayMs: _retryDelay, ...fetchInit } = init ?? {};

  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await apiFetchOnce<T>(url, fetchInit, timeoutMs);
    } catch (err) {
      lastErr = err;
      const status = err instanceof ApiFetchError ? err.status : undefined;
      if (attempt >= retries || !isRetryableError(err, status)) break;
      await sleep(retryDelayMs * (attempt + 1));
    }
  }

  if (lastErr instanceof ApiFetchError) throw lastErr;
  if (lastErr instanceof DOMException && lastErr.name === 'AbortError') {
    throw new ApiFetchError('Request timed out. Please try again.', { timedOut: true });
  }
  throw lastErr;
}
