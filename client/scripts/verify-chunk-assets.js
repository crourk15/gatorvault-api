/**
 * Verify Next.js chunk/CSS assets referenced in static HTML exports exist on disk.
 */
const fs = require('fs');
const path = require('path');

const ASSET_RE = /\/(?:_next\/static|js\/vault-chunks)\/[^"'\s<>]+\.(?:js|css|woff2?|map)/g;

function extractNextAssets(html) {
  const assets = new Set();
  for (const match of String(html || '').matchAll(ASSET_RE)) {
    let rel = match[0].replace(/^\//, '').replace(/\\+$/, '');
    if (rel.endsWith('\\')) rel = rel.slice(0, -1);
    assets.add(rel);
    if (rel.startsWith('js/vault-chunks/')) assets.add(`/${rel}`);
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

function resolveAsset(serverDir, rel) {
  const full = path.join(serverDir, rel);
  if (fs.existsSync(full)) return true;

  if (rel.startsWith('_next/static/chunks/app/') || rel.startsWith('_next/static/chunks/routes/')) {
    return false;
  }
  if (rel.startsWith('_next/static/chunks/')) {
    const base = path.basename(rel);
    if (base.startsWith('main-app-') || base.startsWith('main-entry-')) return false;
    const mentry = base.replace(/^main-app-/, 'mentry-').replace(/^main-entry-/, 'mentry-');
    if (fs.existsSync(path.join(serverDir, 'js/vault-chunks', mentry))) return true;
  }
  return false;
}

function verifyChunkAssets(serverDir, htmlFiles) {
  const assets = collectAssetsFromHtmlFiles(serverDir, htmlFiles);
  const missing = [];
  for (const rel of assets) {
    if (!resolveAsset(serverDir, rel)) missing.push(rel);
  }
  return { assets: [...assets], missing };
}

module.exports = {
  ASSET_RE,
  extractNextAssets,
  collectAssetsFromHtmlFiles,
  verifyChunkAssets,
};
