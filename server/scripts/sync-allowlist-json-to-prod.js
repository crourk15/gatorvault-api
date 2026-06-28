'use strict';

const https = require('https');

const API = process.env.API_ORIGIN || 'https://gatorvault-api.onrender.com';
const PIN = process.env.RECRUITING_ADMIN_PIN || process.env.ADMIN_PASSWORD;
const SLUGS = (process.env.SYNC_SLUGS || 'jalen-brewster,kaleb-exume,easton-royal')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function postJson(path, body, pin) {
  const payload = JSON.stringify(body);
  const url = new URL(API + path);
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: url.hostname,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          'X-Recruiting-Pin': pin,
        },
        timeout: 180000,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          let json = null;
          try { json = JSON.parse(data); } catch {}
          resolve({ status: res.statusCode, json, raw: data });
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.write(payload);
    req.end();
  });
}

async function main() {
  if (!PIN) {
    console.error('[sync-allowlist-json-to-prod] Set RECRUITING_ADMIN_PIN or ADMIN_PASSWORD');
    process.exit(1);
  }
  console.log('[sync-allowlist-json-to-prod] api=' + API + ' slugs=' + SLUGS.join(','));
  const res = await postJson('/api/admin/recruiting/sync-json-slugs', { slugs: SLUGS, pin: PIN, warmHub: true }, PIN);
  console.log(JSON.stringify(res.json || res.raw, null, 2));
  if (res.status !== 200 || !res.json?.ok) process.exit(1);
}

main().catch((err) => {
  console.error('[sync-allowlist-json-to-prod] error:', err.message);
  process.exit(1);
});