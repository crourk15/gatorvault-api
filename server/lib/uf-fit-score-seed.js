/**
 * Derive UF Fit sub-scores from target board, recruiting store, and MODEL predictions.
 * Feeds api/uf-fit/engine.ts computeUfFitIntel for persisted uf_specific_profiles.
 */
const { computeUfFitIntel } = require("../api/uf-fit/engine.ts");

function clamp100(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, Math.round(n)));
}

function toPercent(value) {
  if (value == null || !Number.isFinite(Number(value))) return 0;
  const n = Number(value);
  if (n <= 0) return 0;
  return n <= 1 ? Math.round(n * 100) : Math.round(n);
}

function ratingToAthleticScore(rating, stars) {
  if (rating != null && Number.isFinite(Number(rating))) {
    const r = Number(rating);
    if (r > 0 && r <= 1) return clamp100(r * 100);
    if (r <= 100) return clamp100(r);
    return clamp100((r / 100) * 95);
  }
  const s = Number(stars) || 0;
  if (s >= 5) return 92;
  if (s >= 4) return 78;
  if (s >= 3) return 62;
  return 48;
}

function timelineScoreForClassYear(classYear) {
  if (classYear === 2027) return 82;
  if (classYear === 2028) return 68;
  if (classYear === 2026) return 55;
  if (classYear === 2029) return 60;
  return 50;
}

function resolveUfStatus({ headliner, natlRank, modelPct }) {
  if (modelPct >= 70 || headliner || (natlRank != null && natlRank <= 120)) return "PRIORITY";
  if (modelPct >= 40 || (natlRank != null && natlRank <= 250)) return "TARGET";
  return "EVAL";
}

function buildUfFitSeedProfile({
  playerId,
  slug,
  classYear,
  state,
  targetSeed = null,
  recruiting = null,
  modelPred = null,
}) {
  const stars = targetSeed?.stars ?? recruiting?.stars ?? null;
  const rating = targetSeed?.rating ?? recruiting?.rating ?? recruiting?.composite_rating ?? null;
  const natlRank = targetSeed?.natlRank ?? recruiting?.natlRank ?? recruiting?.ranking_national ?? null;
  const headliner = Boolean(targetSeed?.headliner);
  const inFlorida =
    String(state || targetSeed?.state || recruiting?.state || "").toUpperCase() === "FL" ||
    Boolean(targetSeed?.inState);

  const modelPct = toPercent(modelPred?.confidence ?? modelPred?.ufProbability);
  const storePct = toPercent(
    targetSeed?.ufProbability ??
      recruiting?.ufProbability ??
      recruiting?.futurecastProbability
  );
  const ufCommitProbability = modelPct || storePct || null;

  const scheme_score = clamp100(modelPct || storePct || ratingToAthleticScore(rating, stars) - 8);
  const athletic_score = ratingToAthleticScore(rating, stars);
  const character_score = clamp100(56 + (headliner ? 14 : 0) + (inFlorida ? 8 : 0));
  const timeline_score = timelineScoreForClassYear(classYear);
  const uf_status = resolveUfStatus({ headliner, natlRank, modelPct: ufCommitProbability || 0 });

  const notes =
    targetSeed?.skinny ||
    recruiting?.skinny ||
    recruiting?.recruitingNotes ||
    null;

  const intel = computeUfFitIntel({
    id: playerId,
    uf_fit_score_stored: null,
    scheme_score,
    character_score,
    athletic_score,
    timeline_score,
    uf_status,
    evaluation_notes: typeof notes === "string" ? notes : null,
    score_computed_at: null,
    metadata: {
      seedSource: "uf-fit-score-seed-v1",
      slug,
      modelPct: modelPct || null,
      storePct: storePct || null,
    },
    signals: [],
  });

  return {
    player_id: playerId,
    scheme_score,
    character_score,
    athletic_score,
    timeline_score,
    uf_status,
    uf_commit_probability: ufCommitProbability,
    uf_fit_score: intel.ufFitScore,
    evaluation_notes: typeof notes === "string" ? notes.slice(0, 500) : null,
    score_computed_at: new Date().toISOString(),
    tags: headliner ? ["headliner"] : [],
    metadata: {
      seedSource: "uf-fit-score-seed-v1",
      fitTier: intel.fitTier,
      fitDelta: intel.fitDelta,
      slug,
    },
  };
}

module.exports = {
  buildUfFitSeedProfile,
  clamp100,
};
