#!/usr/bin/env node
/** One-shot: refill queue + process due posts. Usage: node scripts/run-x-autoposter.js */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { refillAutoposterQueue } = require('../lib/x-autoposter-fill');
const autoposter = require('../lib/x-autoposter');

async function main() {
  console.log('X AutoPoster run\n');
  const config = autoposter.getConfigStatus();
  console.log('Configured:', config.configured, '| Scheduler env:', config.schedulerEnabled);

  const verify = await autoposter.verifyCredentials({ force: true });
  if (!verify.ok) {
    console.error('Verify FAILED:', verify.error);
    process.exit(1);
  }
  console.log('Verified @' + verify.screenName);

  const refill = await refillAutoposterQueue({ minPending: 2, maxEnqueue: 5 });
  console.log('Refill:', JSON.stringify(refill, null, 2));

  const out = await autoposter.processDuePosts({ limit: 5 });
  console.log('Process:', JSON.stringify(out, null, 2));

  console.log('\n--- last 20 logs ---');
  autoposter.getAutoposterLogs(20).forEach((r) => {
    console.log(`[${r.ts}] ${r.level} — ${r.message}`, r.detail ? JSON.stringify(r.detail) : '');
  });
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
