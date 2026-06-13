/**
 * Self-Runner — React architecture validator (routes, components, layout).
 */
const fs = require('fs');
const path = require('path');
const reactBp = require('../blueprint/react-blueprint');
const { loadCrawlerConfig } = require('../../crawler/load-config');

const SERVER_ROOT = path.join(__dirname, '..', '..');
const CLIENT_ROOT = path.join(SERVER_ROOT, '..', 'client');

function readClient(rel) {
  try {
    return fs.readFileSync(path.join(CLIENT_ROOT, rel.replace(/^client\//, '')), 'utf8');
  } catch {
    return '';
  }
}

function readServer(rel) {
  try {
    return fs.readFileSync(path.join(SERVER_ROOT, rel.replace(/^\//, '')), 'utf8');
  } catch {
    return '';
  }
}

function validateRoute(routePath) {
  const issues = [];
  const meta = reactBp.VAULT_ROUTES[routePath];
  if (!meta) {
    issues.push({ type: 'unknown-route', route: routePath });
    return { ok: false, issues };
  }
  const exportRel = routePath === '/'
    ? 'index.html'
    : `${routePath.replace(/^\//, '')}/index.html`;
  if (!readServer(exportRel)) {
    issues.push({ type: 'missing-export', route: routePath, file: exportRel });
  }
  const componentRel = meta.component.replace(/^client\//, '');
  if (!readClient(componentRel)) {
    issues.push({ type: 'missing-component', route: routePath, file: meta.component });
  } else if (meta.testid && !readClient(componentRel).includes(meta.testid)) {
    issues.push({ type: 'missing-testid', route: routePath, testid: meta.testid });
  }
  return { ok: !issues.length, issues };
}

function validateRoutes() {
  const cfg = loadCrawlerConfig();
  const results = [];
  Object.keys(cfg.routes || {}).forEach((route) => {
    if (cfg.routes[route].redirect) return;
    results.push({ route, ...validateRoute(route) });
  });
  const failed = results.filter((r) => !r.ok);
  return { ok: !failed.length, routes: results, failed };
}

function validateShell() {
  const issues = [];
  const shell = readClient('components/vault/VaultShell.tsx');
  const css = readClient('lib/vault-shell.css');
  const routes = readClient('lib/routes.js');
  if (!shell.includes('gv-vault-shell')) {
    issues.push({ type: 'shell-markup', detail: 'VaultShell missing gv-vault-shell class' });
  }
  if (!css.includes('gv-vault-bottom-nav')) {
    issues.push({ type: 'shell-css', detail: 'vault-shell.css missing bottom nav styles' });
  }
  if (!routes.includes('/vault')) {
    issues.push({ type: 'shell-routes', detail: 'routes.js missing /vault rewrite' });
  }
  return { ok: !issues.length, issues };
}

function validatePatchEdits(edits) {
  const blocked = [];
  (edits || []).forEach((edit) => {
    if (reactBp.isForbiddenEdit(edit)) {
      blocked.push({ edit, reason: 'forbidden_monolith_edit' });
    }
  });
  return { ok: !blocked.length, blocked };
}

function validateCheckId(checkId) {
  const cfg = loadCrawlerConfig();
  if ((cfg.retired?.checks || []).includes(checkId)) {
    return { ok: false, retired: true, reason: 'retired_monolith_check' };
  }
  return { ok: true };
}

module.exports = {
  validateRoute,
  validateRoutes,
  validateShell,
  validatePatchEdits,
  validateCheckId
};
