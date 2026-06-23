#!/usr/bin/env node
/** Fail build if mobile boot markers are missing from key vault pages. */
const fs = require('fs');
const path = require('path');

const serverDir = path.join(__dirname, '..', '..', 'server');

const CHECKS = [
  {
    file: 'vault/recruiting/index.html',
    must: [
      'data-hydrate="hero"',
      'data-rh-boot="class-overview"',
      'data-rh-boot-root',
      'loadClassMetrics',
      'data-gv-menu-boot',
      'data-vault-menu-toggle',
      'gv-app-menu-drawer',
      'gv-vault-bottom-nav',
    ],
  },
  {
    file: 'vault/team/index.html',
    must: ['data-gv-menu-boot', 'gv-vault-bottom-nav', 'Team Command Center'],
  },
  {
    file: 'vault/index.html',
    must: ['data-gv-menu-boot', 'data-home-wow-boot', 'gv-vault-bottom-nav'],
  },
];

let failed = false;
for (const check of CHECKS) {
  const full = path.join(serverDir, check.file);
  if (!fs.existsSync(full)) {
    console.error(`[verify-mobile-boot] missing file: ${check.file}`);
    failed = true;
    continue;
  }
  const html = fs.readFileSync(full, 'utf8');
  for (const needle of check.must) {
    if (!html.includes(needle)) {
      console.error(`[verify-mobile-boot] ${check.file} missing: ${needle}`);
      failed = true;
    }
  }
}

if (failed) process.exit(1);
console.log('[verify-mobile-boot] ok — mobile boot markers present on key vault pages');
