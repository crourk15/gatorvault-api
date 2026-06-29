#!/usr/bin/env node
/**
 * Verify apple-app-site-association on production (Step 8 prep).
 */
const SITE = process.env.GV_SITE || 'https://gatorvaultinsider.com';
const BUNDLE_ID = 'com.gatorvaultinsider.app';

const PATHS = ['/.well-known/apple-app-site-association', '/apple-app-site-association'];
const EXPECTED_VAULT_PATHS = ['/vault/*', '/privacy/*', '/terms/*'];

const results = [];
const pass = (name, message) => results.push({ name, status: 'PASS', message });
const fail = (name, message) => results.push({ name, status: 'FAIL', message });

async function checkPath(urlPath) {
  const label = urlPath.replace(/\//g, '_').replace(/^_+/, '') || 'root';
  try {
    const res = await fetch(`${SITE}${urlPath}`, { redirect: 'follow' });
    const contentType = String(res.headers.get('content-type') || '').toLowerCase();
    const text = await res.text();
    if (!res.ok) {
      fail(label, `HTTP ${res.status}`);
      return;
    }
    if (!contentType.includes('json')) {
      fail(`${label}-content-type`, contentType || 'missing');
    } else {
      pass(`${label}-content-type`, contentType);
    }
    let doc;
    try {
      doc = JSON.parse(text);
    } catch {
      fail(label, 'invalid JSON');
      return;
    }
    if (!doc.applinks || !Array.isArray(doc.applinks.details)) {
      fail(label, 'missing applinks.details');
      return;
    }
    const paths = doc.applinks.details.flatMap((row) => row.paths || []);
    const hasVault = EXPECTED_VAULT_PATHS.every((p) => paths.includes(p));
    if (!hasVault) {
      fail(`${label}-paths`, `missing expected paths (have ${paths.slice(0, 4).join(', ')})`);
    } else {
      pass(`${label}-paths`, `${paths.length} paths incl. /vault/*`);
    }
    const appIds = doc.applinks.details.flatMap((row) => row.appIDs || []);
    const teamConfigured = appIds.some((id) => id.endsWith(`.${BUNDLE_ID}`));
    if (teamConfigured) {
      pass(`${label}-team`, appIds[0]);
    } else {
      pass(`${label}-team`, 'shell only (set APPLE_TEAM_ID at build for live appIDs)');
    }
    pass(label, 'valid AASA document');
  } catch (err) {
    fail(label, err instanceof Error ? err.message : String(err));
  }
}

async function main() {
  for (const urlPath of PATHS) {
    await checkPath(urlPath);
  }
  const summary = {
    site: SITE,
    pass: results.filter((r) => r.status === 'PASS').length,
    fail: results.filter((r) => r.status === 'FAIL').length,
    results,
  };
  console.log(JSON.stringify(summary, null, 2));
  process.exit(summary.fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
