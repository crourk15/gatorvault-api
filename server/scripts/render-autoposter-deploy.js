#!/usr/bin/env node
/**
 * Enable X autoposter on Render and trigger redeploy.
 * Also syncs X_OAUTH1_* from Render → server/.env (local refresh).
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');

const API = 'https://api.render.com/v1';
const SERVICE_NAME = 'gatorvault-api';
const ENV_PATH = path.join(__dirname, '..', '.env');

const key = process.env.RENDER_API_KEY;
if (!key) {
  console.error('Missing RENDER_API_KEY in server/.env');
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${key}`,
  'Content-Type': 'application/json',
  Accept: 'application/json'
};

async function api(pathname, opts = {}) {
  const res = await fetch(`${API}${pathname}`, { ...opts, headers: { ...headers, ...opts.headers } });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    throw new Error(`${opts.method || 'GET'} ${pathname} → ${res.status}: ${typeof body === 'string' ? body : JSON.stringify(body)}`);
  }
  return body;
}

async function findService() {
  const rows = await api(`/services?name=${encodeURIComponent(SERVICE_NAME)}&limit=20`);
  const found = (rows || []).find((row) => (row.service || row).name === SERVICE_NAME);
  return found ? found.service || found : null;
}

async function upsertEnvVar(serviceId, envKey, value) {
  await api(`/services/${serviceId}/env-vars/${encodeURIComponent(envKey)}`, {
    method: 'PUT',
    body: JSON.stringify({ value: String(value) })
  });
}

function upsertLocalEnv(keys) {
  let text = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf8') : '';
  for (const [k, v] of Object.entries(keys)) {
    if (v == null || v === '') continue;
    const re = new RegExp(`^${k}=.*$`, 'm');
    const line = `${k}=${v}`;
    text = re.test(text) ? text.replace(re, line) : `${text.trimEnd()}\n${line}\n`;
  }
  fs.writeFileSync(ENV_PATH, text.endsWith('\n') ? text : `${text}\n`);
}

async function main() {
  const svc = await findService();
  if (!svc) throw new Error(`Service ${SERVICE_NAME} not found`);

  console.log('Service:', svc.id);

  const existing = await api(`/services/${svc.id}/env-vars?limit=100`);
  const byKey = {};
  for (const row of existing || []) {
    const ev = row.envVar || row;
    if (ev.key) byKey[ev.key] = ev.value ?? ev;
  }

  await upsertEnvVar(svc.id, 'X_AUTOPOST_ENABLED', 'true');
  console.log('Set X_AUTOPOST_ENABLED=true on Render');

  const pullKeys = [
    'X_OAUTH1_API_KEY',
    'X_OAUTH1_API_SECRET',
    'X_OAUTH1_ACCESS_TOKEN',
    'X_OAUTH1_ACCESS_TOKEN_SECRET',
    'X_AUTOPOST_ENABLED'
  ];
  const local = {};
  for (const k of pullKeys) {
    const val = typeof byKey[k] === 'string' ? byKey[k] : byKey[k]?.value;
    if (val) local[k] = val;
  }
  local.X_AUTOPOST_ENABLED = 'true';
  upsertLocalEnv(local);
  console.log('Updated local server/.env with Render X OAuth keys');

  const deploy = await api(`/services/${svc.id}/deploys`, {
    method: 'POST',
    body: JSON.stringify({ clearCache: 'clear' })
  });
  const row = deploy.deploy || deploy;
  console.log('Deploy triggered:', row.id, row.status || 'started');
  console.log('Monitor: https://dashboard.render.com/web/' + svc.id);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
