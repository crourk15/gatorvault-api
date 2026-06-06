#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { runOn3Ingest } = require('../lib/on3-ingest');

const baselineOnly =
  process.argv.includes('--baseline') || process.env.ON3_INGEST_BASELINE === 'true';

runOn3Ingest({ baselineOnly })
  .then((result) => {
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok && result.errors.length) process.exitCode = 1;
  })
  .catch((err) => {
    console.error('[on3-ingest] failed:', err.message);
    process.exitCode = 1;
  });
