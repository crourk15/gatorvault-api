#!/usr/bin/env node
/**
 * Post-build fixes for / index.html — chunk refs, BUILD_ID sync, CSS order.
 */
const fs = require('fs');
const path = require('path');

const serverDir = path.join(__dirname, '..', '..', 'server');
const indexPath = path.join(serverDir, 'index.html');
const chunksDir = path.join(serverDir, 'js', 'vault-chunks');
const staticDir = path.join(serverDir, '_next', 'static');
const cssDir = path.join(staticDir, 'css');

function readNextBuildId() {
  if (!fs.existsSync(staticDir)) return null;
  for (const name of fs.readdirSync(staticDir)) {
    if (name === 'chunks' || name === 'css' || name === 'development') continue;
    const full = path.join(staticDir, name);
    if (fs.statSync(full).isDirectory() && fs.existsSync(path.join(full, '_buildManifest.js'))) {
      return name;
    }
  }
  return null;
}

function findHomeLayoutChunkHref() {
  if (!fs.existsSync(chunksDir)) return null;
  const files = fs.readdirSync(chunksDir).filter((f) => f.endsWith('.js'));
  const pick = (prefix) =>
    files.filter((f) => f.startsWith(prefix)).sort().pop();
  const match =
    pick('r-(home)-layout-') ||
    pick('r-layout-') ||
    pick('r-(marketing)-layout-');
  return match ? `/js/vault-chunks/${match}` : null;
}

function findLandingCssHref() {
  if (!fs.existsSync(cssDir)) return null;
  for (const file of fs.readdirSync(cssDir)) {
    if (!file.endsWith('.css')) continue;
    const text = fs.readFileSync(path.join(cssDir, file), 'utf8');
    if (text.includes('.gv-landing') || text.includes('.gv-landing-hero')) {
      return `/_next/static/css/${file}`;
    }
  }
  return null;
}

function reorderLandingCss(html, landingCssHref) {
  if (!landingCssHref) return html;
  const linkRe =
    /<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["'][^>]*>|<link[^>]+href=["']([^"']+)["'][^>]+rel=["']stylesheet["'][^>]*>/gi;
  const links = [];
  let m;
  while ((m = linkRe.exec(html))) links.push(m[0]);
  const landingLink = links.find((tag) => tag.includes(landingCssHref));
  if (!landingLink) return html;

  const others = links.filter((tag) => tag !== landingLink);
  let without = html;
  for (const tag of links) without = without.replace(tag, '');

  const preload = `<link rel="preload" href="${landingCssHref}" as="style" data-gv-landing-css="preload"/>`;
  const marked = landingLink.includes('data-gv-landing-css')
    ? landingLink
    : landingLink.replace('<link ', '<link data-gv-landing-css="bundle" ');
  const block = preload + marked + others.join('');

  const insertRe = /(<meta name="viewport"[^>]*\/>|<meta charSet="utf-8"\/>)/i;
  if (insertRe.test(without)) return without.replace(insertRe, `$1${block}`);
  return without.replace('<head>', `<head>${block}`);
}

function injectHomeLayoutScript(html, layoutHref) {
  if (!layoutHref || html.includes(layoutHref)) return html;
  const tag = `<script src="${layoutHref}" async=""></script>`;
  const pageMatch = html.match(/<script src="\/js\/vault-chunks\/r-\(home\)-page-[^"]+\.js" async=""><\/script>/);
  if (pageMatch) {
    return html.replace(pageMatch[0], `${pageMatch[0]}${tag}`);
  }
  const layoutRoot = html.match(/<script src="\/js\/vault-chunks\/r-layout-[^"]+\.js" async=""><\/script>/);
  if (layoutRoot) {
    return html.replace(layoutRoot[0], `${tag}${layoutRoot[0]}`);
  }
  return html.replace('<script src="/_next/static/chunks/webpack', `${tag}<script src="/_next/static/chunks/webpack`);
}

function syncBuildIdInHtml(html, buildId) {
  if (!buildId) return html;
  return html.replace(/"buildId":"[^"]+"/g, `"buildId":"${buildId}"`);
}

function verifyScriptRefs(html) {
  const missing = [];
  const re = /<script[^>]+src=["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(html))) {
    const src = m[1];
    if (src.includes('google') || src.startsWith('http')) continue;
    const file = path.join(serverDir, src.replace(/^\//, '').replace(/\//g, path.sep));
    if (!fs.existsSync(file)) missing.push(src);
  }
  return missing;
}

function injectLandingExport() {
  if (!fs.existsSync(indexPath)) {
    console.warn('[inject-landing] index.html missing');
    return;
  }

  let html = fs.readFileSync(indexPath, 'utf8');
  const nextBuildId = readNextBuildId();
  const layoutHref = findHomeLayoutChunkHref();
  const landingCss = findLandingCssHref();

  html = syncBuildIdInHtml(html, nextBuildId);
  html = injectHomeLayoutScript(html, layoutHref);
  html = reorderLandingCss(html, landingCss);

  const missing = verifyScriptRefs(html);
  if (missing.length) {
    console.error('[inject-landing] index.html references missing assets:');
    for (const rel of missing) console.error('  -', rel);
    process.exit(1);
  }

  fs.writeFileSync(indexPath, html);
  console.log(
    `[inject-landing] index.html buildId=${nextBuildId || 'n/a'} layout=${layoutHref || 'n/a'} css=${landingCss || 'n/a'}`
  );
}

injectLandingExport();

module.exports = {
  injectLandingExport,
  findHomeLayoutChunkHref,
  readNextBuildId,
  syncBuildIdInHtml,
};
