/**
 * integrity:react-routes — validate vault-route-map exports + forbidden monolith patterns.
 */
const fs = require('fs');
const path = require('path');
const config = require('../../../qa/qa-config');
const { check, headUrl } = require('../../../qa/qa-utils');
const { getRequiredExports, isRetiredPattern, routeMap, vaultMap } = require('../../load-config');

const SERVER_ROOT = path.join(__dirname, '..', '..', '..', '..');

function readLocal(rel) {
  try {
    return fs.readFileSync(path.join(SERVER_ROOT, rel.replace(/^\//, '')), 'utf8');
  } catch {
    return '';
  }
}

function exportSiteUrls(rel) {
  const clean = String(rel || '').replace(/^\//, '');
  const base = config.SITE_URL.replace(/\/$/, '');
  const dir = clean.replace(/index\.html$/, '');
  const urls = [`${base}/${dir}`, `${base}/${clean}`];
  return [...new Set(urls)];
}

async function exportExists(rel) {
  if (readLocal(rel)) return { ok: true, source: 'local' };
  for (const url of exportSiteUrls(rel)) {
    const head = await headUrl(url, { timeout: config.FETCH_TIMEOUT_MS, retries: 1 });
    if (head.ok) return { ok: true, source: 'site', url };
  }
  return { ok: false, source: 'missing', rel };
}

async function runReactRouteValidationChecks() {
  const checks = [];

  checks.push(
    await check('integrity:react-exports', 'integrity', 'Vault route map static exports', async () => {
      const required = getRequiredExports();
      const missing = [];
      const resolved = [];
      for (const rel of required) {
        const hit = await exportExists(rel);
        if (hit.ok) resolved.push({ rel, ...hit });
        else missing.push(rel);
      }
      if (missing.length) {
        const err = new Error(`${missing.length} export(s) missing locally and on ${config.SITE_URL}`);
        err.details = missing;
        err.repro = 'npm run build --prefix client && node client/scripts/merge-into-server.js';
        throw err;
      }
      return {
        exports: required.length,
        local: resolved.filter((r) => r.source === 'local').length,
        site: resolved.filter((r) => r.source === 'site').length
      };
    })
  );

  checks.push(
    await check('integrity:react-markers', 'integrity', 'React testid markers in static HTML', async () => {
      const issues = [];
      const routes = routeMap();
      Object.entries(routes).forEach(([routePath, meta]) => {
        const file = meta.export;
        const html = readLocal(file);
        if (!html) {
          issues.push({ route: routePath, file, missing: 'file' });
          return;
        }
        if (meta.testid && !html.includes(meta.testid)) {
          issues.push({ route: routePath, file, marker: meta.testid });
        }
        vaultMap.RETIRED_PATTERNS.forEach((pat) => {
          if (html.includes(pat)) {
            issues.push({ route: routePath, file, forbidden: pat });
          }
        });
      });
      if (issues.length) {
        const err = new Error(`${issues.length} route validation issue(s)`);
        err.details = issues.slice(0, 15);
        throw err;
      }
      return { routes: Object.keys(routes).length };
    })
  );

  checks.push(
    await check('integrity:react-routes', 'integrity', 'Vault pillar routes registered', async () => {
      const pillars = vaultMap.allPillarRoutes();
      const missingRewrites = pillars.filter((p) => {
        const exportPath = vaultMap.routeToExport(p);
        return !readLocal(exportPath);
      });
      if (missingRewrites.length) {
        const err = new Error(`Pillar routes missing exports: ${missingRewrites.join(', ')}`);
        err.details = missingRewrites;
        throw err;
      }
      return { pillars: pillars.length, subRoutes: vaultMap.RECRUITING_SUB_ROUTES.length };
    })
  );

  return checks;
}

module.exports = { runReactRouteValidationChecks };
