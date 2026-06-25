/**
 * Flip Watch score stack — UF % + rival commit + verified OV recency + beat sentiment.
 */
const { deriveIntelConfidence } = require("./recruiting-hub-scoring");

const MAJOR_RIVALS = [
  /\bgeorgia\b|\bbulldogs\b/i,
  /\balabama\b|\bcrimson tide\b/i,
  /\bflorida state\b|\bseminoles\b/i,
  /\blsu\b|\btigers\b/i,
  /\bmiami\b|\bhurricanes\b/i,
  /\btennessee\b|\bvols\b/i,
  /\bauburn\b/i,
  /\bole miss\b|\brebels\b/i,
  /\btexas\b|\blonghorns\b/i,
  /\bohio state\b|\bbuckeyes\b/i,
  /\bclemson\b/i,
  /\boklahoma\b|\bsooners\b/i,
];

const P4_OTHER = /\b(michigan|penn state|usc|ucla|notre dame|oregon|washington|fsu)\b/i;

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function parseUfPct(raw) {
  if (raw == null || !Number.isFinite(Number(raw))) return 0;
  const num = Number(raw);
  return clamp(Math.round(num <= 1 ? num * 100 : num), 0, 100);
}

function rivalCommitScore(committedTo) {
  const school = String(committedTo || "").trim();
  if (!school) return 40;
  for (const re of MAJOR_RIVALS) {
    if (re.test(school)) return 100;
  }
  if (P4_OTHER.test(school)) return 75;
  return 55;
}

function visitRecencyScore(visitEnd, asOf = new Date()) {
  const end = String(visitEnd || "").slice(0, 10);
  if (!end) return 50;
  const endMs = new Date(`${end}T12:00:00Z`).getTime();
  const nowMs = asOf instanceof Date ? asOf.getTime() : new Date(asOf).getTime();
  if (!Number.isFinite(endMs) || !Number.isFinite(nowMs)) return 50;
  const days = Math.max(0, Math.round((nowMs - endMs) / 86400000));
  if (days <= 14) return 100;
  if (days <= 45) return 85;
  if (days <= 90) return 70;
  if (days <= 180) return 55;
  return 40;
}

function beatSentimentScore(intelRows, slug) {
  const key = String(slug || "").toLowerCase();
  const rows = (intelRows || []).filter(
    (r) => String(r.playerSlug || r.player_slug || "").toLowerCase() === key
  );
  if (!rows.length) return 50;
  const confidence = deriveIntelConfidence({ slug }, rows);
  return clamp(Math.round(confidence * 100), 0, 100);
}

function flipScoreLabel(score) {
  if (score >= 80) return "Hot";
  if (score >= 60) return "Warm";
  if (score >= 40) return "Watch";
  return "Low";
}

function computeFlipWatchScore(row, { intelRows = [], asOf = new Date() } = {}) {
  const uf = parseUfPct(row.ufProbability);
  const visit = visitRecencyScore(row.visitEnd, asOf);
  const rival = rivalCommitScore(row.committedTo);
  const beat = beatSentimentScore(intelRows, row.slug);

  const stack = {
    uf,
    visit,
    rival,
    beat,
  };

  const score = clamp(
    Math.round(uf * 0.4 + visit * 0.25 + rival * 0.15 + beat * 0.2),
    0,
    100
  );

  return {
    flipScore: score,
    flipScoreLabel: flipScoreLabel(score),
    flipScoreStack: stack,
  };
}

module.exports = {
  computeFlipWatchScore,
  flipScoreLabel,
  rivalCommitScore,
  visitRecencyScore,
  beatSentimentScore,
};