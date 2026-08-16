/**
 * UF probability truth chain — model → store → Rivals PM → labeled estimate.
 */
const fs = require('node:fs');
const path = require('node:path');

/** Max week-over-week Δ shown without a confirmed On3 RPM anchor. */
const MAX_WEEK_DELTA_WITHOUT_RPM = 15;
/** Absolute ceiling for any public week-over-week Δ (percentage points). */
const MAX_WEEK_DELTA_HARD = 35;

/**
 * Normalize a value that may be percentage points OR a 0–1 fraction.
 * @param {unknown} value
 * @param {{ allowUnitInterval?: boolean }} [opts]
 * @returns {number|null} integer 1–100, or null
 */
function normalizeOddsPct(value, { allowUnitInterval = false } = {}) {
  if (value == null || !Number.isFinite(Number(value))) return null;
  const n = Number(value);
  if (n <= 0) return null;
  if (n > 100) return 100;
  if (n > 1) return Math.round(n);
  if (!allowUnitInterval) return null;
  return Math.round(n * 100);
}

/**
 * On3 / market RPM must be percentage points (1–100).
 * Rejects residual unit-interval leftovers (0.99, 0.6887) that used to become 99%/69%.
 * Accepts 1 as one percent (Industry Consensus micro) — never ×100 into 100%.
 */
function sanitizeRpmPct(value) {
  if (value == null || !Number.isFinite(Number(value))) return null;
  const n = Number(value);
  if (n <= 0) return null;
  if (n > 100) return 100;
  // (0, 1): residual fraction on percent-scale boards — not 36%/99%.
  if (n < 1) return null;
  return Math.round(n);
}

/**
 * Store/model odds may still be 0–1 fractions in legacy rows.
 * Extreme unit-interval values (>=85%) without a strong RPM are treated as residual leaks.
 */
function sanitizeStoreOddsPct(value, { rpmPct = null } = {}) {
  if (value == null || !Number.isFinite(Number(value))) return null;
  const raw = Number(value);
  const rpm = sanitizeRpmPct(rpmPct);
  const n = normalizeOddsPct(raw, { allowUnitInterval: true });
  if (n == null) return null;
  if (raw > 0 && raw <= 1 && n >= 85 && !(rpm != null && rpm >= 50)) {
    return null;
  }
  return n;
}

/**
 * Legacy helper — percentage points, with unit-interval expand for store fractions.
 * Prefer sanitizeRpmPct / sanitizeStoreOddsPct at trust boundaries.
 */
function toPercent(value) {
  const n = normalizeOddsPct(value, { allowUnitInterval: true });
  return n == null ? 0 : n;
}

/**
 * Whether a week Δ is safe to show fans on Discovery Movement / Lab.
 * Suppresses seed theater (±4), residual jumps, and thin-data fireworks.
 */
function canExposeWeekDelta({
  delta,
  rpmPct = null,
  lowConfidence = false,
  snapshotPointCount = null,
} = {}) {
  if (delta == null || !Number.isFinite(Number(delta))) return false;
  const abs = Math.abs(Number(delta));
  if (abs < 1) return false;
  if (snapshotPointCount != null && snapshotPointCount < 2) return false;
  if (abs > MAX_WEEK_DELTA_HARD) return false;
  const rpm = sanitizeRpmPct(rpmPct);
  const thin = Boolean(lowConfidence) || rpm == null;
  if (thin && abs > MAX_WEEK_DELTA_WITHOUT_RPM) return false;
  // Legacy allowlist_seed used synchronized ±4 placeholders.
  if (thin && abs === 4) return false;
  return true;
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
      return sanitizeRpmPct(p.score) || 0;
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
 * True when On3 topTeams corroborate a dominant Florida RPM (percent-scale board).
 * Residual poison boards (Florida 0.99 while another school leads) return null from hydrate.
 */
function corroborateOn3UfRpm(rpmPct, topTeams, classYear = 2028) {
  const rpm = sanitizeRpmPct(rpmPct);
  if (rpm == null || rpm < 95) return false;
  const teams = Array.isArray(topTeams) ? topTeams : [];
  if (!teams.length) return false;
  try {
    const hydrate = require('./on3-board-hydrate');
    const fromBoard = sanitizeRpmPct(hydrate.ufRpmFromTopTeams(teams, classYear));
    // Legitimate dominant-Florida boards land near the stored RPM (Cyion ~97).
    return fromBoard != null && fromBoard >= 80 && Math.abs(fromBoard - rpm) <= 20;
  } catch {
    return false;
  }
}

/**
 * Uncommitted 95%+ On3 is real sometimes (Cyion) and poison other times (0.99→99).
 * Never copy 97 into GV odds — compress into a "strong market favorite" band so our
 * model still owns Florida Odds while the market signal is not thrown away.
 *
 * Maps 95→58 … 100→72. Below 95 unchanged. Committed keeps full RPM.
 */
function temperExtremeUncommittedRpm(rpmPct, { committed = false } = {}) {
  const rpm = sanitizeRpmPct(rpmPct);
  if (rpm == null) return null;
  if (committed) return rpm;
  if (rpm < 95) return rpm;
  const t = Math.min(1, Math.max(0, (rpm - 95) / 5));
  return Math.round(58 + t * 14);
}

/**
 * Resolve the RPM value fed into GV likelihood for underclassmen boards.
 * - Raw On3 Market display should still use the unsanitized market % separately.
 * - Uncommitted ≥95 → tempered strong-favorite prior (involved, not adopted, not discarded).
 * - Unit-interval poison (0.99) never reaches here — sanitizeRpmPct already rejects it.
 * - topTeams corroboration is retained for callers/tests; missing topTeams on prod
 *   rows (Cyion) must not collapse Florida Odds back to Fit-only ~27.
 */
function resolveUncommittedMarketRpm({
  rpmPct = null,
  committed = false,
  topTeams = null,
  classYear = 2028,
} = {}) {
  const rpm = sanitizeRpmPct(rpmPct);
  if (rpm == null) return null;
  if (committed) return rpm;
  if (rpm < 95) return rpm;
  // Temper extreme market into GV prior — never copy 97/99, never Fit-only discard.
  // topTeams/classYear kept for call-site corroboration helpers/tests.
  void topTeams;
  void classYear;
  return temperExtremeUncommittedRpm(rpm, { committed: false });
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
  const rpm = sanitizeRpmPct(rpmPct) || 0;
  const rivals = toPercent(rivalsPct);
  const fit = toPercent(fitScore);
  let store = sanitizeStoreOddsPct(storePct, { rpmPct: rpm }) || 0;
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
  MAX_WEEK_DELTA_WITHOUT_RPM,
  MAX_WEEK_DELTA_HARD,
  normalizeOddsPct,
  sanitizeRpmPct,
  sanitizeStoreOddsPct,
  toPercent,
  canExposeWeekDelta,
  pickRivalsPmScore,
  pickOn3RpmScore,
  pickExternalPmScore,
  resolveUfProbability,
  corroborateOn3UfRpm,
  temperExtremeUncommittedRpm,
  resolveUncommittedMarketRpm,
  resolveGatorVaultLikelihood,
  formatUfProbabilityDisplay,
  isFloridaSchool,
  loadRivalsOnlyUfPctBySlug,
  loadRivalsUfPctBySlug,
  loadUfPctPredictorsBySlug,
  loadOn3RpmPriorBySlug,
};
