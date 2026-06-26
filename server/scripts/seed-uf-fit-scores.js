#!/usr/bin/env node
/**
 * Seed futurecast.uf_specific_profiles from target board + MODEL predictions.
 * Run against production DATABASE_URL after migrate:players.
 *
 * Usage:
 *   node server/scripts/seed-uf-fit-scores.js
 *   node server/scripts/seed-uf-fit-scores.js --class-year=2027 --dry-run
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
require("tsx/cjs");

const fs = require("fs");
const path = require("path");
const { buildUfFitSeedProfile } = require("../lib/uf-fit-score-seed.js");
const { loadFuturecastPredictionBySlug } = require("../lib/load-futurecast-prediction-by-slug.js");

const TARGET_BOARD_PATH = path.join(__dirname, "../data/recruiting/2027-target-board.json");
const RECRUITING_PLAYERS_PATH = path.join(__dirname, "../data/recruiting/players.json");

function parseArgs(argv) {
  const opts = { classYear: 2027, dryRun: false, limit: 0 };
  for (const arg of argv) {
    if (arg === "--dry-run") opts.dryRun = true;
    else if (arg.startsWith("--class-year=")) opts.classYear = Number(arg.split("=")[1]);
    else if (arg.startsWith("--limit=")) opts.limit = Number(arg.split("=")[1]);
  }
  return opts;
}

function loadTargetBoardBySlug() {
  const map = new Map();
  try {
    const doc = JSON.parse(fs.readFileSync(TARGET_BOARD_PATH, "utf8"));
    for (const row of doc.targets || []) {
      if (row?.slug) map.set(String(row.slug).toLowerCase(), row);
    }
  } catch {
    /* optional */
  }
  return map;
}

function loadRecruitingBySlug() {
  const map = new Map();
  try {
    const rows = JSON.parse(fs.readFileSync(RECRUITING_PLAYERS_PATH, "utf8"));
    for (const row of rows || []) {
      if (row?.slug) map.set(String(row.slug).toLowerCase(), row);
    }
  } catch {
    /* optional */
  }
  return map;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!process.env.DATABASE_URL && !process.env.SUPABASE_DATABASE_URL) {
    console.error("[seed-uf-fit] DATABASE_URL is required");
    process.exit(1);
  }

  const { listPlayers } = require("../models/player.ts");
  const { upsertUFSpecificProfile } = require("../models/uf-specific-profile.ts");
  const { closeDb } = require("../models/db.ts");

  const targetBySlug = loadTargetBoardBySlug();
  const recruitingBySlug = loadRecruitingBySlug();
  const predictionBySlug = await loadFuturecastPredictionBySlug(opts.classYear);

  let players = await listPlayers({ class_year: opts.classYear, status: "HS" });
  if (opts.limit > 0) players = players.slice(0, opts.limit);

  let upserted = 0;
  let skipped = 0;
  const samples = [];

  for (const player of players) {
    const slugKey = String(player.slug || "").toLowerCase();
    const targetSeed = targetBySlug.get(slugKey) || null;
    const recruiting = recruitingBySlug.get(slugKey) || null;
    const modelPred = predictionBySlug.get(player.slug) || predictionBySlug.get(slugKey) || null;

    if (!targetSeed && !recruiting && !modelPred) {
      skipped += 1;
      continue;
    }

    const profile = buildUfFitSeedProfile({
      playerId: player.id,
      slug: player.slug,
      classYear: player.class_year,
      state: player.state,
      targetSeed,
      recruiting,
      modelPred,
    });

    if (opts.dryRun) {
      upserted += 1;
      if (samples.length < 8) {
        samples.push({
          slug: player.slug,
          uf_fit_score: profile.uf_fit_score,
          uf_status: profile.uf_status,
          scheme: profile.scheme_score,
        });
      }
      continue;
    }

    await upsertUFSpecificProfile(profile);
    upserted += 1;
    if (samples.length < 8) {
      samples.push({
        slug: player.slug,
        uf_fit_score: profile.uf_fit_score,
        uf_status: profile.uf_status,
      });
    }
  }

  await closeDb();

  console.log(
    JSON.stringify(
      {
        ok: true,
        dryRun: opts.dryRun,
        classYear: opts.classYear,
        candidates: players.length,
        upserted,
        skipped,
        samples,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error("[seed-uf-fit] failed:", err.message || err);
  process.exit(1);
});
