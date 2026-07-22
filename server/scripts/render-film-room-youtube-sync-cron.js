#!/usr/bin/env node
/**
 * Render cron — sync Film Room YouTube pressers + GNFP reviews into durable cache.
 */
require('./render-cron-env');

const SYNC_URL =
  process.env.FILM_ROOM_YOUTUBE_SYNC_URL ||
  'https://gatorvault-api.onrender.com/api/film-room/admin/sync-youtube';
const CRON_SECRET = process.env.MONITORING_CRON_SECRET || process.env.CRON_SECRET || '';

const RETRY_STATUSES = new Set([502, 503, 504, 429]);
const MAX_ATTEMPTS = 4;
const RETRY_MS = 5000;

async function postSync() {
  if (!CRON_SECRET) throw new Error('MONITORING_CRON_SECRET (or CRON_SECRET) is not set');
  const started = Date.now();
  const res = await fetch(SYNC_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'x-monitoring-cron': CRON_SECRET,
      'User-Agent': 'gatorvault-film-room-youtube-sync-cron/1.0',
    },
    body: '{}',
    signal: AbortSignal.timeout(120000),
  });
  const elapsed = Date.now() - started;
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok) {
    const err = new Error(`film-room youtube sync HTTP ${res.status} (${elapsed}ms)`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  console.log('[film-room-youtube-sync] OK', {
    elapsed,
    added: body?.sync?.added,
    pressers: body?.sync?.counts?.pressers,
    gnfp: body?.sync?.counts?.gnfp,
  });
  return body;
}

async function main() {
  let lastErr = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      await postSync();
      process.exit(0);
    } catch (err) {
      lastErr = err;
      const retryable = RETRY_STATUSES.has(err.status);
      console.warn(`[film-room-youtube-sync] attempt ${attempt} failed`, err.message);
      if (!retryable || attempt === MAX_ATTEMPTS) break;
      await new Promise((r) => setTimeout(r, RETRY_MS * attempt));
    }
  }
  console.error('[film-room-youtube-sync] giving up', lastErr?.message || lastErr);
  process.exit(0);
}

main();
