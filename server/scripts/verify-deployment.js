#!/usr/bin/env node
/**
 * Full deployment verification — Render API, crons, endpoints, Netlify proxy.
 * Usage: node server/scripts/verify-deployment.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const API = 'https://api.render.com/v1';
const RENDER_BASE = 'https://gatorvault-api.onrender.com';
const NETLIFY_BASE = 'https://gatorvaultinsider.com';

const EXPECTED_SERVICES = [
  { name: 'gatorvault-api', type: 'web' },
  { name: 'gatorvault-api-keepalive', type: 'cron' },
  { name: 'gatorvault-api-hub-refresh', type: 'cron' },
  { name: 'gatorvault-api-visit-intel-reconcile', type: 'cron' },
  { name: 'gatorvault-api-uf-fit-seed', type: 'cron', requiredEnv: ['DATABASE_URL'] },
  { name: 'gatorvault-api-early-discovery', type: 'cron', requiredEnv: ['DATABASE_URL'] },
  { name: 'gatorvault-api-portal-intelligence', type: 'cron', requiredEnv: ['MONITORING_CRON_SECRET', 'PORTAL_INTEL_RUN_URL'] },
];

const WEB_REQUIRED_ENV = [
  'NODE_ENV',
  'SITE_URL',
  'NEXT_PUBLIC_API_BASE',
  'DATABASE_URL',
  'SESSION_SECRET',
  'MONITORING_CRON_SECRET',
];

const HUB_CRON_REQUIRED_ENV = ['HUB_REFRESH_URL', 'MONITORING_CRON_SECRET'];
const VISIT_INTEL_CRON_REQUIRED_ENV = ['VISIT_INTEL_RECONCILE_URL', 'MONITORING_CRON_SECRET'];

const ENDPOINTS = [
  { label: 'Render /health', url: `${RENDER_BASE}/health`, maxMs: 3000, expectOk: true },
  { label: 'Render /api/ping', url: `${RENDER_BASE}/api/ping`, maxMs: 5000, expectOk: true },
  { label: 'Render /api/health', url: `${RENDER_BASE}/api/health`, maxMs: 15000, expectOk: true },
  { label: 'Netlify /api/ping', url: `${NETLIFY_BASE}/api/ping`, maxMs: 8000, expectOk: true },
  { label: 'Netlify /api/health', url: `${NETLIFY_BASE}/api/health`, maxMs: 20000, expectOk: true },
  {
    label: 'FutureCast health',
    url: `${RENDER_BASE}/api/futurecast/health`,
    maxMs: 15000,
    expectOk: true,
  },
  {
    label: 'Admin engines mounted',
    url: `${RENDER_BASE}/api/admin/engines/portal-intelligence/run`,
    method: 'POST',
    maxMs: 8000,
    expectStatus: 403,
  },
];

const key = process.env.RENDER_API_KEY;
const headers = key
  ? { Authorization: `Bearer ${key}`, Accept: 'application/json' }
  : null;

const issues = [];
const ok = [];

function record(pass, msg) {
  if (pass) ok.push(msg);
  else issues.push(msg);
}

async function renderApi(path, opts = {}) {
  const res = await fetch(`${API}${path}`, { ...opts, headers: { ...headers, ...opts.headers } });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) throw new Error(`${path} → ${res.status}: ${typeof body === 'string' ? body.slice(0, 200) : JSON.stringify(body).slice(0, 200)}`);
  return body;
}

async function listAllServices() {
  const out = [];
  let cursor = null;
  for (let page = 0; page < 10; page += 1) {
    const q = cursor ? `?cursor=${encodeURIComponent(cursor)}&limit=100` : '?limit=100';
    const rows = await renderApi(`/services${q}`);
    if (!Array.isArray(rows) || !rows.length) break;
    for (const row of rows) out.push(row.service || row);
    const last = rows[rows.length - 1];
    cursor = last?.cursor;
    if (!cursor) break;
  }
  return out;
}

async function getEnvVars(serviceId) {
  const rows = await renderApi(`/services/${serviceId}/env-vars?limit=100`);
  const map = {};
  for (const row of rows || []) {
    const ev = row.envVar || row;
    map[ev.key] = ev.value != null ? String(ev.value) : '';
  }
  return map;
}

async function getRecentJobs(serviceId, limit = 5) {
  try {
    return await renderApi(`/services/${serviceId}/jobs?limit=${limit}`);
  } catch {
    return [];
  }
}

async function probeEndpoint(spec) {
  const t0 = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), Math.max(spec.maxMs * 2, 30000));
  try {
    const res = await fetch(spec.url, {
      method: spec.method || 'GET',
      signal: ctrl.signal,
      headers: { Accept: 'application/json', 'User-Agent': 'gatorvault-verify/1.0' },
    });
    const ms = Date.now() - t0;
    let body = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    const statusOk = spec.expectStatus != null ? res.status === spec.expectStatus : res.ok === spec.expectOk;
    const pass =
      statusOk &&
      ms <= spec.maxMs &&
      (spec.expectStatus != null ||
        (spec.label.includes('health') && body?.alive !== false) ||
        body?.ok !== false);
    record(
      pass,
      `${spec.label}: HTTP ${res.status}, ${ms}ms${body?.ready != null ? `, ready=${body.ready}` : ''}${body?.hub?.status ? `, hub=${body.hub.status}` : ''}${body?.status === 'building' ? ', building' : ''}`
    );
    if (!pass && ms > spec.maxMs) issues.push(`${spec.label}: slow (${ms}ms > ${spec.maxMs}ms budget)`);
    if (!statusOk) issues.push(`${spec.label}: HTTP ${res.status}`);
    return { ms, status: res.status, body };
  } catch (err) {
    record(false, `${spec.label}: ${err.message} (${Date.now() - t0}ms)`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function warmRepeatProbe() {
  const times = [];
  for (let i = 0; i < 3; i += 1) {
    const t0 = Date.now();
    try {
      const res = await fetch(`${RENDER_BASE}/health`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(10000),
      });
      times.push({ ms: Date.now() - t0, status: res.status });
    } catch (err) {
      times.push({ ms: Date.now() - t0, error: err.message });
    }
    if (i < 2) await new Promise((r) => setTimeout(r, 1500));
  }
  const allFast = times.every((t) => t.status === 200 && t.ms < 3000);
  record(allFast, `Warm repeat /health x3: ${times.map((t) => (t.error ? `err:${t.ms}ms` : `${t.status}@${t.ms}ms`)).join(', ')}`);
}

async function main() {
  console.log('=== GatorVault deployment verification ===\n');

  if (!headers) {
    issues.push('RENDER_API_KEY missing — cannot audit Render services/env');
  } else {
    const services = await listAllServices();
    const byName = Object.fromEntries(services.map((s) => [s.name, s]));

    for (const exp of EXPECTED_SERVICES) {
      const svc = byName[exp.name];
      if (!svc) {
        record(false, `Render service missing: ${exp.name}`);
        continue;
      }
      record(true, `Render service: ${exp.name} (${svc.id}, ${svc.type || exp.type}, ${svc.suspended === 'suspended' ? 'suspended' : 'active'})`);

      const env = await getEnvVars(svc.id);
      const required =
        exp.requiredEnv ||
        (exp.name === 'gatorvault-api-hub-refresh'
          ? HUB_CRON_REQUIRED_ENV
          : exp.name === 'gatorvault-api-visit-intel-reconcile'
            ? VISIT_INTEL_CRON_REQUIRED_ENV
            : exp.name === 'gatorvault-api'
              ? WEB_REQUIRED_ENV
              : ['KEEPALIVE_URL']);
      for (const k of required) {
        const val = env[k];
        record(!!val, `${exp.name} env ${k}: ${val ? 'set' : 'MISSING'}`);
      }

      if (exp.type === 'cron') {
        const jobs = await getRecentJobs(svc.id, 8);
        const recent = (jobs || []).slice(0, 5).map((row) => {
          const j = row.job || row;
          return `${j.status || j.state || '?'} @ ${j.createdAt || j.startedAt || '?'}`;
        });
        if (recent.length) {
          const succeeded = recent.filter((r) => /succeeded|completed|live|finished/i.test(r)).length;
          record(succeeded > 0, `${exp.name} recent jobs: ${recent.join(' | ')}`);
        } else {
          record(false, `${exp.name}: no recent job runs found yet`);
        }
      }
    }
  }

  console.log('\n--- Endpoint probes ---');
  for (const spec of ENDPOINTS) {
    await probeEndpoint(spec);
  }

  console.log('\n--- Warm-state check ---');
  await warmRepeatProbe();

  console.log('\n--- Summary ---');
  console.log(`PASS (${ok.length}):`);
  ok.forEach((m) => console.log('  ✓', m));
  if (issues.length) {
    console.log(`\nISSUES (${issues.length}):`);
    issues.forEach((m) => console.log('  ✗', m));
    process.exit(1);
  }
  console.log('\nAll checks passed.');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
