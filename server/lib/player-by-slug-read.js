/**
 * Phase 0 — resolve player slug via Postgres (futurecast.players) when DATABASE_URL is set.
 */
async function tryPostgresPlayerBySlug(slug) {
  const normalized = String(slug || "").trim().toLowerCase();
  if (!normalized || !/^[a-z0-9-]+$/.test(normalized)) return null;
  if (!process.env.DATABASE_URL) return null;

  try {
    require("tsx/cjs");
    const { getPlayerBySlug } = require("../models/player");
    const player = await getPlayerBySlug(normalized);
    if (!player) return null;
    return { source: "postgres", player };
  } catch {
    return null;
  }
}

module.exports = { tryPostgresPlayerBySlug };