#!/usr/bin/env node
/**
 * Sync On3 RPM UF % for allowlist targets missing Rivals PM.
 * Usage: node server/scripts/sync-allowlist-on3-rpm.js [--dry-run] [--no-fetch]
 */
const { syncAllowlistOn3Rpm } = require("../lib/on3-rpm-allowlist");

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const fetch = !process.argv.includes("--no-fetch");
  const out = await syncAllowlistOn3Rpm({ dryRun, fetch });
  console.log(JSON.stringify(out, null, 2));
  if (!out.ok) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
