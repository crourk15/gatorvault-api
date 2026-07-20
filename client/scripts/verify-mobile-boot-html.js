#!/usr/bin/env node
/** Fail build if mobile boot markers are missing from all vault pillar + menu pages. */
const fs = require('fs');
const path = require('path');

const serverDir = path.join(__dirname, '..', '..', 'server');

const BOOT_MARKERS = [
  'data-gv-menu-boot',
  'data-vault-menu-toggle',
  'gv-app-menu-drawer',
  'gv-vault-bottom-nav',
];

const PAGE_FILES = [
  'vault/index.html',
  'vault/recruiting/index.html',
  'vault/team/index.html',
  'vault/live/index.html',
  'vault/futurecast/index.html',
  'vault/schedule/index.html',
  'vault/film-room/index.html',
  'vault/game-week/index.html',
  'vault/live-scores/index.html',
  'vault/articles/index.html',
  'vault/community/index.html',
  'vault/game-zone/index.html',
  'vault/nil/index.html',
  'vault/apparel/index.html',
  'vault/membership/index.html',
  'vault/alerts/index.html',
];

const EXTRA = {
  'vault/recruiting/index.html': [
    'data-hydrate="hero"',
    'data-rh-boot="class-overview"',
    'data-rh-boot-root',
    'loadClassMetrics',
  ],
  'vault/index.html': ['data-home-wow-boot'],
  'vault/team/index.html': ['Florida Football'],
};

let failed = false;
for (const file of PAGE_FILES) {
  const full = path.join(serverDir, file);
  if (!fs.existsSync(full)) {
    console.error(`[verify-mobile-boot] missing file: ${file}`);
    failed = true;
    continue;
  }
  const html = fs.readFileSync(full, 'utf8');
  const must = [...BOOT_MARKERS, ...(EXTRA[file] || [])];
  for (const needle of must) {
    if (!html.includes(needle)) {
      console.error(`[verify-mobile-boot] ${file} missing: ${needle}`);
      failed = true;
    }
  }
}

if (failed) process.exit(1);
console.log(`[verify-mobile-boot] ok — boot markers on ${PAGE_FILES.length} vault pages`);
