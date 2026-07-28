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

function softFailIds() {
  return String(process.env.QA_SOFT_FAIL_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

runQaCrawl(opts)
  .then((result) => {
    const run = result.run || result;
    if (run && run.summary) {
      console.log('[qa] finished:', run.pass ? 'PASS' : 'FAIL', run.summary);
      if (run.phases) {
        console.log('[qa] phases:', JSON.stringify(run.phases.timingsMs), '| emitted:', run.phases.emit?.total ?? run.summary.emitted);
      }
      if (!run.pass) {
        const soft = new Set(softFailIds());
        const issues = run.issues || run.errors || [];
        issues.slice(0, 10).forEach((e) => {
          const softHit = soft.has(String(e.id || ''));
          console.error(
            softHit ? ' ~ (soft)' : ' -',
            e.module || 'crawler',
            e.id,
            e.recommendedFix || e.message
          );
        });
        const hard = issues.filter((e) => !soft.has(String(e.id || '')));
        if (hard.length) {
          process.exitCode = 1;
        } else {
          console.log('[qa] soft-only failures — not failing CI siren');
          process.exitCode = 0;
        }
      }
    } else if (result.skipped) {
      console.log('[qa] skipped:', result.reason);
    }
  })
  .catch((err) => {
    console.error('[qa] crashed:', err.message);
    process.exitCode = 1;
  });
