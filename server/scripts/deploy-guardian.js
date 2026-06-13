#!/usr/bin/env node
/**
 * Deployment Guardian — pre-deploy gate (build, routing, API probes).
 *
 * Usage:
 *   node scripts/deploy-guardian.js --phase=pre
 *   node scripts/deploy-guardian.js --phase=pre --static   # file checks only (Netlify post-build)
 *   node scripts/deploy-guardian.js --phase=pre --api        # include live API probes
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const { verifyPlatformWiring } = require('../lib/guardian/platform-wiring');
const { verifyBlueprints } = require('../lib/guardian/blueprint-validator');

const SERVER_ROOT = path.join(__dirname, '..');
const STATIC_ONLY = process.argv.includes('--static');
const PROBE_API = process.argv.includes('--api') || (!STATIC_ONLY && process.env.DEPLOY_GUARDIAN_PROBE_API !== 'false');

const REQUIRED_HTML_ROUTES = [
  'index.html',
  'vault/futurecast/index.html',
  'vault/futurecast/player/index.html',
  'vault/recruiting-board/index.html',
  'vault/portal/player/index.html',
  'players/index.html',
  'portal/index.html',
  'futurecast/index.html',
  '_next/static',
  'build-manifest.json',
];

const CORE_API_PROBES = [
  { id: 'futurecast-home', path: '/api/futurecast/home' },
  { id: 'portal-players', path: '/api/portal/players?limit=5' },
  { id: 'recruiting-board', path: '/api/recruiting/board' },
  { id: 'roster-players', path: '/api/roster/players' },
  { id: 'articles-published', path: '/api/articles/published' },
  { id: 'film-room-catalog', path: '/api/film-room/catalog' },
  { id: 'health', path: '/api/health' },
];

async function timedFetch(url, timeoutMs = 20000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    let body = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    return { ok: res.ok, status: res.status, body };
  } catch (err) {
    clearTimeout(timer);
    return { ok: false, status: 0, error: err.message };
  }
}

function checkStaticRoutes() {
  const errors = [];
  for (const rel of REQUIRED_HTML_ROUTES) {
    const full = path.join(SERVER_ROOT, rel);
    if (!fs.existsSync(full)) {
      errors.push(`[routing] missing export: ${rel}`);
    }
  }

  const redirectsPath = path.join(SERVER_ROOT, '_redirects');
  if (fs.existsSync(redirectsPath)) {
    const text = fs.readFileSync(redirectsPath, 'utf8');
    if (!text.includes('/vault/futurecast')) errors.push('[routing] _redirects missing /vault/futurecast');
    if (!text.includes('/vault/portal/player')) errors.push('[routing] _redirects missing /vault/portal/player');
  } else {
    errors.push('[routing] server/_redirects missing');
  }

  const manifestPath = path.join(SERVER_ROOT, 'build-manifest.json');
  if (!fs.existsSync(manifestPath)) {
    errors.push('[build] build-manifest.json missing — run stamp-build-meta.js');
  }

  return errors;
}

async function checkApiProbes() {
  const errors = [];
  const base = (process.env.DEPLOY_GUARDIAN_API_URL || process.env.API_URL || 'https://gatorvault-api.onrender.com').replace(
    /\/$/,
    ''
  );

  for (const probe of CORE_API_PROBES) {
    const url = `${base}${probe.path}`;
    const r = await timedFetch(url);
    if (!r.ok || r.status >= 500) {
      errors.push(`[api] ${probe.id} failed: ${r.error || `HTTP ${r.status}`} (${url})`);
    }
  }

  return errors;
}

async function main() {
  const errors = [];
  const wiring = verifyPlatformWiring({ simulate: true });
  const blueprints = verifyBlueprints({ criticalOnly: true });
  if (!wiring.ok) errors.push(...wiring.errors);
  if (!blueprints.ok) errors.push(...blueprints.errors);
  errors.push(...checkStaticRoutes());

  if (PROBE_API && !process.argv.includes('--skip-api')) {
    const apiErrors = await checkApiProbes();
    errors.push(...apiErrors);
  }

  const ok = errors.length === 0;
  const result = {
    ok,
    phase: 'pre',
    staticOnly: STATIC_ONLY,
    apiProbed: PROBE_API,
    errors,
    checkedAt: new Date().toISOString(),
  };

  try {
    const deployMonitor = require('../lib/deploy-monitor');
    deployMonitor.recordGuardianCheck(result);
  } catch {
    /* optional */
  }

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log('[deploy-guardian] Pre-deploy —', ok ? 'PASS' : 'FAIL');
    if (errors.length) {
      for (const err of errors) console.error('  ✗', err);
    } else {
      console.log('  ✓ wiring, routes, build manifest' + (PROBE_API ? ', API probes' : ''));
    }
  }

  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error('[deploy-guardian] fatal:', err.message);
  process.exit(1);
});
