#!/usr/bin/env node
/**
 * Ensure vault-shell.css chunk loads before other styles on vault HTML exports.
 * Prevents dark blank screens when CSS arrives after React paints the shell.
 */
const fs = require('fs');
const path = require('path');

const serverDir = path.join(__dirname, '..', '..', 'server');
const cssDir = path.join(serverDir, '_next', 'static', 'css');

function findVaultShellCssHref() {
  if (!fs.existsSync(cssDir)) return null;
  for (const file of fs.readdirSync(cssDir)) {
    if (!file.endsWith('.css')) continue;
    const text = fs.readFileSync(path.join(cssDir, file), 'utf8');
    if (text.includes('.gv-vault-shell{') || text.includes('.gv-vault-shell ')) {
      return `/_next/static/css/${file}`;
    }
  }
  return null;
}

function walkHtml(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkHtml(full, out);
    else if (entry.name === 'index.html') out.push(full);
  }
  return out;
}

function reorderVaultShellCss(html, vaultShellHref) {
  const linkRe =
    /<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["'][^>]*>|<link[^>]+href=["']([^"']+)["'][^>]+rel=["']stylesheet["'][^>]*>/gi;
  const links = [];
  let m;
  while ((m = linkRe.exec(html))) {
    links.push(m[0]);
  }
  if (!links.length) return html;

  const vaultLink = links.find((tag) => tag.includes(vaultShellHref));
  if (!vaultLink) return html;

  const others = links.filter((tag) => tag !== vaultLink);
  let without = html;
  for (const tag of links) {
    without = without.replace(tag, '');
  }

  const preload = `<link rel="preload" href="${vaultShellHref}" as="style" data-gv-vault-shell-css="preload"/>`;
  const markedVaultLink = vaultLink.includes('data-gv-vault-shell-css')
    ? vaultLink
    : vaultLink.replace('<link ', '<link data-gv-vault-shell-css="bundle" ');
  const block = preload + markedVaultLink + others.join('');

  const insertRe = /(<meta name="viewport"[^>]*\/>|<meta charSet="utf-8"\/>)/i;
  if (insertRe.test(without)) {
    return without.replace(insertRe, `$1${block}`);
  }
  return without.replace('<head>', `<head>${block}`);
}

function injectVaultShellCssFirst() {
  const vaultShellHref = findVaultShellCssHref();
  if (!vaultShellHref) {
    console.error('[inject-vault-shell-css] vault-shell.css chunk not found in _next/static/css');
    process.exit(1);
  }

  const vaultRoot = path.join(serverDir, 'vault');
  const files = walkHtml(vaultRoot);
  let updated = 0;

  for (const filePath of files) {
    const html = fs.readFileSync(filePath, 'utf8');
    const next = reorderVaultShellCss(html, vaultShellHref);
    if (next !== html) {
      fs.writeFileSync(filePath, next);
      updated++;
    }
  }

  console.log(
    `[inject-vault-shell-css] vault-shell bundle ${vaultShellHref} prioritized on ${updated}/${files.length} vault pages`
  );
}

injectVaultShellCssFirst();

module.exports = { injectVaultShellCssFirst, findVaultShellCssHref };
