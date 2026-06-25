#!/usr/bin/env node
/**
 * Generate (if missing) and sync VAPID keys to Render gatorvault-api, then redeploy.
 *
 * Usage (from server/):
 *   RENDER_API_KEY in server/.env
 *   node scripts/set-render-vapid-env.js --deploy
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const webpush = require('web-push');

const API = 'https://api.render.com/v1';
const SERVICE_NAME = 'gatorvault-api';
const ENV_PATH = path.join(__dirname, '..', '.env');

function clean(val) {
  if (val == null) return '';
  return String(val).trim();
}

function mask(val) {
  if (!val) return '(empty)';
  return `${val.slice(0, 8)}…${val.slice(-6)} (${val.length} chars)`;
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

const renderKey = clean(process.env.RENDER_API_KEY);
if (!renderKey) {
  console.error('Missing RENDER_API_KEY in server/.env');
  process.exit(1);
}

let publicKey = clean(process.env.VAPID_PUBLIC_KEY);
let privateKey = clean(process.env.VAPID_PRIVATE_KEY);

if (!publicKey || !privateKey) {
  const generated = webpush.generateVAPIDKeys();
  publicKey = generated.publicKey;
  privateKey = generated.privateKey;
  upsertLocalEnv({
    VAPID_PUBLIC_KEY: publicKey,
    VAPID_PRIVATE_KEY: privateKey,
    PUSH_ALERTS_ENABLED: 'true',
    VAPID_SUBJECT: clean(process.env.VAPID_SUBJECT) || 'mailto:support@gatorvaultinsider.com',
  });
  console.log('Generated new VAPID keys and saved to server/.env (not committed).');
} else {
  console.log('Using VAPID keys from server/.env');
}

const VARS = {
  VAPID_PUBLIC_KEY: publicKey,
  VAPID_PRIVATE_KEY: privateKey,
  PUSH_ALERTS_ENABLED: 'true',
  VAPID_SUBJECT: clean(process.env.VAPID_SUBJECT) || 'mailto:support@gatorvaultinsider.com',
};

const headers = {
  Authorization: `Bearer ${renderKey}`,
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
    throw new Error(
      `${opts.method || 'GET'} ${pathname} → ${res.status}: ${typeof body === 'string' ? body.slice(0, 200) : JSON.stringify(body).slice(0, 200)}`
    );
  }
  return body;
}

async function upsertEnvVar(serviceId, envKey, value) {
  await api(`/services/${serviceId}/env-vars/${encodeURIComponent(envKey)}`, {
    method: 'PUT',
    body: JSON.stringify({ value: String(value) }),
  });
}

async function waitForLive(serviceId, maxMs = 600000) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    const rows = await api(`/services/${serviceId}/deploys?limit=1`);
    const deploy = (rows?.[0]?.deploy || rows?.[0]) ?? null;
    const status = deploy?.status || deploy?.state || 'unknown';
    console.log(`  deploy status: ${status}`);
    if (/live|succeeded|active/i.test(status)) return deploy;
    if (/failed|canceled|cancelled/i.test(status)) {
      throw new Error(`Deploy failed: ${status}`);
    }
    await new Promise((r) => setTimeout(r, 15000));
  }
  throw new Error('Deploy wait timeout');
}

async function main() {
  const doDeploy = process.argv.includes('--deploy');
  const rows = await api(`/services?name=${encodeURIComponent(SERVICE_NAME)}&limit=20`);
  const svc = (rows || []).find((row) => (row.service || row).name === SERVICE_NAME);
  if (!svc) throw new Error(`Service ${SERVICE_NAME} not found`);
  const service = svc.service || svc;
  console.log('Service:', service.id);

  console.log('\nSetting VAPID env vars on Render:');
  for (const [k, value] of Object.entries(VARS)) {
    console.log(`  ${k}: ${mask(value)}`);
    await upsertEnvVar(service.id, k, value);
  }
  console.log('\nVAPID env vars updated on Render.');

  if (!doDeploy) {
    console.log('Re-run with --deploy to redeploy now.');
    return;
  }

  const deploy = await api(`/services/${service.id}/deploys`, {
    method: 'POST',
    body: JSON.stringify({ clearCache: 'clear' }),
  });
  const row = deploy.deploy || deploy;
  console.log('Deploy triggered:', row.id, row.status || 'started');
  console.log('Waiting for live deploy…');
  await waitForLive(service.id);
  console.log('Render deploy is live.');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
