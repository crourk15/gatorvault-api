#!/usr/bin/env node
/**
 * Manual / CI entry point for the GatorVault QA crawler.
 * Usage: node scripts/run-qa-crawler.js [--browser] [--api-only]
 */
require('dotenv').config();

const args = process.argv.slice(2);
if (args.includes('--browser')) process.env.QA_BROWSER_ENABLED = 'true';

const { runQaCrawl } = require('../lib/qa/qa-runner');

runQaCrawl({ force: true })
  .then((result) => {
    const run = result.run || result;
    if (run && run.summary) {
      console.log('[qa] finished:', run.pass ? 'PASS' : 'FAIL', run.summary);
      if (!run.pass) {
        (run.errors || []).slice(0, 10).forEach((e) => {
          console.error(' -', e.module, e.id, e.message);
        });
        process.exitCode = 1;
      }
    } else if (result.skipped) {
      console.log('[qa] skipped:', result.reason);
    }
  })
  .catch((err) => {
    console.error('[qa] crashed:', err.message);
    process.exitCode = 1;
  });
