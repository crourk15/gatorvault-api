/**
 * Hydration stability checks — shared by local pre-deploy and production verification.
 * See server/scripts/verify-hydration-stability.js and verify-hydration-production.js
 */
const fs = require('fs');
const path = require('path');

const PILLAR_PAGES = [
  {
    id: 'dashboard',
    rel: 'vault/index.html',
    urlPath: '/vault',
    markers: ['data-testid="vault-dashboard"', 'gv-vault-shell'],
  },
  {
    id: 'team',
    rel: 'vault/team/index.html',
    urlPath: '/vault/team',
    markers: ['data-testid="vault-team"', 'gv-team-page', 'Full Roster'],
  },
  {
    id: 'recruiting',
    rel: 'vault/recruiting/index.html',
    urlPath: '/vault/recruiting',
    markers: ['data-testid="vault-recruiting-hub"', 'gv-hub-tabs', '2026 Commits'],
  },
  {
    id: 'live-feed',
    rel: 'vault/live-feed/index.html',
    urlPath: '/vault/live-feed',
    markers: [
      'data-testid="vault-live-feed"',
      'gv-live-feed',
      'gv-live-ticker',
      'gv-live-feed__tabs',
      'gv-live-feed__row',
    ],
  },
  {
    id: 'film-room',
    rel: 'vault/film-room/index.html',
    urlPath: '/vault/film-room',
    markers: ['data-testid="vault-film-room"', 'gv-film-room'],
  },
  {
    id: 'futurecast',
    rel: 'vault/futurecast/index.html',
    urlPath: '/vault/futurecast',
    markers: ['data-testid="vault-futurecast-page"', 'FutureCast'],
  },
  {
    id: 'schedule',
    rel: 'vault/schedule/index.html',
    urlPath: '/vault/schedule',
    markers: ['data-testid="vault-schedule"', 'gv-schedule-page', 'Schedule'],
  },
  {
    id: 'landing',
    rel: 'index.html',
    urlPath: '/',
    markers: ['data-testid="landing-page"', 'gv-landing', 'GatorVault'],
  },
];

const REQUIRED_CSS_SIGNATURES = [
  { id: 'vault-shell', patterns: ['.gv-vault-shell{', '.gv-vault-shell '] },
  { id: 'hub-tabs', patterns: ['.gv-hub-tabs{', '.gv-hub-tabs ', '.gv-hub-tabs--scroll'] },
  { id: 'live-feed', patterns: ['.gv-live-feed{', '.gv-live-feed ', '.gv-live-feed__tabs'] },
  { id: 'team-page', patterns: ['.gv-team-page{', '.gv-team-page ', '.gv-team-page.'] },
];

function readText(root, rel) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file, 'utf8');
}

function firstScriptIndex(html) {
  return html.search(/<script[\s>]/i);
}

