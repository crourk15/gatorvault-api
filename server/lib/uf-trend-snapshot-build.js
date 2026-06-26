/**
 * Resolve allowlist target UF % for daily trend snapshots.
 */
const fs = require("fs");
const path = require("path");
const { resolveUfProbability, loadUfPctPredictorsBySlug, loadOn3RpmPriorBySlug } = require("./uf-probability-utils");

const BOARD_PATH = path.join(__dirname, "..", "data", "recruiting", "2027-target-board.json");

function loadTargetBoard() {
  try {
    const doc = JSON.parse(fs.readFileSync(BOARD_PATH, "utf8"));
    return doc.targets || [];
  } catch {
    return [];
  }
}

function normalizeUuid(id) {
  if (!id || typeof id !== "string") return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
    ? id
    : null;
}

function resolveTargetUfPct(target, recruiting, predictorsBySlug) {
  const slug = String(target.slug || "").toLowerCase();
  const predictors = predictorsBySlug.get(slug) || [];
  const resolved = resolveUfProbability({
    modelPct: 0,
    storePct: target.ufProbability ?? recruiting?.ufProbability ?? recruiting?.futurecastProbability,
    predictors,
    stars: target.stars ?? recruiting?.stars ?? null,
    headliner: Boolean(target.headliner),
  });
  return resolved.value > 0 ? resolved.value : null;
}

function resolvePriorUfPct(slug, recruiting, futurecastRow, on3PriorBySlug) {
  const on3Prior = on3PriorBySlug?.get(String(slug || "").toLowerCase());
  if (on3Prior != null && Number.isFinite(Number(on3Prior))) {
    const n = Number(on3Prior);
    return n <= 1 ? Math.round(n * 100) : Math.round(n);
  }
  const prior = futurecastRow?.priorConfidence ?? recruiting?.priorConfidence ?? null;
  if (prior == null || !Number.isFinite(Number(prior))) return null;
  const n = Number(prior);
  return n <= 1 ? Math.round(n * 100) : Math.round(n);
}

async function loadTargetSnapshots() {
  const targets = loadTargetBoard();
  const recruitingStore = require("./recruiting-store");
  const futurecastStore = require("./futurecast-store");
  const predictorsBySlug = loadUfPctPredictorsBySlug();
  const on3PriorBySlug = loadOn3RpmPriorBySlug();
  const rows = [];

  for (const target of targets) {
    const slug = String(target.slug || "").toLowerCase();
    if (!slug) continue;
    const recruiting = recruitingStore.findBySlug(slug);
    const futurecastRow = futurecastStore.getByPlayerId(slug);
    const ufPct = resolveTargetUfPct(target, recruiting, predictorsBySlug);
    if (ufPct == null) continue;
    rows.push({
      slug,
      name: target.name || slug,
      ufPct,
      playerId: normalizeUuid(recruiting?.id),
      priorUfPct: resolvePriorUfPct(slug, recruiting, futurecastRow, on3PriorBySlug),
    });
  }

  return rows;
}

module.exports = {
  loadTargetBoard,
  loadTargetSnapshots,
  resolveTargetUfPct,
};