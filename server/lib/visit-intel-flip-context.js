/**
 * Shared UF maps + flip-watch row builder for high-priority API and intel alerts.
 */
const { buildFlipWatchRows } = require("./flip-watch-utils");
const { resolveUfProbability, loadUfPctPredictorsBySlug } = require("./uf-probability-utils");

function buildResolveSlugUfMeta({
  recruitingBySlug,
  targetSeedBySlug,
  predictorsBySlug = new Map(),
  predictionBySlug = new Map(),
  predictorNames = {},
}) {
  return function resolveSlugUfMeta(slug) {
    const key = String(slug || "").toLowerCase();
    const recruiting = recruitingBySlug.get(slug) || recruitingBySlug.get(key);
    const seed = targetSeedBySlug.get(slug) || targetSeedBySlug.get(key);
    const model = predictionBySlug.get(slug) || predictionBySlug.get(key);
    const predictors = [];
    if (model?.predictorId) {
      predictors.push({
        name: predictorNames[model.predictorId] ?? model.predictorId,
        score: Math.round(Number(model.confidence) || 0),
      });
    }
    for (const ext of predictorsBySlug.get(key) || []) {
      predictors.push(ext);
    }
    return resolveUfProbability({
      modelPct: model?.confidence ?? model?.ufProbability,
      storePct:
        seed?.ufProbability ??
        recruiting?.ufProbability ??
        recruiting?.futurecastProbability,
      predictors,
      stars: seed?.stars ?? recruiting?.stars ?? null,
      headliner: Boolean(seed?.headliner),
    });
  };
}

function buildFlipWatchUfMaps({
  players,
  visitRecap,
  recruitingBySlug,
  targetSeedBySlug,
  resolveSlugUfMeta,
}) {
  const commitBySlug = new Map();
  const ufBySlug = new Map();
  const ufLabelBySlug = new Map();
  const ufLowConfidenceBySlug = new Map();
  const nameBySlug = new Map();

  const storeResolvedUf = (slug, resolved) => {
    const key = String(slug || "").toLowerCase();
    ufBySlug.set(key, resolved.value);
    ufLabelBySlug.set(key, resolved.label);
    ufLowConfidenceBySlug.set(key, resolved.lowConfidence);
  };

  for (const [slug, seed] of targetSeedBySlug.entries()) {
    const recruiting = recruitingBySlug.get(slug);
    const committedTo =
      seed?.committedTo ?? recruiting?.committedTo ?? recruiting?.commitment ?? null;
    const key = String(slug).toLowerCase();
    if (committedTo) commitBySlug.set(key, committedTo);
    if (seed?.name) nameBySlug.set(key, seed.name);
    storeResolvedUf(slug, resolveSlugUfMeta(slug));
  }

  for (const p of players || []) {
    const key = String(p.slug || "").toLowerCase();
    if (!key) continue;
    ufBySlug.set(key, p.ufProbability ?? ufBySlug.get(key) ?? null);
    ufLabelBySlug.set(key, p.ufProbabilityLabel ?? ufLabelBySlug.get(key) ?? null);
    ufLowConfidenceBySlug.set(
      key,
      p.ufProbabilityLowConfidence ?? ufLowConfidenceBySlug.get(key) ?? false
    );
    if (p.name) nameBySlug.set(key, p.name);
    if (p.committedTo) commitBySlug.set(key, p.committedTo);
  }

  for (const row of visitRecap || []) {
    const slug = String(row.slug || "");
    if (!slug) continue;
    const key = slug.toLowerCase();
    const recruiting = recruitingBySlug.get(slug) || recruitingBySlug.get(key);
    if (recruiting?.committedTo) commitBySlug.set(key, recruiting.committedTo);
    if (recruiting?.name) nameBySlug.set(key, recruiting.name);
    if (ufLabelBySlug.get(key) == null) {
      storeResolvedUf(slug, resolveSlugUfMeta(slug));
    }
  }

  return {
    commitBySlug,
    ufBySlug,
    ufLabelBySlug,
    ufLowConfidenceBySlug,
    nameBySlug,
  };
}

function buildFlipWatchWithUfContext({
  players,
  visitRecap,
  visitLogs,
  intelRows = [],
  asOf = new Date(),
  limit = 8,
  recruitingBySlug,
  targetSeedBySlug,
  predictionBySlug = new Map(),
  predictorNames = {},
}) {
  const predictorsBySlug = loadUfPctPredictorsBySlug();
  const resolveSlugUfMeta = buildResolveSlugUfMeta({
    recruitingBySlug,
    targetSeedBySlug,
    predictorsBySlug,
    predictionBySlug,
    predictorNames,
  });
  const maps = buildFlipWatchUfMaps({
    players,
    visitRecap,
    recruitingBySlug,
    targetSeedBySlug,
    resolveSlugUfMeta,
  });
  const flipWatch = buildFlipWatchRows(players, visitRecap, {
    visitLogs,
    asOf,
    limit,
    intelRows,
    ...maps,
  });
  return { flipWatch, ...maps, resolveSlugUfMeta };
}

module.exports = {
  buildResolveSlugUfMeta,
  buildFlipWatchUfMaps,
  buildFlipWatchWithUfContext,
  loadUfPctPredictorsBySlug,
};