function cssBundleText(root, href) {
  if (!href) return '';
  const file = path.join(root, href.replace(/^\//, '').replace(/\//g, path.sep));
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}

function extractStylesheetHrefs(html) {
  const linkRe =
    /<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["'][^>]*>|<link[^>]+href=["']([^"']+)["'][^>]+rel=["']stylesheet["'][^>]*>/gi;
  const hrefs = [];
  let m;
  while ((m = linkRe.exec(html))) {
    const href = m[1] || m[2];
    if (href && !href.includes('fonts.googleapis')) hrefs.push(href);
  }
  return hrefs;
}

function findCssHrefBySignature(root, html, signature) {
  for (const href of extractStylesheetHrefs(html)) {
    const text = cssBundleText(root, href);
    if (signature.patterns.some((p) => text.includes(p))) return href;
  }
  const cssDir = path.join(root, '_next', 'static', 'css');
  if (!fs.existsSync(cssDir)) return null;
  for (const file of fs.readdirSync(cssDir)) {
    if (!file.endsWith('.css')) continue;
    const text = fs.readFileSync(path.join(cssDir, file), 'utf8');
    if (signature.patterns.some((p) => text.includes(p))) {
      return `/_next/static/css/${file}`;
    }
  }
  return null;
}

function checkBuildIdMatch(root) {
  const errors = [];
  const manifestPath = path.join(root, 'build-manifest.json');
  if (!fs.existsSync(manifestPath)) {
    errors.push('[A] build-manifest.json missing');
    return errors;
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const buildId = manifest.buildId;
  if (!buildId) errors.push('[A] build-manifest.json missing buildId');

  const sample = readText(root, 'vault/team/index.html');
  if (!sample) {
    errors.push('[A] vault/team/index.html missing for build-id check');
    return errors;
  }

  const metaMatch = sample.match(/name="gatorvault-build"\s+content="([^"]+)"/);
  if (!metaMatch) {
    errors.push('[A] gatorvault-build meta missing from vault HTML');
  } else if (buildId && !String(buildId).startsWith(metaMatch[1]) && !metaMatch[1].startsWith(String(buildId).slice(0, 12))) {
    errors.push(`[A] build ID mismatch: manifest=${buildId} html=${metaMatch[1]}`);
  }

  const nextBuildMatch = sample.match(/"buildId":"([^"]+)"/);
  if (nextBuildMatch) {
    const staticDirs = path.join(root, '_next', 'static');
    if (fs.existsSync(staticDirs)) {
      const dirs = fs.readdirSync(staticDirs).filter((d) => {
        if (d === 'chunks' || d === 'css' || d === 'development') return false;
        return fs.statSync(path.join(staticDirs, d)).isDirectory();
      });
      if (dirs.length && !dirs.includes(nextBuildMatch[1])) {
        errors.push(`[A] Next buildId ${nextBuildMatch[1]} has no matching _next/static folder (${dirs.join(', ')})`);
      }
    }
  }

  const landingPath = path.join(root, 'index.html');
  if (fs.existsSync(landingPath)) {
    const landingHtml = fs.readFileSync(landingPath, 'utf8');
    const landingBuild = landingHtml.match(/"buildId":"([^"]+)"/);
    const staticDirs = path.join(root, '_next', 'static');
    if (fs.existsSync(staticDirs)) {
      const dir = fs.readdirSync(staticDirs).find((d) => {
        if (d === 'chunks' || d === 'css' || d === 'development') return false;
        return fs.statSync(path.join(staticDirs, d)).isDirectory();
      });
      if (dir && landingBuild && landingBuild[1] !== dir) {
        errors.push(`[A] landing buildId mismatch: html=${landingBuild[1]} static=${dir}`);
      }
      if (dir && buildId && metaMatch && !String(buildId).startsWith(metaMatch[1].slice(0, 12))) {
        /* already checked meta vs manifest */
      }
    }
    if (!landingHtml.includes('r-(home)-layout-')) {
      errors.push('[A] landing index.html missing r-(home)-layout chunk script');
    }
    if (!landingHtml.includes('data-gv-landing-css') && !landingHtml.includes('gv-landing')) {
      errors.push('[C] landing CSS markers missing from index.html');
    }
  }

  return errors;
}

function checkHtmlJsAssets(root, htmlFiles) {
  const { verifyChunkAssets } = require('../../../client/scripts/verify-chunk-assets');
  const { missing } = verifyChunkAssets(root, htmlFiles);
  if (missing.length) {
    return [`[A] ${missing.length} HTML-referenced asset(s) missing (stale HTML/JS mismatch)`, ...missing.slice(0, 5).map((m) => `[A] missing ${m}`)];
  }
  return [];
}

function checkSsrMarkers(root, bundleFn) {
  const errors = [];
  for (const page of PILLAR_PAGES) {
    const text = bundleFn(root, page.rel);
    if (!text) {
      errors.push(`[B] missing export ${page.rel}`);
      continue;
    }
    const missing = page.markers.filter((m) => !text.includes(m));
    if (missing.length) errors.push(`[B] ${page.id} missing markers: ${missing.join(', ')}`);
  }
  return errors;
}

