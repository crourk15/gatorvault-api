#!/usr/bin/env node
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const { spawnSync } = require("child_process");
const path = require("path");
const CLASS_YEAR = process.env.UF_FIT_SEED_CLASS_YEAR || "2027";
if (!process.env.DATABASE_URL && !process.env.SUPABASE_DATABASE_URL) {
  console.error("[uf-fit-seed-cron] DATABASE_URL is not set");
  process.exit(0);
}
const result = spawnSync(
  process.execPath,
  ["--import", "tsx", path.join(__dirname, "seed-uf-fit-scores.js"), `--class-year=${CLASS_YEAR}`],
  { cwd: path.join(__dirname, ".."), stdio: "inherit", env: process.env }
);
if (result.status !== 0) console.error("[uf-fit-seed-cron] failed", result.status);
process.exit(0);
