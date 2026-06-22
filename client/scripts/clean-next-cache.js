#!/usr/bin/env node
/**
 * Hard-delete Next.js build output before production builds.
 * Prevents stale RSC flight refs to old app-router chunk hashes.
 */
const fs = require('fs');
const path = require('path');

const clientDir = path.join(__dirname, '..');
const nextDir = path.join(clientDir, '.next');

if (fs.existsSync(nextDir)) {
  console.log('[clean-next-cache] Removing .next directory…');
  fs.rmSync(nextDir, { recursive: true, force: true });
}

const extraRoots = [
  path.join(clientDir, 'out'),
  path.join(clientDir, 'node_modules', '.cache', 'gv-next'),
];

for (const dir of extraRoots) {
  if (!fs.existsSync(dir)) continue;
  const rel = path.relative(clientDir, dir);
  console.log(`[clean-next-cache] Removing ${rel}…`);
  fs.rmSync(dir, { recursive: true, force: true });
}
