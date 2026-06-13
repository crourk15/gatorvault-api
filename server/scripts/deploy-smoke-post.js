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

async function fetchCheck(label, url, { allow404 = false, expectIncludes = [] } = {}) {
  try {
    const res = await fetch(url, { redirect: 'follow' });
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
  const checks = [
    await fetchCheck('vault-futurecast', `${SITE_URL}/vault/futurecast/`, {
      expectIncludes: ['FutureCast', 'futurecast'],
    }),
    await fetchCheck('vault-home', `${SITE_URL}/vault`, {
      expectIncludes: ['vault', 'GatorVault'],
    }),
    await fetchCheck('portal-profile', `${SITE_URL}/vault/portal/player/${PORTAL_SMOKE_SLUG}/`, {
      allow404: true,
      expectIncludes: ['portal', 'Portal'],
    }),
    await fetchCheck('api-futurecast-home', `${API_URL}/api/futurecast/home`, {
      expectIncludes: ['trendingUp', 'commits'],
    }),
    await fetchCheck('build-manifest', `${SITE_URL}/build-manifest.json`, {
      expectIncludes: ['buildId'],
    }),
  ];

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
