#!/usr/bin/env node
/**
 * Sync EmailJS (and other) env vars from server/.env to Render gatorvault-api.
 * Requires RENDER_API_KEY in server/.env or environment.
 *
 * Usage:
 *   node scripts/sync-render-env.js
 *   node scripts/sync-render-env.js --deploy
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const API = 'https://api.render.com/v1';
const SERVICE_NAME = 'gatorvault-api';

const SYNC_KEYS = [
  'EMAILJS_PRIVATE_KEY',
  'EMAILJS_SERVICE_ID',
  'EMAILJS_TEMPLATE_ID',
  'EMAILJS_ONBOARDING_TEMPLATE_ID',
  'EMAILJS_REPLY_TO',
  'EMAIL_PROVIDER',
  'EMAIL_TEST_PIN',
  'BEEHIIV_API_KEY',
  'BEEHIIV_PUBLICATION_ID',
  'BEEHIIV_AUTOMATION_ID'
];

const key = process.env.RENDER_API_KEY;
if (!key) {
  console.error('Missing RENDER_API_KEY — add to server/.env (Render → Account Settings → API Keys)');
  process.exit(1);
}

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

async function findService() {
  const rows = await api(`/services?name=${encodeURIComponent(SERVICE_NAME)}&limit=20`);
  const found = (rows || []).find((row) => (row.service || row).name === SERVICE_NAME);
  return found ? (found.service || found) : null;
}

function mask(val) {
  if (!val) return '(empty)';
  if (val.length <= 8) return '****';
  return `${val.slice(0, 4)}…${val.slice(-4)} (${val.length} chars)`;
}

async function main() {
  const doDeploy = process.argv.includes('--deploy');
  const svc = await findService();
  if (!svc) throw new Error(`Service ${SERVICE_NAME} not found`);

  console.log('Service:', svc.id, svc.serviceDetails?.url || `https://${SERVICE_NAME}.onrender.com`);

  const existing = await api(`/services/${svc.id}/env-vars?limit=100`);
  const byKey = {};
  for (const row of existing || []) {
    const ev = row.envVar || row;
    if (ev.key) byKey[ev.key] = ev;
  }

  const updates = [];
  for (const k of SYNC_KEYS) {
    const val = process.env[k];
    if (val == null || val === '') continue;
    updates.push({ key: k, value: String(val) });
  }

  if (!updates.length) {
    console.error('No env vars to sync from server/.env');
    process.exit(1);
  }

  console.log('\nSyncing env vars:');
  for (const u of updates) {
    console.log(`  ${u.key}: ${mask(u.value)}`);
    const prev = byKey[u.key];
    if (prev && prev.id) {
      await api(`/services/${svc.id}/env-vars/${prev.id}`, {
        method: 'PUT',
        body: JSON.stringify({ value: u.value })
      });
    } else {
      await api(`/services/${svc.id}/env-vars`, {
        method: 'POST',
        body: JSON.stringify(u)
      });
    }
  }

  console.log('\nEnv sync complete.');

  if (doDeploy) {
    const deploy = await api(`/services/${svc.id}/deploys`, {
      method: 'POST',
      body: JSON.stringify({ clearCache: 'clear' })
    });
    const row = deploy.deploy || deploy;
    console.log('Deploy triggered:', row.id, row.status || 'started');
    console.log('Monitor: https://dashboard.render.com/web/' + svc.id);
  } else {
    console.log('Note: Render picks up env var changes on next deploy. Re-run with --deploy to redeploy now.');
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
