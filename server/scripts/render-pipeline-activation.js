#!/usr/bin/env node
/**
 * Activate recruiting intel pipelines on Render (schedulers + movement engine env).
 * Also triggers a redeploy so env vars take effect.
 *
 * Requires RENDER_API_KEY in server/.env
 * X_BEARER_TOKEN must already be set on Render (not overwritten here).
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { PIPELINE_ACTIVATION_ENV } = require('../lib/pipeline-activation-env');
const { UF_PREMIUM_AUTOPOSTER_ENV } = require('../lib/autoposter/uf-premium-mode');

const API = 'https://api.render.com/v1';
const SERVICE_NAME = 'gatorvault-api';

const key = process.env.RENDER_API_KEY;
if (!key) {
  console.error('Missing RENDER_API_KEY in server/.env');
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${key}`,
  'Content-Type': 'application/json',
  Accept: 'application/json',
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
    body: JSON.stringify({ value: String(value) }),
  });
}

async function main() {
  const svc = await findService();
  if (!svc) throw new Error(`Service ${SERVICE_NAME} not found`);

  console.log('Service:', svc.id, svc.serviceDetails?.url || `https://${SERVICE_NAME}.onrender.com`);

  const activation = {
    ...UF_PREMIUM_AUTOPOSTER_ENV,
    ...PIPELINE_ACTIVATION_ENV,
  };

  for (const [envKey, value] of Object.entries(activation)) {
    await upsertEnvVar(svc.id, envKey, value);
    console.log(`Set ${envKey}=${value}`);
  }

  const existing = await api(`/services/${svc.id}/env-vars?limit=100`);
  const byKey = {};
  for (const row of existing || []) {
    const ev = row.envVar || row;
    if (ev.key) byKey[ev.key] = ev.value ?? ev;
  }

  if (!byKey.X_BEARER_TOKEN) {
    console.warn('');
    console.warn('WARNING: X_BEARER_TOKEN is not set on Render.');
    console.warn('Beat writer intel ingest will not run until you add it in the Render dashboard.');
    console.warn('Render → gatorvault-api → Environment → X_BEARER_TOKEN → redeploy');
    console.warn('');
  } else {
    console.log('X_BEARER_TOKEN: (set)');
  }

  if (!byKey.MONITORING_CRON_SECRET && !byKey.INGEST_CRON_SECRET) {
    console.warn('WARNING: MONITORING_CRON_SECRET / INGEST_CRON_SECRET not set — Render crons will fail auth.');
  }

  const deploy = await api(`/services/${svc.id}/deploys`, {
    method: 'POST',
    body: JSON.stringify({ clearCache: 'clear' }),
  });
  const row = deploy.deploy || deploy;
  console.log('Deploy triggered:', row.id, row.status || 'started');
  console.log('Monitor: https://dashboard.render.com/web/' + svc.id);
  console.log('');
  console.log('After deploy: beat ingest runs every 10m (cron) + in-process schedulers when instance is up.');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
