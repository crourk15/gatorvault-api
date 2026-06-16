#!/usr/bin/env node
/**
 * Pre-deploy smoke — verify required vault static exports exist locally.
 * Usage: node scripts/pre-deploy-check.js [serverDir]
 */
const fs = require('fs');
const path = require('path');

const SERVER_ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..', 'server'));
const ROUTES = [
  'vault/index.html',
  'vault/recruiting/index.html',
  'vault/futurecast/index.html',
  'vault/team/index.html',
  'vault/film-room/index.html',
  'vault/schedule/index.html',
  'vault/live/index.html',
  'join/index.html',
  '_next/static',
];

let failed = 0;
for (const rel of ROUTES) {
  const full = path.join(SERVER_ROOT, rel);
  if (!fs.existsSync(full)) {
    console.error('MISSING', rel);
    failed += 1;
  } else {
    console.log('OK', rel);
  }
}

if (failed) {
  console.error(`\npre-deploy-check: ${failed} path(s) missing under ${SERVER_ROOT}`);
  process.exit(1);
}
console.log('\npre-deploy-check: all vault routes present');
