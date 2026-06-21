#!/usr/bin/env node
/**
 * Build static page JSON snapshots for Netlify CDN (instant load when Render is cold).
 * Output: server/page-snapshot/
 */
const { main } = require('../lib/page-snapshot-builders');

main().catch((err) => {
  console.error('[build-page-snapshots] failed:', err.message);
  process.exit(1);
});
