#!/usr/bin/env node
/**
 * Stamp build metadata for cache-busting and deploy verification.
 * Runs after Next export merge (Netlify build).
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const serverDir = path.join(__dirname, '..', '..', 'server');

function gitCommit() {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return process.env.COMMIT_REF || process.env.RENDER_GIT_COMMIT || null;
  }
}

function gitShort(commit) {
  return commit ? String(commit).slice(0, 12) : null;
}

const commit = gitCommit();
const { readNextBuildId } = require('./inject-landing-export.js');
const nextBuildId = readNextBuildId();
const gitShortId = gitShort(commit) || `t${Date.now().toString(36)}`;
/** Single cache-bust id: git short + Next build folder (matches inject-cache-bust). */
const buildId = nextBuildId ? `${gitShortId}-${nextBuildId.slice(0, 8)}` : gitShortId;
const builtAt = new Date().toISOString();

const manifest = {
  version: 1,
  buildId,
  commit,
  nextBuildId: nextBuildId || null,
  builtAt,
  site: 'gatorvaultinsider.com',
  pipeline: 'netlify',
};

const opsVersion = {
  commit,
  builtAt,
  site: manifest.site,
  buildId,
};

fs.writeFileSync(path.join(serverDir, 'build-manifest.json'), JSON.stringify(manifest, null, 2));
fs.writeFileSync(path.join(serverDir, 'ops-version.json'), JSON.stringify(opsVersion, null, 2));

function stampHtmlFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  let html = fs.readFileSync(filePath, 'utf8');
  const metaTag = `<meta name="gatorvault-build" content="${buildId}">`;

  if (html.includes('name="gatorvault-build"')) {
    html = html.replace(/<meta name="gatorvault-build" content="[^"]*">/, metaTag);
  } else if (html.includes('<head>')) {
    html = html.replace('<head>', `<head>\n    ${metaTag}`);
  }

  html = html.replace(/(\/css\/[^"']+\?v=)[^"']+/g, `$1${buildId}`);
  html = html.replace(/(\/js\/[^"']+\?v=)[^"']+/g, `$1${buildId}`);
  html = html.replace(/(\/gv-global\.css\?v=)[^"']+/g, `$1${buildId}`);
  html = html.replace(/(\/gv-feedback\.css\?v=)[^"']+/g, `$1${buildId}`);

  fs.writeFileSync(filePath, html);
}

/** Stamp build id into every exported HTML page (not just /). */
function walkHtml(dir) {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walkHtml(full);
    else if (name === 'index.html') stampHtmlFile(full);
  }
}

walkHtml(serverDir);

console.log('[stamp-build] buildId=', buildId, 'commit=', gitShort(commit));
