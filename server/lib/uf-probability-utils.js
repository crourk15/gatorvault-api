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

/**
 * GatorVault likelihood — multi-signal blend, market-anchored when On3 RPM exists.
 *
 * Fit stays in the model (scheme still matters) but cannot dominate commit odds:
 * - Market core = model + On3 RPM + Rivals + store (no Fit)
 * - Fit applies as a gated nudge that scales with how competitive UF already is on the market
 * - Final value is clamped near On3 RPM so elite Fit + tiny RPM (e.g. Cobbins) cannot invent 36%
 */
function resolveGatorVaultLikelihood({
  modelPct = 0,
  rpmPct = 0,
  rivalsPct = 0,
  fitScore = 0,
  storePct = 0,
  delta7d = 0,
  stars = null,
  headliner = false,
} = {}) {
  const model = toPercent(modelPct);
  const rpm = toPercent(rpmPct);
  const rivals = toPercent(rivalsPct);
  const fit = toPercent(fitScore);
  let store = toPercent(storePct);
  // Avoid double-counting store when it is already the On3 RPM value.
  if (store > 0 && rpm > 0 && Math.abs(store - rpm) <= 1) store = 0;

  const marketParts = [];
  if (model > 0) marketParts.push({ v: model, w: 0.35, tag: "model" });
  if (rpm > 0) marketParts.push({ v: rpm, w: 0.4, tag: "on3_rpm" });
  if (rivals > 0) marketParts.push({ v: rivals, w: 0.25, tag: "rivals_pm" });
  if (store > 0) marketParts.push({ v: store, w: 0.15, tag: "store" });

  const inputs = marketParts.map((p) => p.tag);

  if (!marketParts.length && fit <= 0) {
    return resolveUfProbability({ stars, headliner });
  }

  let marketCore = 0;
  if (marketParts.length) {
    const wSum = marketParts.reduce((sum, p) => sum + p.w, 0) || 1;
    marketCore = marketParts.reduce((sum, p) => sum + p.v * (p.w / wSum), 0);
  } else {
    // No market signals — Fit can seed a soft estimate only (thin).
    marketCore = Math.min(35, Math.round(fit * 0.35));
    inputs.push("fit");
  }

  // Fit presence: weak when UF is a long shot on RPM; full when UF is already in the hunt.
  // rpm 7 → ~0.18 · rpm 25 → ~0.55 · rpm 40+ → 1.0
  let fitNudge = 0;
  if (fit > 0 && marketParts.length) {
    const presence =
      rpm > 0
        ? Math.max(0.12, Math.min(1, rpm / 40))
        : Math.max(0.2, Math.min(1, marketCore / 40));
    // Center Fit at 50: elite scheme boosts, poor scheme softens — scaled by presence.
    fitNudge = ((fit - 50) / 50) * 14 * presence;
    inputs.push("fit");
  }

  const deltaNudge = Math.max(
    -8,
    Math.min(8, Math.round(Number(delta7d || 0) * 100 * 0.15))
  );

  let value = Math.round(marketCore + fitNudge + deltaNudge);

  // Market anchor: keep GV editorial, but never drift far from confirmed On3 UF %.
  if (rpm > 0) {
    const bullRoom = Math.round(10 + 8 * Math.min(1, rpm / 35)); // more room when UF already competitive
    const bearRoom = 12;
    const lo = Math.max(1, rpm - bearRoom);
    const hi = Math.min(99, rpm + bullRoom);
    value = Math.max(lo, Math.min(hi, value));
  } else {
    value = Math.max(1, Math.min(99, value));
  }

  const thin =
    (marketParts.length === 0 && fit > 0) ||
    (marketParts.length === 1 && marketParts[0].tag !== "model" && fit <= 0);
  const anchored = rpm > 0;
  return {
    value,
    source: "gatorvault",
    label: thin ? "GV · thin" : anchored ? "GV" : "GV",
    lowConfidence: thin,
    inputs,
    marketCore: Math.round(marketCore),
    fitNudge: Math.round(fitNudge),
    rpmAnchor: rpm > 0 ? rpm : null,
  };
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
  resolveGatorVaultLikelihood,
  formatUfProbabilityDisplay,
  isFloridaSchool,
  loadRivalsOnlyUfPctBySlug,
  loadRivalsUfPctBySlug,
  loadUfPctPredictorsBySlug,
  loadOn3RpmPriorBySlug,
};
