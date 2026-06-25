/**
 * UF probability truth chain — model → store → Rivals PM → labeled estimate.
 */
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

function resolveUfProbability({
  modelPct = 0,
  storePct = 0,
  predictors = [],
  stars = null,
  headliner = false,
} = {}) {
  const model = toPercent(modelPct);
  const store = toPercent(storePct);
  const rivals = pickRivalsPmScore(predictors);

  if (model > 0) {
    return { value: model, source: "model", label: null, lowConfidence: false };
  }
  if (store > 0) {
    return { value: store, source: "store", label: null, lowConfidence: false };
  }
  if (rivals > 0) {
    return { value: rivals, source: "rivals_pm", label: "Rivals PM", lowConfidence: false };
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

function loadRivalsUfPctBySlug(predictionsPath) {
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

module.exports = {
  toPercent,
  pickRivalsPmScore,
  resolveUfProbability,
  formatUfProbabilityDisplay,
  isFloridaSchool,
  loadRivalsUfPctBySlug,
};
