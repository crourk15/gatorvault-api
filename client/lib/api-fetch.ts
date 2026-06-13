/**
 * Same-origin API fetch — never exposes external API hostnames in the UI.
 */
import { getApiBase } from './big-board-api';

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const base = getApiBase();
  const url = path.startsWith('http') ? path : `${base}${path.startsWith('/') ? path : `/${path}`}`;
  const res = await fetch(url, init);
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
    const err = new Error(message) as Error & { status?: number; unavailable?: boolean };
    err.status = res.status;
    err.unavailable = unavailable;
    throw err;
  }
  return res.json() as Promise<T>;
}
