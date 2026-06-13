/**
 * Merge Next.js static export (client/out) into server/ for Netlify publish.
 * Overlays React routes (landing, join, vault, FutureCast) onto server/.
 */
const fs = require('fs');
const path = require('path');
const vaultMap = require('../lib/routes-vault.cjs');
const { verifyChunkAssets } = require('./verify-chunk-assets');
const { rewriteNextChunkPathsForNetlify } = require('./rewrite-next-chunk-paths');

const outDir = path.join(__dirname, '..', 'out');
const serverDir = path.join(__dirname, '..', '..', 'server');
const nextDir = path.join(serverDir, '_next');

/** Required export paths for Netlify (canonical vault map + legacy standalone). */
const REQUIRED_EXPORTS = [
  ...vaultMap.REQUIRED_VAULT_EXPORTS,
  'futurecast/index.html',
  'futurecast/alerts/index.html',
  'futurecast/staff/index.html',
  'futurecast/stock/index.html',
  'futurecast/snapshots/index.html',
  'vault/scouting/index.html',
  'vault/depth-chart/index.html',
  'vault/portal/index.html',
  'vault/game-week/index.html',
  'vault/live-scores/index.html',
  'vault/articles/index.html',
  'vault/community/index.html',
  'vault/game-zone/index.html',
  'vault/nil/index.html',
  'vault/staff/index.html',
  'vault/alerts/index.html',
  'vault/tickets/index.html',
  'vault/apparel/index.html',
  'vault/futurecast/stock/index.html',
  'vault/futurecast/snapshots/index.html',
  'vault/futurecast/alerts/index.html',
  'vault/futurecast/staff/index.html',
  'vault/recruiting-board/index.html',
  'vault/portal/player/index.html',
  'recruiting-board/index.html',
  'players/index.html',
  'scouting/index.html',
  'player/index.html',
  'portal/index.html',
  'alerts/index.html',
  'staff/index.html',
  'staff/dashboard/index.html',
  '_next/static',
];

const CHUNK_VERIFY_HTML = [
  'index.html',
  ...vaultMap.REQUIRED_VAULT_EXPORTS.filter((p) => p.endsWith('.html')),
];

function rmRecursive(target) {
  if (!fs.existsSync(target)) return;
  fs.rmSync(target, { recursive: true, force: true });
}

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyRecursive(from, to);
    else fs.copyFileSync(from, to);
  }
}

function verifyExports() {
  const unique = [...new Set(REQUIRED_EXPORTS)];
  const missing = unique.filter((rel) => !fs.existsSync(path.join(serverDir, rel)));
  if (missing.length) {
    console.error('[netlify] Export verification failed. Missing in server/:');
    for (const rel of missing) console.error('  -', rel);
    process.exit(1);
  }
  console.log('[netlify] Verified exports:', unique.length, 'paths including _next/static');
}

function verifyChunks() {
  const { assets, missing } = verifyChunkAssets(serverDir, CHUNK_VERIFY_HTML);
  if (missing.length) {
    console.error('[netlify] Chunk asset verification failed — HTML references missing _next files:');
    for (const rel of missing.slice(0, 20)) console.error('  -', rel);
    if (missing.length > 20) console.error(`  ... and ${missing.length - 20} more`);
    process.exit(1);
  }
  const routeChunks = assets.filter((a) => a.includes('_next/static/chunks/routes/'));
  console.log(`[netlify] Verified ${assets.length} _next assets (${routeChunks.length} route chunks)`);
}

if (!fs.existsSync(outDir)) {
  console.error('[netlify] client/out missing — run: npm run build --prefix client');
  process.exit(1);
}

require('./generate-redirects.js');

/* Replace stale _next tree so HTML + chunks always match (fixes Netlify CDN 404s). */
rmRecursive(nextDir);
copyRecursive(outDir, serverDir);
const netlifyPaths = rewriteNextChunkPathsForNetlify(serverDir);
console.log(`[netlify] Rewrote Next chunk paths for Netlify CDN (routes/ + main-entry-, ${netlifyPaths.filesUpdated} files)`);
verifyExports();
verifyChunks();

require('./stamp-build-meta.js');

const { spawnSync } = require('child_process');
const guardian = spawnSync(
  process.execPath,
  [path.join(__dirname, '..', '..', 'server', 'scripts', 'deploy-guardian.js'), '--phase=pre', '--static', '--skip-api'],
  { stdio: 'inherit', cwd: path.join(__dirname, '..', '..', 'server') }
);
if (guardian.status !== 0) {
  console.error('[netlify] deploy-guardian static check failed — blocking publish');
  process.exit(guardian.status || 1);
}

console.log('[netlify] Merged FutureCast UI from client/out into server/');
