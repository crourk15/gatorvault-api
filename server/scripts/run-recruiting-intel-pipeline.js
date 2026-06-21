#!/usr/bin/env node
/**
 * Full recruiting intel pipeline: On3/Rivals ingest → allowlist sync → snapshot rebuild.
 * Run locally before deploy or in CI (Netlify prebuild).
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { runOn3Ingest } = require('../lib/on3-ingest');
const { runRivalsPredictionIngest } = require('../lib/rivals-prediction-ingest');
const { rebuildRecruitingSnapshots } = require('../lib/recruiting-snapshot-rebuild');

async function main() {
  const skipIngest = process.argv.includes('--snapshots-only');
  const result = { skipIngest, on3: null, rivals: null, snapshots: null };

  if (!skipIngest) {
    console.log('[recruiting-pipeline] On3 ingest…');
    result.on3 = await runOn3Ingest();
    if (process.env.RIVALS_PM_INGEST_ENABLED === 'true' || process.argv.includes('--rivals')) {
      console.log('[recruiting-pipeline] Rivals PM ingest…');
      result.rivals = await runRivalsPredictionIngest({ force: false });
    }
  }

  console.log('[recruiting-pipeline] Rebuilding snapshots…');
  require('./sync-target-board-from-store');
  result.snapshots = await rebuildRecruitingSnapshots();

  console.log('[recruiting-pipeline] complete', JSON.stringify({
    on3Fired: result.on3?.fired?.length ?? null,
    snapshots: result.snapshots?.elapsedMs,
  }));
}

main().catch((err) => {
  console.error('[recruiting-pipeline] failed:', err.message);
  process.exit(1);
});
