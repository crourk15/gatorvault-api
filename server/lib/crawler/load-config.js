/**
 * Crawler config — loads canonical vault-route-map via routes-vault.cjs
 */
const path = require('path');
const vaultMap = require('../../../client/lib/routes-vault.cjs');

const CONFIG_PATH = path.join(__dirname, '..', '..', 'config', 'crawler-config.json');

let cachedJson = null;

function loadCrawlerConfigJson() {
  if (cachedJson) return cachedJson;
  try {
    cachedJson = require(CONFIG_PATH);
  } catch {
    cachedJson = {};
  }
  return cachedJson;
}

function loadCrawlerConfig() {
  const json = loadCrawlerConfigJson();
  return {
    version: json.version || '4.1.0',
    architecture: 'react',
    routes: vaultMap.VAULT_PILLAR_ROUTES,
    pillarQa: vaultMap.PILLAR_QA,
    recruitingSubRoutes: vaultMap.RECRUITING_SUB_ROUTES,
    playerProfiles: vaultMap.PLAYER_PROFILE_ROUTES,
    requiredExports: vaultMap.REQUIRED_VAULT_EXPORTS,
    retiredChecks: vaultMap.RETIRED_CHECKS,
    retiredPatterns: vaultMap.RETIRED_PATTERNS,
    legacyRedirects: vaultMap.LEGACY_ROUTE_REDIRECTS,
    ...json,
  };
}

function isRetiredCheck(checkId) {
  return vaultMap.RETIRED_CHECKS.includes(checkId);
}

function isRetiredPattern(text) {
  const hay = String(text || '');
  return vaultMap.RETIRED_PATTERNS.some((p) => hay.includes(p));
}

function isRetiredAssetPath(rel) {
  const norm = String(rel || '').replace(/^\//, '');
  const retired = ['css/gv-team.css', 'js/gv-team-mobile.js', 'legacy-index.html'];
  return retired.some((p) => norm.includes(p));
}

function routeMap() {
  const pillars = vaultMap.VAULT_PILLAR_ROUTES;
  const routes = {};
  Object.entries(pillars).forEach(([key, routePath]) => {
    const qa = vaultMap.PILLAR_QA[routePath] || {};
    routes[routePath] = {
      key,
      export: vaultMap.routeToExport(routePath),
      testid: qa.testid,
      markers: qa.markers || [],
    };
  });
  routes['/'] = {
    key: 'landing',
    export: 'index.html',
    testid: 'landing-page',
    markers: ['landing-page'],
  };
  return routes;
}

function componentMap() {
  return vaultMap.PLAYER_PROFILE_ROUTES;
}

function getRequiredExports() {
  return vaultMap.REQUIRED_VAULT_EXPORTS;
}

module.exports = {
  loadCrawlerConfig,
  isRetiredCheck,
  isRetiredPattern,
  isRetiredAssetPath,
  routeMap,
  componentMap,
  getRequiredExports,
  vaultMap,
};
