/**
 * Backfill recruiting_identity_patterns for all board players.
 * Usage: node scripts/backfill-identity-patterns.js
 */
const patternStore = require('../lib/identity-patterns-store');

(async () => {
  const result = await patternStore.rebuildAllPatterns();
  console.log('Identity patterns rebuilt:', result.count, 'players');
  console.log('Storage:', patternStore.storageMode());
  console.log('Updated:', result.updatedAt);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
