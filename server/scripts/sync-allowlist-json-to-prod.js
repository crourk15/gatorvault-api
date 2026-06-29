'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const https = require('https');
const { warmApi, withRetries } = require('../lib/ingest-resilience');
const { ALLOWLIST_2027, ALLOWLIST_2028 } = require('../lib/recruiting-target-allowlist');
const { loadPlayersJson } = require('../lib/sync-json-players-to-store');
const { isCommittedElsewhere } = require('../lib/recruiting-target-filters');

const API = process.env.API_ORIGIN || process.env.API_URL || 'https://gatorvault-api.onrender.com';
const PIN = process.env.RECRUITING_ADMIN_PIN || process.env.ADMIN_PASSWORD;

function activeAllowlistSlugs(classYear) {
  const allowlist = classYear === 2027 ? ALLOWLIST_2027 : classYear === 2028 ? ALLOWLIST_2028 : [];
  const bySlug = new Map(loadPlayersJson().map((p) => [String(p.slug || '').toLowerCase(), p]));
  return allowlist.filter((slug) => {
    const p = bySlug.get(slug);
    if (!p || p.category !== 'target') return false;
    if (isCommittedElsewhere(p)) return false;
    return true;
  });
}

function resolveSlugs() {
  if (process.env.SYNC_SLUGS) {
    return process.env.SYNC_SLUGS.split(',').map((s) => s.trim()).filter(Boolean);
  }
  const yearArg = process.argv.find((a) => a.startsWith('--class-year='));
  const classYear = yearArg
    ? parseInt(yearArg.split('=')[1], 10)
    : parseInt(process.env.SYNC_CLASS_YEAR || '2027', 10);
  return activeAllowlistSlugs(classYear);
}

function postJson(path, body, pin) {
  const payload = JSON.stringify(body);
  const url = new URL(API.replace(/\/$/, '') + path);
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
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          let json = null;
          try {
            json = JSON.parse(data);
          } catch {
            /* ignore */
          }
          resolve({ status: res.statusCode, json, raw: data });
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('timeout'));
    });
    req.write(payload);
    req.end();
  });
}

async function postJsonWithRetry(path, body, pin) {
  return withRetries(
    async () => {
      const res = await postJson(path, body, pin);
      if ([502, 503, 504, 429].includes(res.status)) {
        const err = new Error(`sync HTTP ${res.status}`);
        err.status = res.status;
        throw err;
      }
      return res;
    },
    { label: 'sync-json-slugs', attempts: 5, baseDelayMs: 3000 }
  );
}

async function main() {
  if (!PIN) {
    console.error('[sync-allowlist-json-to-prod] Set RECRUITING_ADMIN_PIN or ADMIN_PASSWORD');
    process.exit(1);
  }
  const SLUGS = resolveSlugs();
  if (!SLUGS.length) {
    console.error('[sync-allowlist-json-to-prod] No slugs to sync');
    process.exit(1);
  }
  console.log('[sync-allowlist-json-to-prod] api=' + API + ' slugs=' + SLUGS.join(','));
  const warm = await warmApi(API, { attempts: 4, waitMs: 5000, timeoutMs: 90000 });
  if (!warm.ok) {
    console.warn('[sync-allowlist-json-to-prod] API warm check did not pass; continuing with retries');
  }
  const res = await postJsonWithRetry(
    '/api/admin/recruiting/sync-json-slugs',
    { slugs: SLUGS, pin: PIN, warmHub: true },
    PIN
  );
  if (res.json) {
    console.log(JSON.stringify(res.json, null, 2));
  } else if (typeof res.raw === 'string' && res.raw.length < 4000) {
    console.log(res.raw);
  } else {
    console.log('[sync-allowlist-json-to-prod] response status', res.status, '(non-JSON body omitted)');
  }
  if (res.status !== 200 || !res.json?.ok) process.exit(1);
}

main().catch((err) => {
  console.error('[sync-allowlist-json-to-prod] error:', err.message);
  process.exit(1);
});
