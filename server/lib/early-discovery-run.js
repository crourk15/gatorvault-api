/**
 * Phase 2 — recompute discovery_score for underclassmen (2028+) in Postgres.
 */
require("tsx/cjs");

const fs = require("fs");
const path = require("path");
const { computeDiscoveryScore } = require("./early-discovery-score.js");
const { ALLOWLIST_2028 } = require("./recruiting-target-allowlist");
const { ALLOWLIST_DISCOVERY_FLOOR } = require("./early-discovery-allowlist-merge");

const BOARD_2028_PATH = path.join(__dirname, "../data/recruiting/2028-target-board.json");

function load2028BoardBySlug() {
  const map = new Map();
  try {
    const doc = JSON.parse(fs.readFileSync(BOARD_2028_PATH, "utf8"));
    for (const row of doc.targets || []) {
      if (row?.slug) map.set(String(row.slug).toLowerCase(), row);
    }
  } catch {
    /* optional */
  }
  return map;
}

async function runEarlyDiscoveryJob({ classYearGte = 2028, dryRun = false } = {}) {
  const { db } = require("../models/db.ts");
  const { updateDiscoveryScore } = require("../models/highschool-profile.ts");
  const {
    getUFSpecificProfileByPlayerId,
    updateUfStatus,
    upsertUFSpecificProfile,
  } = require("../models/uf-specific-profile.ts");

  const boardBySlug = load2028BoardBySlug();
  const allowlist2028 = new Set(ALLOWLIST_2028.map((s) => String(s).toLowerCase()));

  const { rows: players } = await db.query(
    `
    SELECT
      p.id,
      p.slug,
      p.full_name,
      p.class_year,
      p.position,
      p.state,
      p.stars,
      p.composite_rating,
      COALESCE(
        array_agg(DISTINCT ds.signal_type::text) FILTER (WHERE ds.signal_type IS NOT NULL),
        '{}'
      ) AS signal_types,
      hs.discovery_score AS existing_discovery_score
    FROM futurecast.players p
    LEFT JOIN futurecast.discovery_signals ds ON ds.player_id = p.id
    LEFT JOIN futurecast.high_school_profiles hs ON hs.player_id = p.id
    WHERE p.class_year >= $1
      AND p.status = 'HS'
    GROUP BY p.id, p.slug, p.full_name, p.class_year, p.position, p.state, p.stars, p.composite_rating, hs.discovery_score
    ORDER BY p.class_year ASC, p.full_name ASC
    `,
    [classYearGte]
  );

  let processed = 0;
  let promoted = 0;
  const samples = [];

  for (const row of players) {
    const slugKey = String(row.slug || "").toLowerCase();
    const seed = boardBySlug.get(slugKey);
    const inFlorida = String(row.state || seed?.state || "").toUpperCase() === "FL" || Boolean(seed?.inState);
    const score = Math.max(
      computeDiscoveryScore({
        signalTypes: row.signal_types || [],
        stars: seed?.stars ?? row.stars,
        rating: seed?.rating ?? row.composite_rating,
        inFlorida,
      }),
      Number(row.class_year) === 2028 && allowlist2028.has(slugKey) ? ALLOWLIST_DISCOVERY_FLOOR : 0
    );

    if (!dryRun) {
      await updateDiscoveryScore(row.id, score).catch(async () => {
        const { upsertHighSchoolProfile } = require("../models/highschool-profile.ts");
        await upsertHighSchoolProfile({
          player_id: row.id,
          discovery_score: score,
          offers: [],
          stats: {},
          recruiting_notes: seed?.skinny || null,
        });
      });

      if (score >= 60) {
        const ufStatus = score >= 75 ? "TARGET" : "EVAL";
        const promoteUfStatus = async () => {
          const existing = await getUFSpecificProfileByPlayerId(row.id);
          if (existing) {
            await updateUfStatus(row.id, ufStatus);
            return;
          }
          await upsertUFSpecificProfile({
            player_id: row.id,
            uf_status: ufStatus,
            metadata: { earlyDiscovery: true, discoveryScore: score },
          });
        };
        await promoteUfStatus().catch(() => null);
        promoted += 1;
      }
    }

    processed += 1;
    if (samples.length < 6) {
      samples.push({ slug: row.slug, classYear: row.class_year, discoveryScore: score });
    }
  }

  return {
    ok: true,
    dryRun,
    classYearGte,
    playersProcessed: processed,
    watchlistPromotions: promoted,
    targetPromotions: samples.filter((s) => s.discoveryScore >= 75).length,
    signalsCreated: 0,
    samples,
  };
}

module.exports = { runEarlyDiscoveryJob };
