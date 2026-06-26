/**
 * Load FutureCast MODEL predictions indexed by player slug (same chain as high-priority API).
 */
require("tsx/cjs");

async function loadFuturecastPredictionBySlug(classYear = 2027) {
  const { listPredictions } = require("../models/predictions.ts");
  const {
    filterFutureCastFeedRows,
    filterModelPredictionsOnly,
    dedupeFeedRows,
  } = require("../api/futurecast/feed-filters.ts");
  const { serializeFeedRowsWithVolatility } = require("../api/predictions/utils-api.ts");

  let rows = await listPredictions({
    class_year: classYear,
    status: "ACTIVE",
    lifecycle: "HS",
    limit: 500,
  });
  rows = filterFutureCastFeedRows(filterModelPredictionsOnly(rows));
  rows = dedupeFeedRows(rows);
  const serialized = await serializeFeedRowsWithVolatility(rows);

  const map = new Map();
  for (const row of serialized) {
    const slug = String(row.playerSlug || "").trim();
    if (!slug) continue;
    map.set(slug, row);
    map.set(slug.toLowerCase(), row);
  }
  return map;
}

module.exports = { loadFuturecastPredictionBySlug };