function checkCssLoadOrder(root, rel = 'vault/team/index.html') {
  const errors = [];
  const html = readText(root, rel);
  if (!html) return [`[C] ${rel} missing`];

  const scriptIdx = firstScriptIndex(html);
  const vaultShellIdx = html.indexOf('data-gv-vault-shell-css');
  if (vaultShellIdx < 0) {
    errors.push('[C] vault-shell CSS not marked first in HTML head');
  } else if (scriptIdx >= 0 && vaultShellIdx > scriptIdx) {
    errors.push('[C] vault-shell CSS loads after React scripts');
  }

  if (html.includes('gv-vault-shell__skeleton') && html.includes('gv-vault-shell__main')) {
    const mainIdx = html.indexOf('gv-vault-shell__main');
    const skIdx = html.indexOf('gv-vault-shell__skeleton');
    if (skIdx > mainIdx && html.indexOf('gv-vault-shell__skeleton', mainIdx) >= 0) {
      errors.push('[C/E] SSR HTML still gates content behind vault skeleton');
    }
  }

  for (const sig of REQUIRED_CSS_SIGNATURES) {
    const href = findCssHrefBySignature(root, html, sig);
    if (!href) {
      errors.push(`[C] ${sig.id} CSS not found in bundle`);
      continue;
    }
    const idx = html.indexOf(href);
    if (scriptIdx >= 0 && idx > scriptIdx) {
      errors.push(`[C] ${sig.id} CSS (${href}) loads after scripts`);
    }
  }

  return errors;
}

function checkMobileSafari(root) {
  const errors = [];
  const html = readText(root, 'vault/index.html') || '';
  if (!html.includes('viewport-fit=cover')) {
    errors.push('[F] viewport-fit=cover missing from vault HTML');
  }
  const text = html + cssBundleText(root, findCssHrefBySignature(root, html, REQUIRED_CSS_SIGNATURES[0]) || '');
  if (!text.includes('safe-area-inset') && !text.includes('env(safe-area-inset')) {
    errors.push('[F] safe-area-inset CSS missing');
  }
  return errors;
}

function localBundleText(root, rel) {
  const htmlPath = path.join(root, rel);
  if (!fs.existsSync(htmlPath)) return null;
  let text = fs.readFileSync(htmlPath, 'utf8');
  const scriptRe = /<script[^>]+src=["']([^"']+)["']/gi;
  const cssRe =
    /<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["']|<link[^>]+href=["']([^"']+\.css[^"']*)["'][^>]+rel=["']stylesheet["']/gi;
  const assets = [];
  let m;
  while ((m = scriptRe.exec(text))) {
    if (m[1] && !m[1].includes('google')) assets.push(m[1]);
  }
  while ((m = cssRe.exec(text))) {
    const href = m[1] || m[2];
    if (href && !href.includes('fonts.googleapis')) assets.push(href);
  }
  for (const src of assets.slice(0, 14)) {
    text += '\n' + cssBundleText(root, src);
  }
  return text;
}

function runLocalHydrationChecks(root) {
  const htmlFiles = PILLAR_PAGES.map((p) => p.rel);
  const errors = [
    ...checkBuildIdMatch(root),
    ...checkHtmlJsAssets(root, htmlFiles),
    ...checkSsrMarkers(root, localBundleText),
    ...checkCssLoadOrder(root, 'vault/team/index.html'),
    ...checkCssLoadOrder(root, 'vault/recruiting/index.html'),
    ...checkCssLoadOrder(root, 'vault/live-feed/index.html'),
    ...checkMobileSafari(root),
  ];
  return { ok: errors.length === 0, errors };
}

module.exports = {
  PILLAR_PAGES,
  REQUIRED_CSS_SIGNATURES,
  runLocalHydrationChecks,
  checkBuildIdMatch,
  checkSsrMarkers,
  checkCssLoadOrder,
  checkMobileSafari,
  localBundleText,
  findCssHrefBySignature,
  firstScriptIndex,
};
