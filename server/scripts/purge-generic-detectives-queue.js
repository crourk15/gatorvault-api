#!/usr/bin/env node
/**
 * Cancel pending autoposter queue items that match generic Detectives fallback copy.
 * Usage:
 *   node scripts/purge-generic-detectives-queue.js           # local queue file
 *   node scripts/purge-generic-detectives-queue.js --remote  # production API
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const copy = require('../lib/x-autoposter-copy');
const qa = require('../lib/autoposter/recruiting-post-qa');
const store = require('../lib/x-autoposter-store');
const { primaryAdminPin } = require('../lib/admin-pin');

const API_BASE = (
  process.env.DEPLOY_GUARDIAN_API_URL ||
  process.env.API_URL ||
  'https://gatorvault-api.onrender.com'
).replace(/\/$/, '');

function isGenericDetectivesItem(item) {
  if (!item || item.status !== 'pending') return false;
  const src = String(item.source || '');
  const pathTag = item.validationMeta?.detectivesPath || '';
  const detectives =
    src.includes('detectives') ||
    item.validationMeta?.detectivesResolved === true ||
    String(item.sourceEventType || '').startsWith('detectives_');
  if (!detectives) return false;
  if (item.text && copy.isBrokenCopy(item.text, item)) return true;
  if (qa.isRecruitingPlayerCandidate(item) && !qa.passesPublishGate(item)) return true;
  if (pathTag === 'elite_research' && !item.playerSlug) return true;
  if (/full rpm, visit intel, and predictions on futurecast/i.test(String(item.text || ''))) return true;
  return false;
}

function purgeLocal() {
  const doc = store.loadQueue();
  const pending = doc.items.filter((i) => i.status === 'pending');
  const remove = pending.filter(isGenericDetectivesItem);
  if (!remove.length) {
    return { ok: true, removed: 0, pending: pending.length, ids: [] };
  }
  for (const item of remove) {
    store.cancelPost(item.id);
  }
  return {
    ok: true,
    removed: remove.length,
    pending: pending.length - remove.length,
    ids: remove.map((i) => i.id),
    previews: remove.map((i) => String(i.text || '').slice(0, 100))
  };
}

async function fetchJson(url, opts = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs || 120000);
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal });
    const text = await res.text();
    let body;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = { raw: text };
    }
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status} ${url}`);
      err.body = body;
      throw err;
    }
    return body;
  } finally {
    clearTimeout(timer);
  }
}

async function purgeRemote() {
  const pin = process.env.RECRUITING_ADMIN_PIN || process.env.X_AUTOPOST_PIN || primaryAdminPin();
  const headers = { 'x-recruiting-pin': pin, Accept: 'application/json' };
  const list = await fetchJson(`${API_BASE}/api/x/autoposter/queue?status=pending&limit=50`, { headers });
  const items = list.items || [];
  const remove = items.filter(isGenericDetectivesItem);
  const ids = [];
  for (const item of remove) {
    await fetchJson(`${API_BASE}/api/x/autoposter/queue/${encodeURIComponent(item.id)}`, {
      method: 'DELETE',
      headers
    });
    ids.push(item.id);
  }
  const after = await fetchJson(`${API_BASE}/api/x/autoposter/queue?status=pending&limit=50`, { headers });
  return {
    ok: true,
    removed: remove.length,
    pending: (after.items || []).length,
    ids,
    previews: remove.map((i) => String(i.text || '').slice(0, 100))
  };
}

async function main() {
  const remote = process.argv.includes('--remote');
  const out = remote ? await purgeRemote() : purgeLocal();
  console.log(JSON.stringify({ target: remote ? API_BASE : 'local', ...out }, null, 2));
}

main().catch((err) => {
  console.error(err.message || err);
  if (err.body) console.error(JSON.stringify(err.body, null, 2));
  process.exit(1);
});
