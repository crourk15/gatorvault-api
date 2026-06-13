/**
 * integrity:react-routes — validate vault-route-map exports + forbidden monolith patterns.
 */
const fs = require('fs');
const path = require('path');
const { check } = require('../../../qa/qa-utils');
const { getRequiredExports, isRetiredPattern, routeMap, vaultMap } = require('../../load-config');

const SERVER_ROOT = path.join(__dirname, '..', '..', '..', '..');

function readLocal(rel) {
  try {
    return fs.readFileSync(path.join(SERVER_ROOT, rel.replace(/^\//, '')), 'utf8');
  } catch {
    return '';
  }
}

async function runReactRouteValidationChecks() {
  const checks = [];

  checks.push(
    await check('integrity:react-exports', 'integrity', 'Vault route map static exports', async () => {
      const missing = getRequiredExports().filter((rel) => !readLocal(rel));
      if (missing.length) {
        const err = new Error(`${missing.length} export(s) missing — run client build + merge-into-server`);
        err.details = missing;
        err.repro = 'npm run build --prefix client && node client/scripts/merge-into-server.js';
        throw err;
      }
      return { exports: getRequiredExports().length };
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
