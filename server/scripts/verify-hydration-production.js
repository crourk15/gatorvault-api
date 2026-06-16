#!/usr/bin/env node
/**
 * Post-deploy production hydration verification.
 * Run after every Netlify deploy to confirm live site is stable.
 *
 * Usage: node server/scripts/verify-hydration-production.js
 *        SITE_URL=https://gatorvaultinsider.com node server/scripts/verify-hydration-production.js
 */
const config = require('../lib/qa/qa-config');
const { PILLAR_PAGES } = require('../lib/hydration/hydration-checks');

const SITE = (process.env.SITE_URL || config.SITE_URL || 'https://gatorvaultinsider.com').replace(/\/$/, '');

async function fetchText(urlPath) {
  const res = await fetch(`${SITE}${urlPath}`, {
    headers: { Accept: 'text/html' },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`${urlPath} HTTP ${res.status}`);
  return res.text();
}

function checkCssBeforeScripts(html, label) {
  const scriptIdx = html.search(/<script[\s>]/i);
  const cssIdx = html.indexOf('data-gv-vault-shell-css');
  if (cssIdx < 0) return `${label}: vault-shell CSS marker missing`;
  if (scriptIdx >= 0 && cssIdx > scriptIdx) return `${label}: vault-shell CSS loads after scripts`;
  if (!html.includes('gv-vault-shell') && !html.includes('data-gv-vault-shell-css')) {
    return `${label}: vault-shell not in HTML`;
  }
  return null;
}

async function main() {
  console.log('[hydration-production] SITE_URL:', SITE);
  let failed = 0;

  try {
    const manifestRes = await fetch(`${SITE}/build-manifest.json`);
    const manifestText = await manifestRes.text();
    console.log('A build-manifest:', manifestText.trim().slice(0, 140));
    if (!manifestRes.ok) {
      failed++;
      console.log('FAIL A: build-manifest.json unreachable');
    }
  } catch (e) {
    failed++;
    console.log('FAIL A: build-manifest fetch failed:', e.message);
  }

  for (const page of PILLAR_PAGES) {
    try {
      const html = await fetchText(page.urlPath.endsWith('/') ? page.urlPath : `${page.urlPath}/`);
      const missing = page.markers.filter((m) => !html.includes(m));
      const isVaultPage = page.urlPath.startsWith('/vault');
      const cssErr = isVaultPage ? checkCssBeforeScripts(html, page.id) : null;
      if (missing.length) {
        failed++;
        console.log(`FAIL B ${page.urlPath}: missing ${missing.join(', ')}`);
      } else {
        console.log(`OK   B ${page.urlPath}: markers present`);
      }
      if (cssErr) {
        failed++;
        console.log(`FAIL C ${cssErr}`);
      } else if (isVaultPage) {
        console.log(`OK   C ${page.urlPath}: vault-shell CSS before scripts`);
      }
      if (html.includes('gv-vault-shell__skeleton') && html.includes('aria-label="Loading vault"')) {
        failed++;
        console.log(`FAIL E ${page.urlPath}: skeleton hydration gate still in SSR HTML`);
      }
    } catch (e) {
      failed++;
      console.log(`FAIL ${page.urlPath}: ${e.message}`);
    }
  }

  try {
    const recruiting = await fetchText('/vault/recruiting/');
    if (!recruiting.includes('gv-hub-tabs')) {
      failed++;
      console.log('FAIL C/D recruiting: gv-hub-tabs missing');
    } else {
      console.log('OK   C/D recruiting: gv-hub-tabs present');
    }
  } catch (e) {
    failed++;
    console.log('FAIL recruiting scroll check:', e.message);
  }

  try {
    const live = await fetchText('/vault/live-feed/');
    const liveClasses = ['gv-live-feed', 'gv-live-ticker', 'gv-live-feed__tabs', 'gv-live-feed__row'];
    const missingLive = liveClasses.filter((c) => !live.includes(c));
    if (missingLive.length) {
      failed++;
      console.log(`FAIL D live-feed: missing ${missingLive.join(', ')}`);
    } else {
      console.log('OK   D live-feed: layout classes present');
    }
  } catch (e) {
    failed++;
    console.log('FAIL live-feed check:', e.message);
  }

  try {
    const landing = await fetchText('/');
    if (!landing.includes('landing-page')) {
      failed++;
      console.log('FAIL B landing: landing-page marker missing');
    } else {
      console.log('OK   B landing: markers present');
    }
    if (!landing.includes('r-(home)-layout-')) {
      failed++;
      console.log('FAIL A landing: r-(home)-layout chunk not in HTML');
    } else {
      console.log('OK   A landing: home layout chunk present');
    }
    const landingMeta = landing.match(/name="gatorvault-build"\s+content="([^"]+)"/);
    const vault = await fetchText('/vault/');
    const vaultMeta = vault.match(/name="gatorvault-build"\s+content="([^"]+)"/);
    if (landingMeta && vaultMeta && landingMeta[1] !== vaultMeta[1]) {
      failed++;
      console.log(`FAIL A BUILD_ID mismatch: landing=${landingMeta[1]} vault=${vaultMeta[1]}`);
    } else if (landingMeta && vaultMeta) {
      console.log(`OK   A BUILD_ID match: ${landingMeta[1]}`);
    }
    if (!landing.includes('viewport-fit=cover')) {
      failed++;
      console.log('FAIL F landing: viewport-fit=cover missing');
    } else {
      console.log('OK   E/F landing: integrity OK');
    }
  } catch (e) {
    failed++;
    console.log('FAIL landing checks:', e.message);
  }

  try {
    const vault = await fetchText('/vault/');
    if (!vault.includes('viewport-fit=cover')) {
      failed++;
      console.log('FAIL F mobile: viewport-fit=cover missing');
    } else if (!vault.includes('safe-area-inset') && !vault.includes('env(safe-area-inset')) {
      failed++;
      console.log('FAIL F mobile: safe-area-inset missing');
    } else {
      console.log('OK   F mobile Safari: viewport + safe-area');
    }
    if (!vault.includes('gv-vault-root')) {
      failed++;
      console.log('FAIL G vault: gv-vault-root missing');
    } else if (!vault.includes('data-gv-hydration-boot')) {
      failed++;
      console.log('FAIL G vault: hydration boot script missing');
    } else if (!vault.includes('data-hydrating')) {
      failed++;
      console.log('FAIL G vault: data-hydrating marker missing');
    } else {
      console.log('OK   G vault: hydration guard + SSR fallback markers present');
    }
  } catch (e) {
    failed++;
    console.log('FAIL mobile safari check:', e.message);
  }

  console.log('');
  console.log('H Manual: open browser console on /vault/team — no "Hydration failed" or "Chunk load error"');

  if (failed) {
    console.error(`[hydration-production] FAIL (${failed} check(s))`);
    process.exit(1);
  }
  console.log('[hydration-production] PASS — production hydration stable');
}

main().catch((err) => {
  console.error('[hydration-production] fatal:', err.message);
  process.exit(1);
});
