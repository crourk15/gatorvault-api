#!/usr/bin/env node
/**
 * Deploy gatorvault-api to Render via REST API.
 * Requires: RENDER_API_KEY in environment (Account Settings → API Keys).
 *
 * Usage (from server/):
 *   set RENDER_API_KEY=rnd_...
 *   node scripts/deploy-render.js --deploy --clear-cache
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const API = 'https://api.render.com/v1';
const REPO = 'https://github.com/crourk15/gatorvault-api';
const SERVICE_NAME = 'gatorvault-api';

const key = process.env.RENDER_API_KEY;
if (!key) {
  console.error('Set RENDER_API_KEY (Render Dashboard → Account Settings → API Keys)');
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

function envVar(key, value) {
  return { key, value: String(value) };
}

async function findService() {
  const rows = await api(`/services?name=${encodeURIComponent(SERVICE_NAME)}&limit=20`);
  const found = (rows || []).find((row) => (row.service || row).name === SERVICE_NAME);
  return found ? (found.service || found) : null;
}

async function triggerDeploy(serviceId, { clearCache = false } = {}) {
  const body = clearCache ? { clearCache: 'clear' } : {};
  const deploy = await api(`/services/${serviceId}/deploys`, {
    method: 'POST',
    body: JSON.stringify(body)
  });
  const row = deploy.deploy || deploy;
  console.log('Deploy triggered:', row.id, row.status || 'started', clearCache ? '(build cache cleared)' : '');
  return row;
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const doDeploy = args.has('--deploy');
  const clearCache = args.has('--clear-cache');

  const owners = await api('/owners?limit=20');
  const owner = owners[0]?.owner || owners[0];
  if (!owner?.id) throw new Error('No Render workspace found for this API key');
  console.log('Workspace:', owner.name || owner.email || owner.id);

  const existing = await findService();
  if (existing) {
    const svc = existing;
    console.log('Service:', svc.id, svc.serviceDetails?.url || `https://${SERVICE_NAME}.onrender.com`);
    if (doDeploy) {
      await triggerDeploy(svc.id, { clearCache });
      console.log('Monitor: https://dashboard.render.com/web/' + svc.id);
      return;
    }
    const status = await fetch(`${svc.serviceDetails?.url || `https://${SERVICE_NAME}.onrender.com`}/api/recruiting/ingest/status`);
    if (status.ok) {
      console.log('Ingest status:', await status.json());
    }
    return;
  }

  const payload = {
    type: 'web_service',
    name: SERVICE_NAME,
    ownerId: owner.id,
    repo: REPO,
    branch: 'main',
    autoDeploy: 'yes',
    rootDir: 'server',
    envVars: [
      envVar('NODE_ENV', 'production'),
      envVar('SITE_URL', process.env.SITE_URL || 'https://gatorvaultinsider.com'),
      envVar('EMAIL_PROVIDER', 'emailjs'),
      envVar('ON3_INGEST_ENABLED', 'true'),
      envVar('ON3_INGEST_INTERVAL_MS', '120000'),
      envVar('ON3_CLASS_YEARS', '2026,2027'),
      envVar('ON3_INGEST_BOOT_DELAY_MS', '15000'),
      envVar('SESSION_SECRET', process.env.SESSION_SECRET || require('crypto').randomBytes(32).toString('hex')),
      envVar('EMAILJS_PUBLIC_KEY', process.env.EMAILJS_PUBLIC_KEY),
      envVar('EMAILJS_PRIVATE_KEY', process.env.EMAILJS_PRIVATE_KEY),
      envVar('EMAILJS_SERVICE_ID', process.env.EMAILJS_SERVICE_ID),
      envVar('EMAILJS_TEMPLATE_ID', process.env.EMAILJS_TEMPLATE_ID),
      envVar('EMAILJS_REPLY_TO', process.env.EMAILJS_REPLY_TO || 'gatorvaultinsider@gmail.com'),
      envVar('RECRUITING_ADMIN_PIN', process.env.RECRUITING_ADMIN_PIN || 'GV2026admin'),
      envVar('EMAIL_TEST_PIN', process.env.EMAIL_TEST_PIN || 'GV2026admin')
    ].filter((row) => row.value),
    serviceDetails: {
      runtime: 'node',
      plan: 'free',
      region: 'oregon',
      healthCheckPath: '/api/recruiting/ingest/status',
      envSpecificDetails: {
        buildCommand: 'npm install',
        startCommand: 'npm start'
      }
    }
  };

  const created = await api('/services', { method: 'POST', body: JSON.stringify(payload) });
  const svc = created.service || created;
  console.log('Created service:', svc.id);
  console.log('URL: https://' + SERVICE_NAME + '.onrender.com');
  console.log('Wait ~2–3 min for first deploy, then check /api/recruiting/ingest/status');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
