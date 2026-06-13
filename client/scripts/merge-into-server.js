/**
 * Merge Next.js static export (client/out) into server/ for Netlify publish.
 * Keeps existing vault pages (index.html, admin, etc.) and overlays FutureCast routes.
 */
const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, '..', 'out');
const serverDir = path.join(__dirname, '..', '..', 'server');

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

if (!fs.existsSync(outDir)) {
  console.error('[netlify] client/out missing — run: npm run build --prefix client');
  process.exit(1);
}

copyRecursive(outDir, serverDir);
console.log('[netlify] Merged FutureCast UI from client/out into server/');
