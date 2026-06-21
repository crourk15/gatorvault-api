#!/usr/bin/env node
/**
 * Render cron — trigger On3/Rivals ingest + hub cache refresh on schedule.
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
      'User-Agent': 'gatorvault-recruiting-ingest-cron/1.0',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(180000),
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
  const on3 = await postIngest('/api/recruiting/ingest', {});
  let rivals = null;
  if (process.env.RIVALS_PM_INGEST_ENABLED !== 'false') {
    rivals = await postIngest('/api/recruiting/rivals-pm/ingest', {});
  }
  const hub = await postIngest('/api/recruiting/hub/refresh?geoBackfill=true', {});

  console.log(
    '[recruiting-ingest-cron] ok',
    JSON.stringify({
      on3Fired: on3?.fired?.length ?? 0,
      rivalsProcessed: rivals?.processedCount ?? null,
      hubEnriched: hub?.enrichedPlayerCount ?? null,
      at: new Date().toISOString(),
    })
  );
}

main().catch((err) => {
  console.error('[recruiting-ingest-cron] failed:', err.message);
  process.exit(1);
});
