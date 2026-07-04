#!/usr/bin/env node
/** PR-7/8/9 golden-four live — competition + trajectory + brand voice on Render. */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const API = 'https://api.render.com/v1';
const SERVICE_NAME = 'gatorvault-api';

const ROLLOUT_ENV = {
  X_AUTOPOST_PR6_SHADOW: 'true',
  X_AUTOPOST_PR6_ENABLED: 'true',
  X_AUTOPOST_PR7_8_9_SHADOW: 'true',
  X_AUTOPOST_PR7_8_9_ENABLED: 'true'
};

const renderKey = process.env.RENDER_API_KEY;
if (!renderKey) {
  console.error('Missing RENDER_API_KEY in server/.env');
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${renderKey}`,
  'Content-Type': 'application/json',
  Accept: 'application/json'
};

async function renderApi(pathname, opts = {}) {
  const res = await fetch(`${API}${pathname}`, { ...opts, headers: { ...headers, ...opts.headers } });
  const text = await res.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  if (!res.ok) {
    throw new Error(`${opts.method || 'GET'} ${pathname} → ${res.status}: ${typeof body === 'string' ? body : JSON.stringify(body)}`);
  }
  return body;
}

async function findService() {
  const rows = await renderApi(`/services?name=${encodeURIComponent(SERVICE_NAME)}&limit=20`);
  const found = (rows || []).find((row) => (row.service || row).name === SERVICE_NAME);
  return found ? found.service || found : null;
}

async function upsertEnvVar(serviceId, key, value) {
  console.log(`  ${key}=${value}`);
  await renderApi(`/services/${serviceId}/env-vars/${encodeURIComponent(key)}`, {
    method: 'PUT',
    body: JSON.stringify({ value: String(value) })
  });
}

async function main() {
  const skipDeploy = process.argv.includes('--no-deploy');
  const svc = await findService();
  if (!svc) throw new Error(`Service ${SERVICE_NAME} not found`);

  console.log('[pr789-live] golden four only: drakeford, robinson, willingham, ham');
  console.log('[pr789-live] setting env:');
  for (const [key, value] of Object.entries(ROLLOUT_ENV)) {
    await upsertEnvVar(svc.id, key, value);
  }

  if (skipDeploy) {
    console.log('[pr789-live] env synced (--no-deploy). Redeploy to apply.');
    return;
  }

  await renderApi(`/services/${svc.id}/deploys`, {
    method: 'POST',
    body: JSON.stringify({ clearCache: 'clear' })
  });
  console.log('[pr789-live] deploy triggered');
  console.log('[pr789-live] Detectives: validationMeta.pr789Live=true on golden four publishes');
}

main().catch((err) => {
  console.error('[pr789-live] fatal:', err.message);
  process.exit(1);
});
