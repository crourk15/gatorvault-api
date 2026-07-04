#!/usr/bin/env node
/** PR-6 soft launch — golden four live on Render; PR-789 shadow only. */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const API = 'https://api.render.com/v1';
const SERVICE_NAME = 'gatorvault-api';
const PROD = (process.env.QA_API_URL || 'https://gatorvault-api.onrender.com').replace(/\/$/, '');

const PR6_ROLLOUT_ENV = {
  X_AUTOPOST_PR6_SHADOW: 'true',
  X_AUTOPOST_PR6_ENABLED: 'true',
  X_AUTOPOST_PR7_8_9_SHADOW: 'true',
  X_AUTOPOST_PR7_8_9_ENABLED: 'false'
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

  console.log('[pr6-soft-launch] service', svc.id, svc.serviceDetails?.url || '');
  console.log('[pr6-soft-launch] golden four only: drakeford, robinson, willingham, ham');
  console.log('[pr6-soft-launch] setting env:');
  for (const [key, value] of Object.entries(PR6_ROLLOUT_ENV)) {
    await upsertEnvVar(svc.id, key, value);
  }

  if (skipDeploy) {
    console.log('[pr6-soft-launch] env synced (--no-deploy). Redeploy manually to pick up code + env.');
    return;
  }

  const deploy = await renderApi(`/services/${svc.id}/deploys`, {
    method: 'POST',
    body: JSON.stringify({ clearCache: 'clear' })
  });
  const row = deploy?.deploy || deploy || {};
  console.log('[pr6-soft-launch] deploy triggered', row.id || '(accepted)', row.status || 'started');
  console.log('[pr6-soft-launch] monitor:', `https://dashboard.render.com/web/${svc.id}`);

  try {
    const health = await fetch(`${PROD}/api/health`).then((r) => r.json());
    console.log('[pr6-soft-launch] current deploy:', health.deploy || health);
  } catch (err) {
    console.log('[pr6-soft-launch] health check skipped:', err.message);
  }

  console.log('\n[pr6-soft-launch] Detectives checks: validationMeta.pr6Live, pr6GoldenBeat, pr5Text, pr789Shadow');
  console.log('[pr6-soft-launch] PR-789 stays shadow until X_AUTOPOST_PR7_8_9_ENABLED=true after your sign-off.');
}

main().catch((err) => {
  console.error('[pr6-soft-launch] fatal:', err.message);
  process.exit(1);
});
