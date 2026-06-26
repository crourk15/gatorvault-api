#!/usr/bin/env node
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const { spawnSync } = require("child_process");
const path = require("path");
const CLASS_YEAR_GTE = process.env.EARLY_DISCOVERY_CLASS_YEAR_GTE || "2028";
if (!process.env.DATABASE_URL && !process.env.SUPABASE_DATABASE_URL) {
  console.error("[early-discovery-cron] DATABASE_URL is not set");
  process.exit(0);
}
const result = spawnSync(
  process.execPath,
  ["--import", "tsx", path.join(__dirname, "run-early-discovery.js"), `--class-year-gte=${CLASS_YEAR_GTE}`],
  { cwd: path.join(__dirname, ".."), stdio: "inherit", env: process.env }
);
if (result.status !== 0) console.error("[early-discovery-cron] failed", result.status);
process.exit(0);
