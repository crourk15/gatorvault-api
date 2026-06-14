/**
 * QA Crawler build identity — proves which API commit is running crawls.
 * Render sets RENDER_GIT_COMMIT on deploy; local dev falls back to ops-version.json.
 */
const fs = require('fs');
const path = require('path');

const OPS_VERSION_PATH = path.join(__dirname, '..', '..', 'ops-version.json');

function readOpsVersion() {
  try {
    return JSON.parse(fs.readFileSync(OPS_VERSION_PATH, 'utf8'));
  } catch {
    return null;
  }
}

function getQaCrawlerBuild() {
  const envCommit =
    process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT || process.env.COMMIT_REF || null;
  const ops = readOpsVersion();
  const commit = envCommit || ops?.commit || null;
  const short = commit ? String(commit).slice(0, 7) : 'unknown';
  return {
    commit,
    short,
    branch: process.env.RENDER_GIT_BRANCH || process.env.BRANCH || null,
    service: 'gatorvault-api',
    runtime: process.env.RENDER ? 'render' : 'local',
    assetSource: process.env.QA_SCAN_PRODUCTION === 'false' ? 'local-html' : 'production-html',
    builtAt: ops?.builtAt || null,
  };
}

function formatQaCrawlerBuildLog() {
  const b = getQaCrawlerBuild();
  return `QA Crawler build: ${b.short} (${b.runtime}) | assets: ${b.assetSource}`;
}

module.exports = { getQaCrawlerBuild, formatQaCrawlerBuildLog };
