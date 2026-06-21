#!/usr/bin/env node
/**
 * Remove all stale static publish artifacts before a Netlify build.
 * Prevents mixed chunk hashes (_next/static, js/vault-chunks, HTML shells).
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const clientDir = path.join(root, 'client');
const serverDir = path.join(root, 'server');

const TARGETS = [
  path.join(clientDir, '.next'),
  path.join(clientDir, 'out'),
  path.join(clientDir, 'node_modules', '.cache', 'gv-next'),
  path.join(serverDir, '_next'),
  path.join(serverDir, 'js', 'vault-chunks'),
  path.join(serverDir, 'page-snapshot'),
  path.join(serverDir, 'hub-snapshot'),
];

function rm(dir) {
  if (!fs.existsSync(dir)) return false;
  fs.rmSync(dir, { recursive: true, force: true });
  return true;
}

console.log('[clean-publish] Removing stale build artifacts…');
for (const dir of TARGETS) {
  const rel = path.relative(root, dir);
  if (rm(dir)) console.log('  removed', rel);
}

const clientClean = path.join(clientDir, 'scripts', 'clean-next-cache.js');
if (fs.existsSync(clientClean)) {
  spawnSync(process.execPath, [clientClean], { stdio: 'inherit', cwd: clientDir });
}

console.log('[clean-publish] Done — safe to run build:netlify');
