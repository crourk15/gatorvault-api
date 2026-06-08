#!/usr/bin/env node
/**
 * Run Highlight + Interview ingestion pipeline once.
 *
 * Usage:
 *   node scripts/run-media-ingest.js
 *   node scripts/run-media-ingest.js --discover-only
 *   node scripts/run-media-ingest.js --limit=3
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { runMediaIngest } = require('../lib/media-ingest');
const brand = require('../lib/media-brand');

const args = process.argv.slice(2);
const discoverOnly = args.includes('--discover-only');
const limitArg = args.find((a) => a.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined;

async function main() {
  console.log('GatorVault media ingest');
  console.log('  ffmpeg:', brand.hasFfmpeg() ? 'ready' : 'NOT FOUND');
  const result = await runMediaIngest({ discoverOnly, limit });
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
