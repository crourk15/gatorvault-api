#!/usr/bin/env node
/**
 * Set matching EmailJS env vars on Render gatorvault-api, then redeploy.
 *
 * Usage (from server/):
 *   Add RENDER_API_KEY=rnd_... to server/.env
 *   node scripts/set-render-emailjs-env.js --deploy
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const API = 'https://api.render.com/v1';
const SERVICE_NAME = 'gatorvault-api';

function clean(val) {
  if (val == null) return '';
  return String(val).trim();
}

const key = clean(process.env.RENDER_API_KEY);
if (!key) {
  console.error('Missing RENDER_API_KEY in server/.env');
  process.exit(1);
}

const publicKey = clean(process.env.EMAILJS_USER_ID || process.env.EMAILJS_PUBLIC_KEY);
const privateKey = clean(process.env.EMAILJS_PRIVATE_KEY);

if (!publicKey || !privateKey) {
  console.error('Missing EMAILJS_USER_ID (or EMAILJS_PUBLIC_KEY) and EMAILJS_PRIVATE_KEY in server/.env');
  process.exit(1);
}

const VARS = {
  EMAILJS_USER_ID: publicKey,
  EMAILJS_PUBLIC_KEY: publicKey,
  EMAILJS_PRIVATE_KEY: privateKey,
  EMAILJS_SERVICE_ID: clean(process.env.EMAILJS_SERVICE_ID) || 'service_ul7ju9p',
  EMAILJS_TEMPLATE_ID: clean(process.env.EMAILJS_TEMPLATE_ID) || 'template_okh1hj8',
  EMAILJS_REPLY_TO: clean(process.env.EMAILJS_REPLY_TO) || 'gatorvaultinsider@gmail.com',
  EMAIL_PROVIDER: 'emailjs'
};

const headers = {
  Authorization: `Bearer ${key}`,
  'Content-Type': 'application/json',
  Accept: 'application/json'
};

async function api(path, opts = {}) {
  const res = await fetch(`${API}${path}`, { ...opts, headers: { ...headers, ...opts.headers } });
  const text = await res.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) {
    throw new Error(`${opts.method || 'GET'} ${path} → ${res.status}: ${typeof body === 'string' ? body : JSON.stringify(body)}`);
  }
  return body;
}

function mask(val) {
  if (!val) return '(empty)';
  return `${val.slice(0, 4)}…${val.slice(-4)} (${val.length} chars)`;
}

async function upsertEnvVar(serviceId, envKey, value) {
  await api(`/services/${serviceId}/env-vars/${encodeURIComponent(envKey)}`, {
    method: 'PUT',
    body: JSON.stringify({ value: String(value) })
  });
}

async function main() {
  const doDeploy = process.argv.includes('--deploy');
  const rows = await api(`/services?name=${encodeURIComponent(SERVICE_NAME)}&limit=20`);
  const svc = (rows || []).find((row) => (row.service || row).name === SERVICE_NAME);
  if (!svc) throw new Error(`Service ${SERVICE_NAME} not found`);
  const service = svc.service || svc;
  console.log('Service:', service.id);

  console.log('\nSetting EmailJS env vars (trimmed, matching pair):');
  for (const [k, value] of Object.entries(VARS)) {
    console.log(`  ${k}: ${mask(value)}`);
    await upsertEnvVar(service.id, k, value);
  }

  console.log('\nEmailJS env vars updated on Render.');
  console.log(`  Public key length: ${publicKey.length} chars`);
  console.log(`  Private key length: ${privateKey.length} chars`);

  if (doDeploy) {
    const deploy = await api(`/services/${service.id}/deploys`, {
      method: 'POST',
      body: JSON.stringify({ clearCache: 'clear' })
    });
    const row = deploy.deploy || deploy;
    console.log('Deploy triggered:', row.id, row.status || 'started');
    console.log('Monitor: https://dashboard.render.com/web/' + service.id);
  } else {
    console.log('Re-run with --deploy to redeploy now.');
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
