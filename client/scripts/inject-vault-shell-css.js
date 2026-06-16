#!/usr/bin/env node
/**
 * Ensure vault layout CSS loads in mandatory order before React scripts.
 * Order: vault-shell → hub-tabs → live-feed → team-page (deduped by href).
 */
const fs = require('fs');
const path = require('path');
const { REQUIRED_CSS_SIGNATURES } = require('../../server/lib/hydration/hydration-checks');

const serverDir = path.join(__dirname, '..', '..', 'server');
const cssDir = path.join(serverDir, '_next', 'static', 'css');

function cssFileText(file) {
  return fs.readFileSync(path.join(cssDir, file), 'utf8');
}

function findCssHrefsInPriorityOrder() {
  if (!fs.existsSync(cssDir)) return [];
  const files = fs.readdirSync(cssDir).filter((f) => f.endsWith('.css'));
  const hrefs = [];
  const seen = new Set();

  for (const sig of REQUIRED_CSS_SIGNATURES) {
    for (const file of files) {
      const href = `/_next/static/css/${file}`;
      if (seen.has(href)) continue;
      const text = cssFileText(file);
      if (sig.patterns.some((p) => text.includes(p))) {
        hrefs.push({ id: sig.id, href });
        seen.add(href);
        break;
      }
    }
  }
  return hrefs;
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

function reorderVaultCss(html, priorityHrefs) {
  const linkRe =
    /<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["'][^>]*>|<link[^>]+href=["']([^"']+)["'][^>]+rel=["']stylesheet["'][^>]*>/gi;
  const links = [];
  let m;
  while ((m = linkRe.exec(html))) {
    links.push(m[0]);
  }
  if (!links.length || !priorityHrefs.length) return html;

  const prioritySet = new Set(priorityHrefs.map((p) => p.href));
  const orderedTags = [];
  for (const item of priorityHrefs) {
    const tag = links.find((t) => t.includes(item.href));
    if (!tag) continue;
    if (item.id === 'vault-shell') {
      const preload = `<link rel="preload" href="${item.href}" as="style" data-gv-vault-shell-css="preload"/>`;
      const marked = tag.includes('data-gv-vault-shell-css')
        ? tag
        : tag.replace('<link ', '<link data-gv-vault-shell-css="bundle" ');
      orderedTags.push(preload + marked);
    } else {
      orderedTags.push(tag);
    }
  }

  const others = links.filter((tag) => !priorityHrefs.some((p) => tag.includes(p.href)));
  let without = html;
  for (const tag of links) {
    without = without.replace(tag, '');
  }

  const block = orderedTags.join('') + others.join('');
  const insertRe = /(<meta name="viewport"[^>]*\/>|<meta charSet="utf-8"\/>)/i;
  if (insertRe.test(without)) {
    return without.replace(insertRe, `$1${block}`);
  }
  return without.replace('<head>', `<head>${block}`);
}

function injectVaultCssOrder() {
  const priorityHrefs = findCssHrefsInPriorityOrder();
  const vaultShell = priorityHrefs.find((p) => p.id === 'vault-shell');
  if (!vaultShell) {
    console.error('[inject-vault-css] vault-shell.css chunk not found in _next/static/css');
    process.exit(1);
  }

  const vaultRoot = path.join(serverDir, 'vault');
  const files = walkHtml(vaultRoot);
  let updated = 0;

  for (const filePath of files) {
    const html = fs.readFileSync(filePath, 'utf8');
    const next = reorderVaultCss(html, priorityHrefs);
    if (next !== html) {
      fs.writeFileSync(filePath, next);
      updated++;
    }
  }

  console.log(
    `[inject-vault-css] CSS order ${priorityHrefs.map((p) => p.id).join(' → ')} on ${updated}/${files.length} vault pages`
  );
}

injectVaultCssOrder();

module.exports = { injectVaultCssOrder, findCssHrefsInPriorityOrder };
