#!/usr/bin/env node
/**
 * Verify FutureCast premium shell markers on production vault routes.
 */
const config = require('../lib/qa/qa-config');
const SITE = (process.env.SITE_URL || config.SITE_URL || 'https://gatorvaultinsider.com').replace(/\/$/, '');

const ROUTES = [
  {
    path: '/vault/futurecast/',
    markers: ['data-testid="vault-futurecast-page"', 'rh-cc-page', 'gv-fc-page', 'FutureCast'],
  },
  {
    path: '/vault/futurecast/staff/',
    markers: ['rh-cc-page', 'gv-fc-page', 'Staff Notes'],
  },
  {
    path: '/vault/futurecast/movement/',
    markers: ['rh-cc-page', 'gv-fc-page', 'Movement'],
  },
  {
    path: '/vault/futurecast/trending/',
    markers: ['rh-cc-page', 'gv-fc-page', 'Trending'],
  },
];

async function fetchText(urlPath) {
  const res = await fetch(`${SITE}${urlPath}`, {
    headers: { Accept: 'text/html' },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`${urlPath} HTTP ${res.status}`);
  return res.text();
}

async function main() {
  console.log('[fc-premium-production] SITE_URL:', SITE);
  let failed = 0;

  try {
    const manifestRes = await fetch(`${SITE}/build-manifest.json`);
    const manifestText = await manifestRes.text();
    console.log('build-manifest:', manifestText.trim().slice(0, 160));
    if (!manifestRes.ok) {
      failed++;
      console.log('FAIL: build-manifest unreachable');
    }
  } catch (e) {
    failed++;
    console.log('FAIL: build-manifest fetch failed:', e.message);
  }

  for (const route of ROUTES) {
    try {
      const html = await fetchText(route.path);
      const missing = route.markers.filter((m) => !html.includes(m));
      const buildMeta = html.match(/name="gatorvault-build"\s+content="([^"]+)"/);
      const skeletonGate =
        html.includes('gv-vault-shell__skeleton') && html.includes('aria-label="Loading vault"');
      const cssBeforeScripts =
        html.indexOf('data-gv-vault-shell-css') >= 0 &&
        (html.search(/<script[\s>]/i) < 0 ||
          html.indexOf('data-gv-vault-shell-css') < html.search(/<script[\s>]/i));

      if (missing.length) {
        failed++;
        console.log(`FAIL ${route.path}: missing ${missing.join(', ')}`);
      } else {
        console.log(`OK   ${route.path}: premium markers present (build ${buildMeta?.[1] || '?'})`);
      }
      if (skeletonGate) {
        failed++;
        console.log(`FAIL ${route.path}: skeleton hydration gate in SSR HTML`);
      }
      if (!cssBeforeScripts) {
        failed++;
        console.log(`FAIL ${route.path}: vault-shell CSS not before scripts`);
      }
    } catch (e) {
      failed++;
      console.log(`FAIL ${route.path}: ${e.message}`);
    }
  }

  if (failed) {
    console.error(`[fc-premium-production] FAIL (${failed} check(s))`);
    process.exit(1);
  }
  console.log('[fc-premium-production] PASS — FutureCast premium routes stable');
}

main().catch((err) => {
  console.error('[fc-premium-production] fatal:', err.message);
  process.exit(1);
});
