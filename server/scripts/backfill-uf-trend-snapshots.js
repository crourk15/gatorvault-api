#!/usr/bin/env node
/**
 * Backfill UF trend snapshots — seeds 7d baseline when prior/rolling delta is known.
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const { backfillUfTrendSnapshots } = require("../lib/uf-trend-snapshot");

(async () => {
  const dryRun = process.argv.includes("--dry-run");
  const result = await backfillUfTrendSnapshots({ dryRun });
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});