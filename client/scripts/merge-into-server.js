/**
 * Merge Next.js static export (client/out) into server/ for Netlify publish.
 * Keeps existing vault pages (index.html, admin, etc.) and overlays FutureCast routes.
 */
const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, '..', 'out');
const serverDir = path.join(__dirname, '..', '..', 'server');

/** Required export paths for FutureCast on Netlify (relative to server/). */
const REQUIRED_EXPORTS = [
  'futurecast/index.html',
  'futurecast/stock/index.html',
  'futurecast/snapshots/index.html',
  'player/index.html',
  'alerts/index.html',
  'staff/dashboard/index.html',
  '_next/static',
];

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
  const missing = REQUIRED_EXPORTS.filter((rel) => !fs.existsSync(path.join(serverDir, rel)));
  if (missing.length) {
    console.error('[netlify] FutureCast export verification failed. Missing in server/:');
    for (const rel of missing) console.error('  -', rel);
    process.exit(1);
  }
  console.log('[netlify] Verified FutureCast export:', REQUIRED_EXPORTS.join(', '));
}

if (!fs.existsSync(outDir)) {
  console.error('[netlify] client/out missing — run: npm run build --prefix client');
  process.exit(1);
}

copyRecursive(outDir, serverDir);
verifyExports();
console.log('[netlify] Merged FutureCast UI from client/out into server/');
