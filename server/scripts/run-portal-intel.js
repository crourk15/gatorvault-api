#!/usr/bin/env node
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
require("tsx/cjs");

function parseArgs(argv) {
  const opts = { limit: 200, dryRun: false };
  for (const arg of argv) {
    if (arg === "--dry-run") opts.dryRun = true;
    else if (arg.startsWith("--limit=")) opts.classYearGte = Number(arg.split("=")[1]) || 2028;
  }
  return opts;
}

async function main() {
const { runPortalIntelJob } = require("../engines/futurecast/portal-intel/pipeline.ts");
  const result = await runEarlyDiscoveryJob(parseArgs(process.argv.slice(2)));
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error("[run-portal-intel] failed:", err.message || err);
  process.exit(1);
});
