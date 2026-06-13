/**
 * Verify Next.js chunk/CSS assets referenced in static HTML exports exist on disk.
 */
const fs = require('fs');
const path = require('path');

const ASSET_RE = /\/_next\/static\/[^"'\s)]+/g;

function extractNextAssets(html) {
  const assets = new Set();
  for (const match of String(html || '').matchAll(ASSET_RE)) {
    let rel = match[0].replace(/^\//, '').replace(/\\+$/, '');
    if (rel.endsWith('\\')) rel = rel.slice(0, -1);
    assets.add(rel);
  }
  return assets;
}

function collectAssetsFromHtmlFiles(serverDir, htmlFiles) {
  const assets = new Set();
  for (const rel of htmlFiles) {
    const full = path.join(serverDir, rel);
    if (!fs.existsSync(full)) continue;
    extractNextAssets(fs.readFileSync(full, 'utf8')).forEach((a) => assets.add(a));
  }
  return assets;
}

function verifyChunkAssets(serverDir, htmlFiles) {
  const assets = collectAssetsFromHtmlFiles(serverDir, htmlFiles);
  const missing = [];
  for (const rel of assets) {
    const full = path.join(serverDir, rel);
    if (!fs.existsSync(full)) missing.push(rel);
  }
  return { assets: [...assets], missing };
}

module.exports = {
  ASSET_RE,
  extractNextAssets,
  collectAssetsFromHtmlFiles,
  verifyChunkAssets,
};
