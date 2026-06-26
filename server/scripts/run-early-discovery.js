#!/usr/bin/env node
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
require("tsx/cjs");

function parseArgs(argv) {
  const opts = { classYearGte: 2028, dryRun: false };
  for (const arg of argv) {
    if (arg === "--dry-run") opts.dryRun = true;
    else if (arg.startsWith("--class-year-gte=")) opts.classYearGte = Number(arg.split("=")[1]) || 2028;
  }
  return opts;
}

async function main() {
  if (!process.env.DATABASE_URL && !process.env.SUPABASE_DATABASE_URL) {
    console.error("[run-early-discovery] DATABASE_URL is required");
    process.exit(1);
  }
  const { runEarlyDiscoveryJob } = require("../lib/early-discovery-run.js");
  const result = await runEarlyDiscoveryJob(parseArgs(process.argv.slice(2)));
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error("[run-early-discovery] failed:", err.message || err);
  process.exit(1);
});
