/**
 * crawler:404 — React static export asset validation (no monolith CSS paths).
 * Production checks use live Netlify HTML — git server/vault/*.html may lag behind deploy builds.
 */
const fs = require('fs');
const path = require('path');
const config = require('../../qa/qa-config');
const { headUrl, fetchText } = require('../../qa/qa-utils');
const { loadCrawlerConfig, isRetiredAssetPath } = require('../load-config');

const SERVER_ROOT = path.join(__dirname, '..', '..', '..');

/** Pillar pages whose HTML references the deployed chunk set. */
const PRODUCTION_HTML_PATHS = [
  '/vault',
  '/vault/team',
  '/vault/recruiting',
  '/vault/futurecast',
  '/vault/live',
  '/vault/film-room',
  '/vault/schedule',
];

function collectHtmlFiles() {
  const cfg = loadCrawlerConfig();
  const files = ['index.html'];
  Object.values(cfg.routes || {}).forEach((r) => {
    if (r.export && !files.includes(r.export)) files.push(r.export);
  });
  return files;
}

function extractAssets(html) {
  const assetRe = /(?:src|href)=["']([^"']+\.(?:css|js|png|jpg|jpeg|webp|svg|woff2?))["']/gi;
  const assets = new Set();
  let m;
  while ((m = assetRe.exec(html || ''))) {
    const href = m[1];
    if (href.startsWith('http') || href.startsWith('//')) continue;
    const rel = href.replace(/^\//, '');
    if (shouldSkipAsset(rel)) continue;
    assets.add(rel);
  }
  return assets;
}

/** App-router chunks are rewritten to /js/vault-chunks/ at Netlify build — never deployed under _next/.../app/. */
function shouldSkipAsset(rel) {
  const norm = String(rel || '').replace(/^\//, '');
  if (isRetiredAssetPath(norm)) return true;
  if (norm.includes('gv-team-mobile') || norm.includes('css/gv-team.css')) return true;
  if (norm.startsWith('_next/static/chunks/app/')) return true;
  if (norm.startsWith('_next/static/chunks/routes/')) return true;
  if (norm.startsWith('_next/static/chunks/main-app-')) return true;
  if (norm.startsWith('_next/static/chunks/main-entry-')) return true;
  if (norm.startsWith('_next/static/chunks/mentry-')) return true;
  return false;
}

async function collectProductionHtmlAssets() {
  const assets = new Set();
  const base = config.SITE_URL.replace(/\/$/, '');
  for (const pagePath of PRODUCTION_HTML_PATHS) {
    try {
      const { text } = await fetchText(`${base}${pagePath}`);
      extractAssets(text).forEach((a) => assets.add(a));
    } catch {
      /* page unreachable — other modules will flag */
    }
  }
  return assets;
}

function collectLocalHtmlAssets() {
  const assets = new Set();
  collectHtmlFiles().forEach((file) => {
    try {
      const html = fs.readFileSync(path.join(SERVER_ROOT, file), 'utf8');
      extractAssets(html).forEach((a) => assets.add(a));
    } catch {
      /* missing export handled by integrity:react-exports */
    }
  });
  return assets;
}

async function analyze404Assets() {
  const issues = [];
  const useProductionHtml = config.SCAN_PRODUCTION !== false;
  const allAssets = useProductionHtml
    ? await collectProductionHtmlAssets()
    : collectLocalHtmlAssets();

  if (!allAssets.size && useProductionHtml) {
    issues.push({
      ruleId: 'F3',
      checkId: 'crawler:404',
      sectionId: 'static-assets',
      page: '/vault',
      selector: 'production-html',
      domPath: 'production-html',
      severity: 'high',
      confidence: 90,
      message: 'Could not extract assets from production vault HTML',
      recommendedFix: 'Verify Netlify deploy and /vault/* redirects return 200 HTML',
    });
    return issues;
  }

  const sample = [...allAssets].slice(0, 30);
  await Promise.all(
    sample.map(async (rel) => {
      if (!useProductionHtml) {
        const localPath = path.join(SERVER_ROOT, rel);
        if (!fs.existsSync(localPath)) {
          if (rel.startsWith('_next/static/css/')) return;
          issues.push({
            ruleId: 'F3',
            checkId: 'crawler:404',
            sectionId: 'static-assets',
            page: '/',
            selector: rel,
            domPath: rel,
            severity: 'high',
            confidence: 99,
            message: `Missing React export asset: ${rel}`,
            recommendedFix: `Rebuild client export and merge — asset ${rel} missing from server/`,
          });
          return;
        }
      }

      if (!useProductionHtml) return;
      const url = `${config.SITE_URL.replace(/\/$/, '')}/${rel}`;
      const r = await headUrl(url);
      if (!r.ok && r.status === 404) {
        if (rel.startsWith('_next/static/css/')) return;
        issues.push({
          ruleId: 'F3',
          checkId: 'crawler:404',
          sectionId: 'static-assets',
          page: '/',
          selector: rel,
          domPath: rel,
          severity: 'high',
          confidence: 95,
          message: `Production 404 for React asset: ${rel}`,
          recommendedFix: `Deploy missing asset ${rel} from client build to Netlify`,
        });
      }
    })
  );

  return issues.slice(0, 10);
}

module.exports = { analyze404Assets, extractAssets, collectHtmlFiles, shouldSkipAsset };
