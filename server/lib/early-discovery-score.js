const SIGNAL_WEIGHTS = {
  OFFER: 10,
  RANKING_JUMP: 15,
  CAMP_PERFORMANCE: 20,
  EVALUATION_NOTE: 10,
  SOCIAL_MOMENTUM: 5,
  PORTAL_ACTIVITY: 25,
  STAFF_FLAG: 30,
  OTHER: 5,
};

function clamp100(n) {
  return Math.min(100, Math.max(0, Math.round(Number(n) || 0)));
}

function starsBoost(stars) {
  const s = Number(stars) || 0;
  if (s >= 5) return 18;
  if (s >= 4) return 12;
  if (s >= 3) return 6;
  return 0;
}

function ratingBoost(rating) {
  if (rating == null || !Number.isFinite(Number(rating))) return 0;
  const r = Number(rating);
  if (r <= 1) return clamp100(r * 40);
  if (r <= 100) return clamp100((r - 70) * 1.2);
  return clamp100(r / 100);
}

function aggregateSignalScore(signalTypes) {
  let total = 0;
  for (const type of signalTypes || []) {
    total += SIGNAL_WEIGHTS[String(type).toUpperCase()] || SIGNAL_WEIGHTS.OTHER;
  }
  return Math.min(55, total);
}

function computeDiscoveryScore({ signalTypes = [], stars = null, rating = null, inFlorida = false }) {
  const base = 28 + aggregateSignalScore(signalTypes) + starsBoost(stars) + ratingBoost(rating);
  const geo = inFlorida ? 8 : 0;
  return clamp100(base + geo);
}

module.exports = {
  SIGNAL_WEIGHTS,
  computeDiscoveryScore,
  clamp100,
};