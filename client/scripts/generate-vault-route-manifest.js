/**
 * Build-time map: vault route path → JS/CSS assets referenced in static HTML.
 * Consumed by client/lib/vault-preload.ts for modulepreload + CSS warming.
 */
const fs = require('fs');
const path = require('path');

const serverDir = path.join(__dirname, '..', '..', 'server');
const vaultDir = path.join(serverDir, 'vault');
const outPath = path.join(serverDir, 'js', 'vault-route-manifest.json');

const MODULE_RE = /\/(?:js\/vault-chunks|_next\/static\/chunks)\/[^"'\s<>]+\.js/g;
const STYLE_RE = /\/_next\/static\/css\/[^"'\s<>]+\.css/g;

function extractAssets(html) {
  const modules = [...new Set([...html.matchAll(MODULE_RE)].map((m) => m[0]))];
  const styles = [...new Set([...html.matchAll(STYLE_RE)].map((m) => m[0]))].filter(
    (href) => !html.includes(`data-gv-vault-shell-css="bundle" href="${href}"`)
  );
  return { modules, styles };
}

function htmlRelToRoute(relPath) {
  const normalized = relPath.replace(/\\/g, '/').replace(/\/index\.html$/, '');
  if (!normalized.startsWith('vault')) return null;
  const route = `/${normalized}`.replace(/\/$/, '') || '/vault';
  return route;
}

function walkVaultHtml(dir, relBase, routes) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = path.join(relBase, entry.name).replace(/\\/g, '/');
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkVaultHtml(full, rel, routes);
    else if (entry.name === 'index.html') {
      const route = htmlRelToRoute(rel);
      if (!route) continue;
      routes[route] = extractAssets(fs.readFileSync(full, 'utf8'));
    }
  }
}

function readBuildId() {
  const manifestPath = path.join(serverDir, 'build-manifest.json');
  if (!fs.existsSync(manifestPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8')).buildId || null;
  } catch {
    return null;
  }
}

if (!fs.existsSync(vaultDir)) {
  console.warn('[vault-route-manifest] server/vault missing — skipping');
  process.exit(0);
}

const routes = {};
walkVaultHtml(vaultDir, 'vault', routes);

const manifest = {
  version: 1,
  buildId: readBuildId(),
  generatedAt: new Date().toISOString(),
  routes,
  playerTemplates: {
    roster: '/vault/players',
    recruiting: '/vault/recruiting/player',
    futurecast: '/vault/futurecast/player',
    portal: '/vault/portal/player',
  },
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2));
console.log(
  `[vault-route-manifest] ${Object.keys(routes).length} routes → js/vault-route-manifest.json`
);
