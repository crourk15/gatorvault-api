#!/usr/bin/env node
/**
 * Verify production serves fast-fetch bundle (5s / no retries) and current build stamp.
 * Usage: node server/scripts/verify-fetch-profile-production.js
 */
const SITE = process.env.GV_SITE_URL || 'https://gatorvaultinsider.com';

async function fetchText(path) {
  const res = await fetch(`${SITE}${path}`, { redirect: 'follow' });
  return { status: res.status, text: await res.text(), url: res.url };
}

async function main() {
  let failed = 0;

  const manifest = await fetchText('/build-manifest.json');
  if (manifest.status !== 200) {
    console.error('FAIL build-manifest.json', manifest.status);
    failed += 1;
  } else {
    const data = JSON.parse(manifest.text);
    console.log('OK   build-manifest', data.buildId, data.builtAt);
  }

  const page = await fetchText('/vault/recruiting');
  const buildMeta = page.text.match(/name="gatorvault-build"\s+content="([^"]+)"/);
  if (!buildMeta) {
    console.error('FAIL gatorvault-build meta missing on /vault/recruiting');
    failed += 1;
  } else {
    console.log('OK   page build stamp', buildMeta[1]);
  }

  const chunkMatch = page.text.match(/\/_next\/static\/chunks\/3941-[a-f0-9]+\.js/);
  if (!chunkMatch) {
    console.error('FAIL api-fetch chunk ref missing from recruiting page');
    failed += 1;
  } else {
    const chunk = await fetchText(chunkMatch[0]);
    const hasFast = chunk.text.includes('5e3') || chunk.text.includes('5000');
    const hasOld = chunk.text.includes('25000') || chunk.text.includes('25e3') || chunk.text.includes('180000');
    if (hasOld) {
      console.error('FAIL chunk still contains old timeout/retry constants', chunkMatch[0]);
      failed += 1;
    } else if (!hasFast) {
      console.warn('WARN chunk missing obvious 5s timeout literal — check window.__GV_FETCH__ in browser');
    } else {
      console.log('OK   api-fetch chunk uses 5s timeout', chunkMatch[0]);
    }
  }

  if (page.text.includes('data-gv-cache-bust')) {
    console.log('OK   cache-bust boot script present (SW unregister + build reload)');
  } else {
    console.error('FAIL cache-bust boot script missing');
    failed += 1;
  }

  console.log('\nBrowser check: open DevTools console on /vault/recruiting and run: window.__GV_FETCH__');
  console.log('Expected: { profile: "fast-v1", timeoutMs: 5000, retries: 0 }');

  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
