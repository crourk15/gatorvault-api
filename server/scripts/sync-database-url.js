#!/usr/bin/env node
/**
 * Sync DATABASE_URL from server/.env to Render gatorvault-api and optionally redeploy.
 *
 * Usage:
 *   node scripts/sync-database-url.js
 *   node scripts/sync-database-url.js --deploy
 *
 * Requires in server/.env:
 *   RENDER_API_KEY
 *   DATABASE_URL  (Supabase shared pooler, port 6543)
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const API = 'https://api.render.com/v1';
const SERVICE_NAME = 'gatorvault-api';
const ENV_KEY = 'DATABASE_URL';

const key = process.env.RENDER_API_KEY;
const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL;

if (!key) {
  console.error('Missing RENDER_API_KEY in server/.env');
  process.exit(1);
}
if (!databaseUrl) {
  console.error(
    'Missing DATABASE_URL in server/.env — paste the Supabase shared pooler URI (port 6543) from Dashboard → Project Settings → Database → Connection string → URI'
  );
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${key}`,
  'Content-Type': 'application/json',
  Accept: 'application/json',
};

async function api(path, opts = {}) {
  const res = await fetch(`${API}${path}`, { ...opts, headers: { ...headers, ...opts.headers } });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    throw new Error(`${opts.method || 'GET'} ${path} → ${res.status}: ${typeof body === 'string' ? body : JSON.stringify(body)}`);
  }
  return body;
}

function describeUrl(url) {
  const pooler = /pooler\.supabase\.com|:6543/.test(url);
  const host = url.match(/@([^:/]+)/)?.[1] || '(unknown host)';
  return { pooler, host };
}

async function main() {
  const doDeploy = process.argv.includes('--deploy');
  const rows = await api(`/services?name=${encodeURIComponent(SERVICE_NAME)}&limit=20`);
  const svc = (rows || []).find((row) => (row.service || row).name === SERVICE_NAME);
  if (!svc) throw new Error(`Service ${SERVICE_NAME} not found`);

  const service = svc.service || svc;
  const existing = await api(`/services/${service.id}/env-vars?limit=100`);
  const current = (existing || []).map((row) => row.envVar || row).find((ev) => ev.key === ENV_KEY);

  const info = describeUrl(databaseUrl);
  console.log(`Updating Render ${ENV_KEY} → ${info.host} (pooler: ${info.pooler ? 'yes' : 'no'})`);

  if (current) {
    await api(`/services/${service.id}/env-vars/${encodeURIComponent(ENV_KEY)}`, {
      method: 'PUT',
      body: JSON.stringify({ value: databaseUrl }),
    });
    console.log('Env var updated.');
  } else {
    await api(`/services/${service.id}/env-vars`, {
      method: 'POST',
      body: JSON.stringify({ key: ENV_KEY, value: databaseUrl }),
    });
    console.log('Env var created.');
  }

  if (doDeploy) {
    const deploy = await api(`/services/${service.id}/deploys`, {
      method: 'POST',
      body: JSON.stringify({ clearCache: 'clear' }),
    });
    const row = deploy.deploy || deploy;
    console.log('Deploy triggered:', row.id, row.status || 'started');
    console.log('Monitor: https://dashboard.render.com/web/' + service.id);
  } else {
    console.log('Re-run with --deploy to redeploy now (Render also restarts on env change).');
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
