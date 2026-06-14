#!/usr/bin/env node
/**
 * Post-deploy smoke test — verify live site + API after deploy.
 *
 * Usage:
 *   node scripts/deploy-smoke-post.js
 *   SITE_URL=https://gatorvaultinsider.com API_URL=https://gatorvault-api.onrender.com node scripts/deploy-smoke-post.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const SITE_URL = (process.env.SITE_URL || 'https://gatorvaultinsider.com').replace(/\/$/, '');
const API_URL = (process.env.API_URL || process.env.DEPLOY_GUARDIAN_API_URL || 'https://gatorvault-api.onrender.com').replace(
  /\/$/,
  ''
);
const PORTAL_SMOKE_SLUG = process.env.SMOKE_PORTAL_SLUG || 'test-slug';
const CRAWLER_UA = 'GatorVault-QA-Crawler/1.0';

const VAULT_SMOKE_PATHS = [
  '/vault',
  '/vault/recruiting',
  '/vault/live',
  '/vault/team',
  '/vault/futurecast',
  '/vault/film-room',
  '/vault/schedule',
];

async function fetchCheck(label, url, { allow404 = false, expectIncludes = [], headers = {} } = {}) {
  try {
    const res = await fetch(url, { redirect: 'follow', headers });
    const text = await res.text();
    const failed = !res.ok && !(allow404 && res.status === 404);
    const missing = expectIncludes.filter((s) => !text.includes(s));
    if (failed) return { ok: false, label, error: `HTTP ${res.status}`, url };
    if (missing.length) return { ok: false, label, error: `missing: ${missing.join(', ')}`, url };
    return { ok: true, label, status: res.status, url };
  } catch (err) {
    return { ok: false, label, error: err.message, url };
  }
}

async function main() {
  const checks = [];

  for (const vaultPath of VAULT_SMOKE_PATHS) {
    checks.push(
      await fetchCheck(`vault-route${vaultPath.replace(/\//g, '-')}`, `${SITE_URL}${vaultPath}`, {
        headers: { 'User-Agent': CRAWLER_UA },
        expectIncludes: ['GatorVault'],
      })
    );
  }

  checks.push(
    await fetchCheck('vault-futurecast', `${SITE_URL}/vault/futurecast/`, {
      headers: { 'User-Agent': CRAWLER_UA },
      expectIncludes: ['FutureCast', 'futurecast'],
    }),
    await fetchCheck('recruiting-player-profile', `${SITE_URL}/vault/recruiting/player/${PORTAL_SMOKE_SLUG}/`, {
      allow404: true,
      headers: { 'User-Agent': CRAWLER_UA },
      expectIncludes: ['recruiting', 'Recruiting'],
    }),
    await fetchCheck('api-futurecast-home', `${API_URL}/api/futurecast/home`, {
      expectIncludes: ['trendingUp', 'commits'],
    }),
    await fetchCheck('api-futurecast-staff-notes', `${API_URL}/api/futurecast/staff-notes?year=2027`, {
      expectIncludes: ['notes', 'classYear'],
    }),
    await fetchCheck('api-futurecast-high-priority', `${API_URL}/api/futurecast/high-priority?year=2027`, {
      expectIncludes: ['players', 'priorityScore', 'compositeScore'],
    }),
    await fetchCheck('api-recruits-2027', `${API_URL}/api/recruits/2027`, {
      expectIncludes: ['ok', 'recruits', 'compositeScore'],
    }),
    await fetchCheck('build-manifest', `${SITE_URL}/build-manifest.json`, {
      expectIncludes: ['buildId'],
    })
  );

  const htmlRes = await fetch(`${SITE_URL}/vault/futurecast/`);
  const html = await htmlRes.text();
  if (html.includes('gv-vault-public-tabs') && html.includes('Start Here')) {
    checks.push({
      ok: false,
      label: 'vault-nav-separation',
      error: 'FutureCast page HTML still contains legacy public vtab markup (stale bundle?)',
      url: `${SITE_URL}/vault/futurecast/`,
    });
  } else {
    checks.push({ ok: true, label: 'vault-nav-separation' });
  }

  const failed = checks.filter((c) => !c.ok);
  const result = {
    ok: failed.length === 0,
    site: SITE_URL,
    api: API_URL,
    checks,
    failed: failed.map((f) => ({ label: f.label, error: f.error, url: f.url })),
    checkedAt: new Date().toISOString(),
  };

  try {
    require('../lib/deploy-monitor').recordSmokeTest(result);
  } catch {
    /* optional */
  }

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log('[deploy-smoke] Post-deploy —', result.ok ? 'PASS' : 'FAIL');
    for (const c of checks) {
      console.log(c.ok ? '  ✓' : '  ✗', c.label, c.error || '');
    }
  }

  process.exit(result.ok ? 0 : 1);
}

main().catch((err) => {
  console.error('[deploy-smoke] fatal:', err.message);
  process.exit(1);
});
