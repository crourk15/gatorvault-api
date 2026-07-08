#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const gate = require('../lib/app-store-stability-gate');

const snap = gate.buildSnapshot({ healthReady: process.argv.includes('--not-ready') ? false : true });
if (process.argv.includes('--record')) {
  if (!snap.evaluation.green && !process.argv.includes('--force')) {
    console.error('[app-store-gate] sample not green — use --force to record anyway');
    console.log(JSON.stringify(snap, null, 2));
    process.exit(1);
  }
  const recorded = gate.recordDailySample(
    {
      qaPass: snap.sample.qaPass,
      healthReady: snap.sample.healthReady,
      productIntelOverall: snap.sample.productIntelOverall,
      crawlerFailed: snap.sample.crawlerFailed || 0,
      apiFailed: snap.sample.apiFailed || 0,
    },
    { force: process.argv.includes('--force') }
  );
  console.log(JSON.stringify({ recorded, evaluation: snap.evaluation }, null, 2));
  process.exit(snap.evaluation.green ? 0 : 1);
}
console.log(JSON.stringify(snap, null, 2));
process.exit(snap.evaluation.green ? 0 : 1);