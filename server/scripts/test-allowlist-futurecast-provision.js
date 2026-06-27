#!/usr/bin/env node
/**
 * Smoke test — allowlist FutureCast prediction provision (dry run).
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { runAllowlistFuturecastProvision } = require('../lib/allowlist-futurecast-provision');

async function main() {
  const dryRun = !process.argv.includes('--write');
  const result = await runAllowlistFuturecastProvision({ classYear: 2028, dryRun });
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
