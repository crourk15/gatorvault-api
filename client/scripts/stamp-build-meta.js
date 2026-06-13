#!/usr/bin/env node
/**
 * Stamp build metadata for cache-busting and deploy verification.
 * Runs after Next export merge (Netlify build).
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const serverDir = path.join(__dirname, '..', '..', 'server');
const indexPath = path.join(serverDir, 'index.html');

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
const buildId = gitShort(commit) || `t${Date.now().toString(36)}`;
const builtAt = new Date().toISOString();

const manifest = {
  version: 1,
  buildId,
  commit,
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

if (fs.existsSync(indexPath)) {
  let html = fs.readFileSync(indexPath, 'utf8');
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

  fs.writeFileSync(indexPath, html);
}

console.log('[stamp-build] buildId=', buildId, 'commit=', gitShort(commit));
