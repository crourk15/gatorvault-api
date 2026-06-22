#!/usr/bin/env node
/**
 * Seed / sync recruiting intel JSON → Postgres (one-time or repair).
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const persistence = require('../lib/recruiting-intel-persistence');
const intelStore = require('../lib/recruiting-intel-store');

async function main() {
  if (!persistence.isEnabled()) {
    console.error('DATABASE_URL is not set — cannot sync intel to Postgres.');
    process.exit(1);
  }
  await persistence.ensureTable();
  const doc = intelStore.loadIntelDoc();
  const items = doc.items || [];
  const count = await persistence.replaceAll(items);
  await intelStore.initIntelStore();
  console.log(JSON.stringify({ ok: true, synced: count, mode: persistence.getStoreInfo() }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
