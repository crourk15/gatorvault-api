#!/usr/bin/env node
/**
 * Verify Netlify production deploy:
 *   1. Latest deploy state = ready (when NETLIFY_AUTH_TOKEN + site id set)
 *   2. Production gatorvault-build meta matches local build-manifest.json commit
 *
 * Usage:
 *   node client/scripts/verify-netlify-build-match.js
 *   node client/scripts/verify-netlify-build-match.js --production-only
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const PRODUCTION_BASE = process.env.PRODUCTION_BASE || 'https://gatorvaultinsider.com';
const MANIFEST_PATH = path.join(__dirname, '..', '..', 'server', 'build-manifest.json');
const OUT = path.resolve(__dirname, '..', '..', 'proof', 'mobile-deploy-proof', 'netlify');

function fetchText(url, timeoutMs = 30_000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: timeoutMs, headers: { 'Cache-Control': 'no-cache' } }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('timeout'));
    });
  });
}

function fetchJson(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { ...headers, 'Cache-Control': 'no-cache' } }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
  });
}

function parseBuildId(html) {
  const m = html.match(/name="gatorvault-build"\s+content="([^"]+)"/);
  return m?.[1] || null;
}

function commitFromBuildId(buildId) {
  if (!buildId) return null;
  const part = buildId.split('-')[0];
  return part && part.length >= 7 ? part : null;
}

async function fetchProductionBuildId() {
  const url = `${PRODUCTION_BASE}/vault/?_=${Date.now()}`;
  const { status, body } = await fetchText(url);
  if (status !== 200) throw new Error(`production /vault/ returned ${status}`);
  const buildId = parseBuildId(body);
  if (!buildId) throw new Error('production gatorvault-build meta missing');
  return buildId;
}

async function fetchNetlifyDeployStatus() {
  const token = process.env.NETLIFY_AUTH_TOKEN;
  const siteId = process.env.NETLIFY_SITE_ID;
  if (!token || !siteId) {
    return { skipped: true, reason: 'NETLIFY_AUTH_TOKEN or NETLIFY_SITE_ID not set' };
  }

  const url = `https://api.netlify.com/api/v1/sites/${siteId}/deploys?per_page=1`;
  const { status, body } = await fetchJson(url, { Authorization: `Bearer ${token}` });
  if (status !== 200 || !Array.isArray(body) || !body[0]) {
    return { skipped: false, ok: false, reason: `Netlify API ${status}` };
  }

  const deploy = body[0];
  const ok = deploy.state === 'ready' && !deploy.error_message;
  return {
    skipped: false,
    ok,
    state: deploy.state,
    deployId: deploy.id,
    commitRef: deploy.commit_ref || deploy.title || null,
    publishedAt: deploy.published_at || deploy.created_at,
    error: deploy.error_message || null,
  };
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });

  let localManifest = null;
  if (fs.existsSync(MANIFEST_PATH)) {
    localManifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  }

  const productionBuildId = await fetchProductionBuildId();
  fs.writeFileSync(path.join(OUT, 'production-build-id.txt'), `${productionBuildId}\n`, 'utf8');

  const netlify = await fetchNetlifyDeployStatus();
  fs.writeFileSync(path.join(OUT, 'deploy-status.json'), JSON.stringify(netlify, null, 2));

  const localBuildId = localManifest?.buildId || null;
  const localCommit = localManifest?.commit || null;
  if (localBuildId) {
    fs.writeFileSync(path.join(OUT, 'expected-build-id.txt'), `${localBuildId}\n`, 'utf8');
  }

  const prodCommitPrefix = commitFromBuildId(productionBuildId);
  const localCommitPrefix = localCommit ? String(localCommit).slice(0, 12) : commitFromBuildId(localBuildId);

  const exactMatch = localBuildId && productionBuildId === localBuildId;
  const commitMatch = prodCommitPrefix && localCommitPrefix && prodCommitPrefix === localCommitPrefix;

  const report = {
    checkedAt: new Date().toISOString(),
    productionBase: PRODUCTION_BASE,
    productionBuildId,
    localBuildId,
    localCommit,
    exactBuildIdMatch: exactMatch,
    commitPrefixMatch: commitMatch,
    netlifyDeploy: netlify,
    pass: Boolean(commitMatch || exactMatch) && (netlify.skipped || netlify.ok),
  };

  fs.writeFileSync(path.join(OUT, 'build-match.json'), JSON.stringify(report, null, 2));

  const lines = [
    '# Netlify Build Verification',
    '',
    `**Checked:** ${report.checkedAt}`,
    '',
    `| Check | Result |`,
    `|-------|--------|`,
    `| Production build ID | \`${productionBuildId}\` |`,
    `| Local build ID | \`${localBuildId || 'n/a'}\` |`,
    `| Exact build ID match | **${exactMatch ? 'PASS' : 'FAIL'}** |`,
    `| Commit prefix match | **${commitMatch ? 'PASS' : 'FAIL'}** (${prodCommitPrefix} vs ${localCommitPrefix}) |`,
    `| Netlify deploy ready | **${netlify.skipped ? 'SKIP (no API token)' : netlify.ok ? 'PASS' : 'FAIL'}** |`,
    '',
    `**Overall:** ${report.pass ? 'PASS' : 'FAIL'}`,
    '',
  ];
  fs.writeFileSync(path.join(OUT, 'BUILD-MATCH.md'), lines.join('\n'), 'utf8');

  console.log('[verify-netlify-build] production buildId:', productionBuildId);
  console.log('[verify-netlify-build] local buildId:', localBuildId || 'n/a');
  console.log('[verify-netlify-build] exact match:', exactMatch);
  console.log('[verify-netlify-build] commit match:', commitMatch);
  if (!netlify.skipped) console.log('[verify-netlify-build] netlify deploy:', netlify.state, netlify.ok ? 'ok' : 'FAIL');

  if (!report.pass) {
    console.error('[verify-netlify-build] BLOCKED — production build does not match local commit/build');
    process.exit(1);
  }
  console.log('[verify-netlify-build] OK');
}

main().catch((err) => {
  console.error('[verify-netlify-build] fatal:', err.message);
  process.exit(1);
});
