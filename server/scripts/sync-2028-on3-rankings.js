#!/usr/bin/env node
/**
 * Sync On3 composite + ranks for allowlist targets into recruiting store.
 *
 * Usage:
 *   node server/scripts/sync-2028-on3-rankings.js
 *   node server/scripts/sync-2028-on3-rankings.js --dry-run --limit=5
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

function parseArgs(argv) {
  const opts = { classYear: 2028, dryRun: false, limit: 0 };
  for (const arg of argv) {
    if (arg === "--dry-run") opts.dryRun = true;
    else if (arg.startsWith("--class-year=")) opts.classYear = Number(arg.split("=")[1]);
    else if (arg.startsWith("--limit=")) opts.limit = Number(arg.split("=")[1]);
  }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const { syncAllowlistTargetsFromOn3 } = require("../lib/allowlist-target-sync.js");

  if (opts.dryRun) {
    console.log(JSON.stringify({ ok: true, dryRun: true, classYear: opts.classYear }, null, 2));
    return;
  }
  const result = await syncAllowlistTargetsFromOn3({
    classYear: opts.classYear,
    limit: opts.limit > 0 ? opts.limit : undefined,
  });
  console.log(JSON.stringify({ ok: true, classYear: opts.classYear, result }, null, 2));
}

main().catch((err) => {
  console.error("[sync-2028-on3-rankings] failed:", err.message || err);
  process.exit(1);
});