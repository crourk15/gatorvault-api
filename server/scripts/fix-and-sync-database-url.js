#!/usr/bin/env node
/**
 * Fix DATABASE_URL password encoding, update Render (full env-vars PUT), redeploy.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const API = 'https://api.render.com/v1';
const SERVICE_NAME = 'gatorvault-api';

function encodePassword(pass) {
  try {
    return encodeURIComponent(decodeURIComponent(pass));
  } catch {
    return encodeURIComponent(pass);
  }
}

function fixPostgresUrl(raw) {
  const url = String(raw || '').trim().replace(/^['"]|['"]$/g, '');
  if (!url) throw new Error('empty DATABASE_URL');
  const prefix = 'postgresql://';
  if (!url.toLowerCase().startsWith(prefix)) throw new Error('must start with postgresql://');
  const rest = url.slice(prefix.length);
  const at = rest.lastIndexOf('@');
  if (at < 0) throw new Error('missing @');
  const userinfo = rest.slice(0, at);
  const hostpart = rest.slice(at + 1);
  const colon = userinfo.indexOf(':');
  if (colon < 0) throw new Error('missing password');
  const user = userinfo.slice(0, colon);
  const pass = userinfo.slice(colon + 1);
  return `${prefix}${user}:${encodePassword(pass)}@${hostpart}`;
}

async function api(key, path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${key}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...opts.headers,
    },
  });
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

async function main() {
  const key = process.env.RENDER_API_KEY;
  if (!key) throw new Error('Missing RENDER_API_KEY in server/.env');

  const rows = await api(key, `/services?name=${encodeURIComponent(SERVICE_NAME)}&limit=20`);
  const svc = (rows || []).find((r) => (r.service || r).name === SERVICE_NAME);
  if (!svc) throw new Error('gatorvault-api not found');
  const serviceId = (svc.service || svc).id;

  const envRows = await api(key, `/services/${serviceId}/env-vars?limit=100`);
  const dbRow = (envRows || []).map((row) => row.envVar || row).find((ev) => ev.key === 'DATABASE_URL');

  let source =
    process.env.DATABASE_URL ||
    process.env.SUPABASE_DATABASE_URL ||
    dbRow?.value;
  if (!source) throw new Error('No DATABASE_URL in .env or Render');

  const fixed = fixPostgresUrl(source);
  const changed = fixed !== String(source).trim().replace(/^['"]|['"]$/g, '');

  const host = fixed.match(/@([^:/]+)/)?.[1] || '?';
  console.log(`DATABASE_URL → ${host} (pooler: ${/pooler|6543/.test(fixed)}, re-encoded: ${changed})`);

  await api(key, `/services/${serviceId}/env-vars/${encodeURIComponent('DATABASE_URL')}`, {
    method: 'PUT',
    body: JSON.stringify({ value: fixed }),
  });
  console.log('Render DATABASE_URL updated.');

  const deploy = await api(key, `/services/${serviceId}/deploys`, {
    method: 'POST',
    body: JSON.stringify({ clearCache: 'clear' }),
  });
  console.log('Deploy triggered:', (deploy.deploy || deploy).id);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
