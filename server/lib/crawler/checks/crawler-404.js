/**
 * crawler:404 — React static export asset validation (no monolith CSS paths).
 */
const fs = require('fs');
const path = require('path');
const config = require('../../qa/qa-config');
const { headUrl } = require('../../qa/qa-utils');
const { loadCrawlerConfig, isRetiredAssetPath } = require('../load-config');

const SERVER_ROOT = path.join(__dirname, '..', '..', '..');

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
    if (isRetiredAssetPath(rel)) continue;
    if (rel.includes('gv-team-mobile') || rel.includes('css/gv-team.css')) continue;
    assets.add(rel);
  }
  return assets;
}

async function analyze404Assets() {
  const issues = [];
  const allAssets = new Set();

  collectHtmlFiles().forEach((file) => {
    try {
      const html = fs.readFileSync(path.join(SERVER_ROOT, file), 'utf8');
      extractAssets(html).forEach((a) => allAssets.add(a));
    } catch {
      /* missing export handled by integrity:react-exports */
    }
  });

  const sample = [...allAssets].slice(0, 20);
  await Promise.all(
    sample.map(async (rel) => {
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
          recommendedFix: `Rebuild client export and merge — asset ${rel} missing from server/`
        });
        return;
      }
      if (config.SCAN_PRODUCTION === false) return;
      const url = `${config.SITE_URL}/${rel}`;
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
          recommendedFix: `Deploy missing asset ${rel} from client build to Netlify`
        });
      }
    })
  );

  return issues.slice(0, 10);
}

module.exports = { analyze404Assets, extractAssets, collectHtmlFiles };
