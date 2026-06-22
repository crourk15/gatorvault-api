#!/usr/bin/env node
/**
 * Render cron — beat writer + visit intel + live dashboard refresh.
 * Requires MONITORING_CRON_SECRET (or INGEST_CRON_SECRET) and X_BEARER_TOKEN on the web service.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || process.env.API_BASE || 'https://gatorvault-api.onrender.com').replace(
  /\/$/,
  ''
);
const CRON_SECRET = process.env.MONITORING_CRON_SECRET || process.env.INGEST_CRON_SECRET || process.env.CRON_SECRET || '';

async function postIngest(path, body = {}) {
  if (!CRON_SECRET) {
    throw new Error('MONITORING_CRON_SECRET or INGEST_CRON_SECRET is not set');
  }
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Ingest-Secret': CRON_SECRET,
      'x-monitoring-cron': CRON_SECRET,
      'User-Agent': 'gatorvault-beat-ingest-cron/1.0',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(240000),
  });
  let payload = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }
  if (!res.ok) {
    const err = new Error(`${path} HTTP ${res.status}`);
    err.payload = payload;
    throw err;
  }
  return payload;
}

async function main() {
  const live = await postIngest('/api/live/refresh', {});
  const beatWriter = await postIngest('/api/recruiting/beat-writer/ingest', {});
  const beatVisit = await postIngest('/api/recruiting/beat-visit/ingest', {});

  console.log(
    '[beat-ingest-cron] ok',
    JSON.stringify(
      {
        beatPosts: live?.result?.beat?.postCount ?? live?.dashboard?.beat?.postCount ?? null,
        beatWriterProcessed: beatWriter?.processedCount ?? beatWriter?.processed?.length ?? null,
        beatVisitProcessed: beatVisit?.processedCount ?? beatVisit?.processed?.length ?? null,
        at: new Date().toISOString(),
      },
      null,
      0
    )
  );
}

main().catch((err) => {
  console.error('[beat-ingest-cron] failed:', err.message);
  if (err.payload) console.error(JSON.stringify(err.payload));
  process.exit(1);
});
