#!/usr/bin/env node
/**
 * Post-deploy cleanup: repair feed, purge legacy Self-Runner dedupe proposals, run v2 scan.
 *
 * Usage (from repo root or server/):
 *   node server/scripts/post-deploy-feed-cleanup.js
 *   node server/scripts/post-deploy-feed-cleanup.js --skip-scan
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const path = require('path');
const fs = require('fs');
const feedDedup = require('../lib/live-feed-dedup');
const queueCleanup = require('../lib/self-runner/self-runner-queue-cleanup');

const FEED_PATH = path.join(__dirname, '..', 'data', 'live', 'feed-items.json');
const args = new Set(process.argv.slice(2));
const skipScan = args.has('--skip-scan');

function loadFeed() {
  const raw = JSON.parse(fs.readFileSync(FEED_PATH, 'utf8'));
  return Array.isArray(raw) ? raw : raw.items || raw.feed || [];
}

async function main() {
  console.log('=== Post-deploy feed cleanup ===\n');

  const before = loadFeed();
  const preValidation = feedDedup.validateFeedIntegrity(before);
  console.log(`1. Feed repair — before: ${before.length} items, ${preValidation.issues.length} issue(s)`);

  const repaired = feedDedup.repairFeedItems(before, { log: true });
  fs.writeFileSync(FEED_PATH, JSON.stringify(repaired.items, null, 2));
  console.log(
    `   after: ${repaired.after} items (removed ${repaired.removedCount}, rejected ${repaired.rejectedCount})`
  );
  console.log(`   validation: ${repaired.validation.ok ? 'OK' : 'FAIL'}`);
  if (!repaired.validation.ok) {
    console.error('   issues:', repaired.validation.issues.slice(0, 8));
    process.exitCode = 1;
  }

  console.log('\n2. Purge legacy Self-Runner dedupe proposals');
  const purge = queueCleanup.purgeLegacyDedupeProposals({ reject: true });
  console.log(`   removed/rejected: ${purge.removedCount}, remaining: ${purge.remaining}`);
  if (purge.removed.length) {
    purge.removed.forEach((r) => console.log(`   - ${r.id} (${r.checkId}, ${r.patchType})`));
  }

  if (!skipScan) {
    console.log('\n3. Self-Runner 2.0 platform scan');
    const { runPlatformScanAndEnqueue } = require('../lib/self-runner/self-runner-v2-engine');
    const scan = await runPlatformScanAndEnqueue({ includeBlueprint: false, enqueue: true });
    console.log(`   issues: ${scan.issueCount}, patches enqueued: ${scan.enqueued?.length ?? scan.patchCount ?? 0}`);
    console.log(`   scanId: ${scan.scanId}`);
  }

  console.log('\n=== Done ===');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
