#!/usr/bin/env node
/**
 * Pre-start verification — fail fast on Render if insider-articles routes are missing.
 */
const fs = require('fs');
const path = require('path');

const ROUTES_REL = path.join('lib', 'insider-articles-routes.js');
const routesPath = path.join(__dirname, '..', ROUTES_REL);

if (!fs.existsSync(routesPath)) {
  console.error('[boot-verify] MISSING file:', ROUTES_REL, '(expected at', routesPath + ')');
  process.exit(1);
}

let mod;
try {
  mod = require(routesPath);
} catch (err) {
  console.error('[boot-verify] require failed for', ROUTES_REL, ':', err.message);
  process.exit(1);
}

if (typeof mod.mountInsiderArticlesRoutes !== 'function') {
  console.error(
    '[boot-verify] insider-articles-routes.js must export mountInsiderArticlesRoutes (got',
    typeof mod.mountInsiderArticlesRoutes + ')'
  );
  process.exit(1);
}

console.log('[boot-verify] OK —', ROUTES_REL, 'exports mountInsiderArticlesRoutes');
