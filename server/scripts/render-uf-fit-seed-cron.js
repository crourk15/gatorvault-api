#!/usr/bin/env node
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const { spawnSync } = require("child_process");
const path = require("path");

if (!process.env.DATABASE_URL && !process.env.SUPABASE_DATABASE_URL) {
  console.error("[uf-fit-seed-cron] DATABASE_URL is not set");
  process.exit(0);
}

const yearsRaw =
  process.env.UF_FIT_SEED_CLASS_YEARS ||
  process.env.UF_FIT_SEED_CLASS_YEAR ||
  "2027,2028";
const classYears = yearsRaw
  .split(",")
  .map((s) => Number(String(s).trim()))
  .filter((n) => Number.isFinite(n) && n > 0);

if (!classYears.length) {
  console.error("[uf-fit-seed-cron] no valid class years in UF_FIT_SEED_CLASS_YEARS");
  process.exit(0);
}

let failed = false;
for (const classYear of classYears) {
  console.log(`[uf-fit-seed-cron] seeding class ${classYear}`);
  const result = spawnSync(
    process.execPath,
    [
      "--import",
      "tsx",
      path.join(__dirname, "seed-uf-fit-scores.js"),
      `--class-year=${classYear}`,
    ],
    { cwd: path.join(__dirname, ".."), stdio: "inherit", env: process.env }
  );
  if (result.status !== 0) {
    console.error("[uf-fit-seed-cron] failed for class", classYear, "status", result.status);
    failed = true;
  }
}

process.exit(failed ? 1 : 0);