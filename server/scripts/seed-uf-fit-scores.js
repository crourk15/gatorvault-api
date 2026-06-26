#!/usr/bin/env node
/**
 * Seed futurecast.uf_specific_profiles from target board + MODEL predictions.
 *
 * Usage:
 *   node server/scripts/seed-uf-fit-scores.js
 *   node server/scripts/seed-uf-fit-scores.js --class-year=2028 --dry-run
 *   node server/scripts/seed-uf-fit-scores.js --class-years=2027,2028
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
require("tsx/cjs");

function parseArgs(argv) {
  const opts = { classYears: [2027], dryRun: false, limit: 0 };
  for (const arg of argv) {
    if (arg === "--dry-run") opts.dryRun = true;
    else if (arg.startsWith("--class-year=")) opts.classYears = [Number(arg.split("=")[1])];
    else if (arg.startsWith("--class-years=")) {
      opts.classYears = arg
        .split("=")[1]
        .split(",")
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n) && n > 0);
    } else if (arg.startsWith("--limit=")) opts.limit = Number(arg.split("=")[1]);
  }
  if (!opts.classYears.length) opts.classYears = [2027];
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!process.env.DATABASE_URL && !process.env.SUPABASE_DATABASE_URL) {
    console.error("[seed-uf-fit] DATABASE_URL is required");
    process.exit(1);
  }

  const { runUfFitSeedBatch } = require("../engines/futurecast/uf-fit/compute-fit.ts");
  const { closeDb } = require("../models/db.ts");

  const summaries = [];
  for (const classYear of opts.classYears) {
    const result = await runUfFitSeedBatch({
      classYear,
      dryRun: opts.dryRun,
      limit: opts.limit > 0 ? opts.limit : undefined,
    });
    summaries.push(result);
    console.log(JSON.stringify({ label: `class-${classYear}`, ...result }, null, 2));
  }

  await closeDb();
  console.log(JSON.stringify({ ok: true, dryRun: opts.dryRun, summaries }, null, 2));
}

main().catch((err) => {
  console.error("[seed-uf-fit] failed:", err.message || err);
  process.exit(1);
});