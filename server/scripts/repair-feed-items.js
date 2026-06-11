#!/usr/bin/env node
/**
 * Repair data/live/feed-items.json — real SHA-256 hashes, dedupe, truncation removal.
 */
const path = require('path');
const fs = require('fs');
const feedDedup = require('../lib/live-feed-dedup');

const FEED_PATH = path.join(__dirname, '..', 'data', 'live', 'feed-items.json');

function loadFeed() {
  const raw = JSON.parse(fs.readFileSync(FEED_PATH, 'utf8'));
  return Array.isArray(raw) ? raw : raw.items || raw.feed || [];
}

function main() {
  const before = loadFeed();
  const preValidation = feedDedup.validateFeedIntegrity(before);
  console.log(`Before: ${before.length} items, ${preValidation.issues.length} issue(s)`);
  if (preValidation.issues.length) {
    console.log('Pre-repair issues:', JSON.stringify(preValidation.issues.slice(0, 8), null, 2));
  }

  const repaired = feedDedup.repairFeedItems(before, { log: true });
  fs.writeFileSync(FEED_PATH, JSON.stringify(repaired.items, null, 2));

  console.log(
    `After: ${repaired.after} items (removed ${repaired.removedCount}, rejected ${repaired.rejectedCount})`
  );
  if (repaired.validation.ok) {
    console.log('Validation: OK');
  } else {
    console.error('Validation still failing:', repaired.validation.issues.slice(0, 12));
    process.exitCode = 1;
  }
}

main();
