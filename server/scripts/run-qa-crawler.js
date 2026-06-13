#!/usr/bin/env node
/**
 * Manual / CI entry — React-native QA crawler (server/lib/crawler).
 * Usage: node scripts/run-qa-crawler.js [--browser] [--api-only]
 */
require('dotenv').config();

const args = process.argv.slice(2);
const opts = { force: true };
if (args.includes('--browser')) process.env.QA_BROWSER_ENABLED = 'true';
if (args.includes('--api-only')) opts.apiOnly = true;

const { runQaCrawl } = require('../lib/qa/qa-runner');

runQaCrawl(opts)
  .then((result) => {
    const run = result.run || result;
    if (run && run.summary) {
      console.log('[qa] finished:', run.pass ? 'PASS' : 'FAIL', run.summary);
      if (run.phases) {
        console.log('[qa] phases:', JSON.stringify(run.phases.timingsMs), '| emitted:', run.phases.emit?.total ?? run.summary.emitted);
      }
      if (!run.pass) {
        (run.issues || run.errors || []).slice(0, 10).forEach((e) => {
          console.error(' -', e.module || 'crawler', e.id, e.recommendedFix || e.message);
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
