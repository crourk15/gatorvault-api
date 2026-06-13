/**
 * Copy Next.js static export → server/futurecast-ui for Express.
 */
const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, '..', 'out');
const targetDir = path.join(__dirname, '..', '..', 'server', 'futurecast-ui');

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
  console.error('[futurecast-ui] Next export missing — run next build first');
  process.exit(1);
}

if (fs.existsSync(targetDir)) {
  fs.rmSync(targetDir, { recursive: true, force: true });
}

copyRecursive(outDir, targetDir);
console.log('[futurecast-ui] Copied static export to server/futurecast-ui');
