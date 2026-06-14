/**
 * Same-origin API fetch — never exposes external API hostnames in the UI.
 * Default 8s timeout prevents hung requests during cold API starts.
 */
import { getApiBase } from './big-board-api';

export const API_FETCH_TIMEOUT_MS = 8_000;

export type ApiFetchInit = RequestInit & { timeoutMs?: number };

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

export async function apiFetch<T>(path: string, init?: ApiFetchInit): Promise<T> {
  const base = getApiBase();
  const url = path.startsWith('http') ? path : `${base}${path.startsWith('/') ? path : `/${path}`}`;
  const timeoutMs = init?.timeoutMs ?? API_FETCH_TIMEOUT_MS;
  const { timeoutMs: _timeout, ...fetchInit } = init ?? {};

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const externalSignal = fetchInit.signal;
  if (externalSignal?.aborted) {
    controller.abort();
  } else if (externalSignal) {
    externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  try {
    const res = await fetch(url, { ...fetchInit, signal: controller.signal });
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
