#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const store = require('../lib/recruiting-store');
const { reconcileCommittedTargetsFromStore } = require('../lib/commit-target-cleanup');

(async () => {
  const out = await reconcileCommittedTargetsFromStore(store, { source: 'cli_reconcile' });
  console.log(JSON.stringify(out, null, 2));
})().catch((err) => {
  console.error('[reconcile-committed-targets]', err.message);
  process.exit(1);
});