/**
 * Desk Portal Buy score — rank who actually fills a hole.
 * Not HS Chase. Not "who might enter." Fan names still require the gap-fill gate.
 *
 * Production has two paths:
 *   P4 starter snaps → year1Starter
 *   FCS / G5 high production + good PFF → nonPowerProduction
 * Those do not stack. Missing PFF on a non-P4 body is not a buy.
 */

const ROOM_WEIGHT = {
  'must-add': 32,
  high: 22,
  conditional: 12,
  watch: 10,
  stable: 0,
  hold: 0,
};

const P4_CONFERENCES = new Set([
  'sec',
  'big ten',
  'big 10',
  'b1g',
  'acc',
  'big 12',
  'big twelve',
]);

const G5_CONFERENCES = new Set([
  'aac',
  'american',
  'american athletic',
  'mountain west',
  'mwc',
  'mac',
  'mid-american',
  'sun belt',
  'conference usa',
  'c-usa',
  'cusa',
]);

const P4_INDEPENDENTS = new Set(['notre dame']);

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function norm(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function snapPct(player) {
  const raw = num(
    player?.snapPct ?? player?.snap_pct ?? player?.snapShare ?? player?.snaps
  );
  if (raw == null) return null;
  return raw > 1 ? raw / 100 : raw;
}

function pffGrade(player) {
  const raw = num(
    player?.pffGrade ??
      player?.pff_grade ??
      player?.pffOverall ??
      player?.pff_overall ??
      player?.pff
  );
  if (raw == null) return null;
  return clamp(raw, 0, 100);
}

function starts(player) {
  const n = num(player?.starts ?? player?.gamesStarted ?? player?.games_started);
  return n != null && n >= 0 ? n : null;
}

function yearsLeft(player) {
  const n = num(player?.yearsLeft ?? player?.years_left ?? player?.elig ?? player?.eligibility);
  return n != null && n >= 0 ? n : null;
}

function conferenceTier(player) {
  const explicit = norm(player?.conferenceTier ?? player?.level ?? player?.subdivision);
  if (explicit === 'p4' || explicit === 'power 4' || explicit === 'power four' || explicit === 'fbs p4') {
    return 'p4';
  }
  if (explicit === 'g5' || explicit === 'group of 5' || explicit === 'group of five' || explicit === 'fbs g5') {
    return 'g5';
  }
  if (explicit === 'fcs') return 'fcs';

  const conf = norm(player?.conference ?? player?.conf);
  if (P4_CONFERENCES.has(conf) || P4_INDEPENDENTS.has(conf)) return 'p4';
  if (G5_CONFERENCES.has(conf)) return 'g5';

  const school = norm(player?.fromSchool ?? player?.previousSchool ?? player?.school ?? player?.college);
  if (P4_INDEPENDENTS.has(school)) return 'p4';

  if (explicit === 'fbs' || conf) {
    // Named FBS conference we don't list as P4 → treat as non-power.
    if (/\bfcs\b/.test(conf) || /\bfcs\b/.test(explicit)) return 'fcs';
    if (conf) return 'g5';
  }
  if (/\bfcs\b/.test(conf) || /\bfcs\b/.test(school)) return 'fcs';
  return 'unknown';
}

function isNonPower(tier) {
  return tier === 'g5' || tier === 'fcs';
}

function hasHighProduction(player) {
  if (norm(player?.production) === 'high') return true;
  const snap = snapPct(player);
  if (snap != null && snap >= 0.7) return true;
  const startCount = starts(player);
  if (startCount != null && startCount >= 8) return true;
  return false;
}

function p4StarterPoints(player) {
  const snap = snapPct(player);
  const startCount = starts(player);
  const depth = num(player?.depthRank ?? player?.depth);
  if (depth === 1 || (startCount != null && startCount >= 8) || (snap != null && snap >= 0.7)) {
    return 25;
  }
  if (depth === 2 || (startCount != null && startCount >= 4) || (snap != null && snap >= 0.4)) {
    return 12;
  }
  return 0;
}

/**
 * FCS / G5: high production AND a good PFF grade.
 * No PFF → 0. Good PFF without volume → 0.
 */
function nonPowerProductionPoints(player, tier) {
  if (!isNonPower(tier)) return 0;
  if (!hasHighProduction(player)) return 0;
  const grade = pffGrade(player);
  if (grade == null) return 0;
  if (grade >= 85) return 24;
  if (grade >= 80) return 20;
  if (grade >= 75) return 14;
  return 0;
}

function yearsLeftPoints(left) {
  if (left == null) return 0;
  if (left >= 2) return 10;
  if (left >= 1) return 4;
  return 0;
}

function schemeFitPoints(player) {
  const raw = num(player?.schemeFit ?? player?.scheme_score ?? player?.schemeScore);
  if (raw == null) return 0;
  let score;
  if (raw <= 1) score = raw * 15;
  else if (raw <= 15) score = raw;
  else score = (raw / 100) * 15;
  return clamp(Math.round(score * 10) / 10, 0, 15);
}

function floridaProcessPoints(player) {
  let pts = 0;
  if (player?.floridaOffer || player?.flOffer) pts += 4;
  if (player?.floridaVisit || player?.ufVisit) pts += 3;
  if (player?.staffFlag || player?.ufStatus === 'TARGET' || player?.ufStatus === 'PRIORITY') pts += 4;
  if (player?.beatLink) pts += 3;
  return Math.min(10, pts);
}

function budgetTax(player, room) {
  const pos = String(player?.position || player?.pos || room || '').toUpperCase();
  if (pos === 'QB') return 8;
  return 0;
}

function depthBodyPenalty(productionPts, player, tier) {
  if (productionPts > 0) return 0;
  const grade = pffGrade(player);
  if (isNonPower(tier) && hasHighProduction(player) && grade == null) return 8;
  if (productionPts === 0) return 12;
  return 0;
}

function roomWeight(tier) {
  return ROOM_WEIGHT[String(tier || '').toLowerCase()] ?? 0;
}

function computePortalBuyScore(player = {}, opts = {}) {
  const tier = String(opts.roomTier || player.roomTier || 'watch').toLowerCase();
  const room = opts.room || player.room || player.position;
  const conf = conferenceTier(player);
  const p4Pts = conf === 'p4' ? p4StarterPoints(player) : 0;
  const nonPowerPts = nonPowerProductionPoints(player, conf);
  const productionPts = Math.max(p4Pts, nonPowerPts);
  const productionPath =
    nonPowerPts > p4Pts ? 'fcs-g5-pff' : p4Pts > 0 ? 'p4-starter' : 'none';

  const pts = {
    roomWeight: roomWeight(tier),
    year1Starter: p4Pts,
    nonPowerProduction: nonPowerPts,
    yearsLeft: yearsLeftPoints(yearsLeft(player)),
    schemeFit: schemeFitPoints(player),
    floridaProcess: floridaProcessPoints(player),
    budgetTax: budgetTax(player, room),
    depthBody: depthBodyPenalty(productionPts, player, conf),
  };

  const buyScore =
    Math.round(
      (pts.roomWeight +
        productionPts +
        pts.yearsLeft +
        pts.schemeFit +
        pts.floridaProcess -
        pts.budgetTax -
        pts.depthBody) *
        10
    ) / 10;

  return {
    buyScore,
    conferenceTier: conf,
    productionPath,
    pffGrade: pffGrade(player),
    highProduction: hasHighProduction(player),
    pts,
  };
}

module.exports = {
  ROOM_WEIGHT,
  computePortalBuyScore,
  conferenceTier,
  hasHighProduction,
  pffGrade,
  nonPowerProductionPoints,
};
