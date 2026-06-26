/**
 * UF probability truth chain — model → store → Rivals PM → labeled estimate.
 */
const fs = require('node:fs');
const path = require('node:path');

function toPercent(value) {
  if (value == null || Number.isNaN(Number(value))) return 0;
  const n = Number(value);
  if (n <= 0) return 0;
  return n <= 1 ? Math.round(n * 100) : Math.round(n);
}

function pickRivalsPmScore(predictors) {
  for (const p of predictors || []) {
    const name = String(p?.name || "").toLowerCase();
    if (name.includes("rivals") && Number(p.score) > 0) {
      return toPercent(p.score);
    }
  }
  return 0;
}

function pickOn3RpmScore(predictors) {
  for (const p of predictors || []) {
    const name = String(p?.name || "").toLowerCase();
    if (name.includes("on3") && Number(p.score) > 0) {
      return toPercent(p.score);
    }
  }
  return 0;
}

function pickExternalPmScore(predictors) {
  const rivals = pickRivalsPmScore(predictors);
  if (rivals > 0) return { value: rivals, source: "rivals_pm", label: "Rivals PM" };
  const on3 = pickOn3RpmScore(predictors);
  if (on3 > 0) return { value: on3, source: "on3_rpm", label: "On3 RPM" };
  return null;
}

function resolveUfProbability({
  modelPct = 0,
  storePct = 0,
  predictors = [],
  stars = null,
  headliner = false,
} = {}) {
  const model = toPercent(modelPct);
  const store = toPercent(storePct);

  if (model > 0) {
    return { value: model, source: "model", label: null, lowConfidence: false };
  }
  if (store > 0) {
    return { value: store, source: "store", label: null, lowConfidence: false };
  }
  const external = pickExternalPmScore(predictors);
  if (external) {
    return {
      value: external.value,
      source: external.source,
      label: external.label,
      lowConfidence: false,
    };
  }
  if (headliner || (stars != null && Number(stars) >= 4)) {
    return { value: 25, source: "estimate", label: "Est.", lowConfidence: true };
  }
  if (stars != null && Number(stars) >= 3) {
    return { value: 15, source: "estimate", label: "Est.", lowConfidence: true };
  }
  return { value: 0, source: "unknown", label: "Est.", lowConfidence: true };
}

function formatUfProbabilityDisplay(resolved) {
  if (!resolved || resolved.value == null) return "TBD";
  const pct = Math.round(resolved.value);
  if (resolved.label) return `${resolved.label} ${pct}%`;
  return `${pct}%`;
}

function isFloridaSchool(name) {
  return /\bflorida\b|\bgators\b/i.test(String(name || ""));
}

function loadRivalsOnlyUfPctBySlug(predictionsPath) {
  const file =
    predictionsPath ||
    path.join(__dirname, "../data/war-room/rivals-predictions.json");
  const map = new Map();
  try {
    const doc = JSON.parse(fs.readFileSync(file, "utf8"));
    for (const row of doc.predictions || []) {
      if (!isFloridaSchool(row.predictionSchool)) continue;
      const slug = String(row.playerSlug || "").toLowerCase();
      if (!slug) continue;
      const conf = Number(row.confidence) || 0;
      map.set(slug, Math.max(map.get(slug) || 0, conf));
    }
  } catch {
    /* optional */
  }
  return map;
}

function loadRivalsUfPctBySlug(predictionsPath) {
  const map = loadRivalsOnlyUfPctBySlug(predictionsPath);
  try {
    const on3Path = path.join(__dirname, "../data/war-room/on3-rpm-allowlist.json");
    const doc = JSON.parse(fs.readFileSync(on3Path, "utf8"));
    for (const row of doc.entries || []) {
      const slug = String(row.playerSlug || "").toLowerCase();
      if (!slug || map.has(slug)) continue;
      const conf = Number(row.ufPct ?? row.confidence) || 0;
      if (conf > 0) map.set(slug, conf);
    }
  } catch {
    /* optional */
  }
  return map;
}

function loadUfPctPredictorsBySlug(rivalsPath, on3Path) {
  const rivals = loadRivalsOnlyUfPctBySlug(rivalsPath);
  const map = new Map();
  for (const [slug, score] of rivals) {
    map.set(slug, [{ name: "Rivals PM", score }]);
  }
  try {
    const file =
      on3Path || path.join(__dirname, "../data/war-room/on3-rpm-allowlist.json");
    const doc = JSON.parse(fs.readFileSync(file, "utf8"));
    for (const row of doc.entries || []) {
      const slug = String(row.playerSlug || "").toLowerCase();
      if (!slug || map.has(slug)) continue;
      const conf = Number(row.ufPct ?? row.confidence) || 0;
      if (conf > 0) map.set(slug, [{ name: "On3 RPM", score: conf }]);
    }
  } catch {
    /* optional */
  }
  return map;
}

function loadOn3RpmPriorBySlug(on3Path) {
  const map = new Map();
  try {
    const file =
      on3Path || path.join(__dirname, "../data/war-room/on3-rpm-allowlist.json");
    const doc = JSON.parse(fs.readFileSync(file, "utf8"));
    for (const row of doc.entries || []) {
      const slug = String(row.playerSlug || "").toLowerCase();
      if (!slug) continue;
      const prior = row.priorUfPct;
      if (prior == null || !Number.isFinite(Number(prior))) continue;
      map.set(slug, Number(prior));
    }
  } catch {
    /* optional */
  }
  return map;
}

module.exports = {
  toPercent,
  pickRivalsPmScore,
  pickOn3RpmScore,
  pickExternalPmScore,
  resolveUfProbability,
  formatUfProbabilityDisplay,
  isFloridaSchool,
  loadRivalsOnlyUfPctBySlug,
  loadRivalsUfPctBySlug,
  loadUfPctPredictorsBySlug,
  loadOn3RpmPriorBySlug,
};
