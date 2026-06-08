#!/usr/bin/env node
/**
 * Set matching EmailJS env vars on Render gatorvault-api, then redeploy.
 *
 * Usage (from server/):
 *   Add RENDER_API_KEY=rnd_... to server/.env
 *   node scripts/set-render-emailjs-env.js
 *   node scripts/set-render-emailjs-env.js --deploy
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const API = 'https://api.render.com/v1';
const SERVICE_NAME = 'gatorvault-api';

const key = process.env.RENDER_API_KEY;
if (!key) {
  console.error('Missing RENDER_API_KEY in server/.env');
  process.exit(1);
}

const publicKey = process.env.EMAILJS_USER_ID || process.env.EMAILJS_PUBLIC_KEY;
const privateKey = process.env.EMAILJS_PRIVATE_KEY;

if (!publicKey || !privateKey) {
  console.error('Missing EMAILJS_USER_ID (or EMAILJS_PUBLIC_KEY) and EMAILJS_PRIVATE_KEY in server/.env');
  process.exit(1);
}

const VARS = {
  EMAILJS_USER_ID: publicKey,
  EMAILJS_PRIVATE_KEY: privateKey,
  EMAILJS_SERVICE_ID: process.env.EMAILJS_SERVICE_ID || 'service_ul7ju9p',
  EMAILJS_TEMPLATE_ID: process.env.EMAILJS_TEMPLATE_ID || 'template_okh1hj8',
  EMAILJS_REPLY_TO: process.env.EMAILJS_REPLY_TO || 'gatorvaultinsider@gmail.com',
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
  if (!res.ok) throw new Error(`${opts.method || 'GET'} ${path} → ${res.status}: ${typeof body === 'string' ? body : JSON.stringify(body)}`);
  return body;
}

function mask(val) {
  if (!val) return '(empty)';
  return `${val.slice(0, 4)}…${val.slice(-4)} (${val.length} chars)`;
}

async function main() {
  const doDeploy = process.argv.includes('--deploy');
  const rows = await api(`/services?name=${encodeURIComponent(SERVICE_NAME)}&limit=20`);
  const svc = (rows || []).find((row) => (row.service || row).name === SERVICE_NAME);
  if (!svc) throw new Error(`Service ${SERVICE_NAME} not found`);
  const service = svc.service || svc;
  console.log('Service:', service.id);

  const existing = await api(`/services/${service.id}/env-vars?limit=100`);
  const byKey = {};
  for (const row of existing || []) {
    const ev = row.envVar || row;
    if (ev.key) byKey[ev.key] = ev;
  }

  console.log('\nSetting EmailJS env vars (must be from the same EmailJS account):');
  for (const [k, value] of Object.entries(VARS)) {
    console.log(`  ${k}: ${mask(value)}`);
    const prev = byKey[k];
    if (prev && prev.id) {
      await api(`/services/${service.id}/env-vars/${prev.id}`, {
        method: 'PUT',
        body: JSON.stringify({ value: String(value) })
      });
    } else {
      await api(`/services/${service.id}/env-vars`, {
        method: 'POST',
        body: JSON.stringify({ key: k, value: String(value) })
      });
    }
  }

  // Remove stale public key var if USER_ID is canonical
  const stale = byKey.EMAILJS_PUBLIC_KEY;
  if (stale && stale.id && publicKey !== process.env.EMAILJS_PUBLIC_KEY) {
    console.log('  (keeping EMAILJS_PUBLIC_KEY in sync)');
    await api(`/services/${service.id}/env-vars/${stale.id}`, {
      method: 'PUT',
      body: JSON.stringify({ value: String(publicKey) })
    });
  }

  console.log('\nEmailJS env vars updated on Render.');

  if (doDeploy) {
    const deploy = await api(`/services/${service.id}/deploys`, {
      method: 'POST',
      body: JSON.stringify({ clearCache: 'clear' })
    });
    const row = deploy.deploy || deploy;
    console.log('Deploy triggered:', row.id, row.status || 'started');
  } else {
    console.log('Re-run with --deploy to redeploy now.');
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
