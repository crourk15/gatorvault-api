/**
 * QA Crawler build identity — API commit + Netlify frontend build stamp.
 */
const fs = require('fs');
const path = require('path');

const OPS_VERSION_PATH = path.join(__dirname, '..', '..', 'ops-version.json');
const BUILD_MANIFEST_PATH = path.join(__dirname, '..', '..', 'build-manifest.json');
const VAULT_INDEX_PATH = path.join(__dirname, '..', '..', 'vault', 'index.html');

function readOpsVersion() {
  try {
    return JSON.parse(fs.readFileSync(OPS_VERSION_PATH, 'utf8'));
  } catch {
    return null;
  }
}

function readBuildManifest() {
  try {
    return JSON.parse(fs.readFileSync(BUILD_MANIFEST_PATH, 'utf8'));
  } catch {
    return null;
  }
}

function readLocalVaultBuildId() {
  try {
    const html = fs.readFileSync(VAULT_INDEX_PATH, 'utf8');
    const m = html.match(/<meta\s+name="gatorvault-build"\s+content="([^"]+)"/i);
    return m ? m[1].trim() : null;
  } catch {
    return null;
  }
}

function getQaCrawlerBuild() {
  const envCommit =
    process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT || process.env.COMMIT_REF || null;
  const ops = readOpsVersion();
  const manifest = readBuildManifest();
  const commit = envCommit || ops?.commit || manifest?.commit || null;
  const short = commit ? String(commit).slice(0, 7) : 'unknown';
  const frontendBuildId = manifest?.buildId || readLocalVaultBuildId() || ops?.buildId || null;
  const frontendCommit = frontendBuildId ? String(frontendBuildId).split('-')[0] : null;
  const frontendShort = frontendCommit ? String(frontendCommit).slice(0, 7) : null;
  const apiShort = short;
  const inSync = !!(frontendShort && apiShort !== 'unknown' && frontendShort === apiShort);

  return {
    commit,
    short: frontendShort || short,
    apiCommit: commit,
    apiShort,
    frontendBuildId,
    frontendShort,
    frontendInSync: inSync,
    branch: process.env.RENDER_GIT_BRANCH || process.env.BRANCH || null,
    service: 'gatorvault-api',
    runtime: process.env.RENDER ? 'render' : 'local',
    assetSource: process.env.QA_SCAN_PRODUCTION === 'false' ? 'local-html' : 'production-html',
    builtAt: manifest?.builtAt || ops?.builtAt || null,
  };
}

async function fetchProductionVaultBuildId(siteUrl) {
  const fetch = require('node-fetch');
  const base = String(siteUrl || process.env.SITE_URL || 'https://gatorvaultinsider.com').replace(/\/$/, '');
  const url = `${base}/vault/?_=${Date.now()}`;
  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'text/html',
        'Cache-Control': 'no-cache',
        'User-Agent': 'gatorvault-qa-crawler/2.0',
      },
    });
    const text = await res.text();
    const m = text.match(/<meta\s+name="gatorvault-build"\s+content="([^"]+)"/i);
    return {
      ok: res.ok,
      status: res.status,
      buildId: m ? m[1].trim() : null,
      url,
    };
  } catch (err) {
    return { ok: false, status: 0, buildId: null, url, error: err.message };
  }
}

function formatQaCrawlerBuildLog() {
  const b = getQaCrawlerBuild();
  const label = b.frontendBuildId
    ? `frontend ${b.frontendShort || b.frontendBuildId} · api ${b.apiShort || 'unknown'}`
    : `build ${b.short}`;
  return `QA Crawler ${label} (${b.runtime}) | assets: ${b.assetSource}`;
}

module.exports = {
  getQaCrawlerBuild,
  formatQaCrawlerBuildLog,
  fetchProductionVaultBuildId,
  readLocalVaultBuildId,
  readBuildManifest,
};
