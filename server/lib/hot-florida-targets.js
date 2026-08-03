/**
 * Hottest Florida Targets — composite board rank.
 *
 * Staff chase (who UF is investing in) × must-get fit (who we should want)
 * × roster need. Campus UV count is NOT a heat proxy — locals stack trips.
 *
 * Hierarchy (best way to track hottest targets):
 *  1. Staff heat     — offer, home visits, staff assign, PRIORITY, pursuit intel
 *  2. Must-get fit   — physical upside, football IQ / film, vault / War Room
 *  3. Positional need — trenches, pass rush, multi-LB, CB (roster gaps)
 *  4. Geo pipeline   — Florida in-state access (relationship edge, not UV stacks)
 *  5. Market pressure — RPM velocity / competitor escalation (modifier only)
 *
 * Charles / War Room "must-get" notes and PRIORITY status sit on top of public crumbs.
 */
'use strict';

const { buildChaseFeatureIndex, computeChaseScore } = require('./uf-chase-score');

/** Cycle need weights — pass rush, trenches, multi-LB (editorial, not UV noise). */
const POSITION_NEED_WEIGHT = {
  EDGE: 1,
  DE: 0.95,
  DL: 0.88,
  DT: 0.82,
  OT: 0.95,
  OL: 0.88,
  IOL: 0.85,
  OG: 0.82,
  C: 0.8,
  LB: 0.9,
  ILB: 0.85,
  OLB: 0.9,
  CB: 0.88,
  S: 0.72,
  WR: 0.62,
  TE: 0.7,
  RB: 0.55,
  QB: 0.75,
  ATH: 0.55,
  K: 0.2,
  P: 0.2,
};

const PHYSICAL_TRAIT_RE =
  /\b(?:length|frame|rare frame|twitch|bend|burst|functional strength|explosive|upside|prototype|SEC[- ]ready|6[-'′]?\s*5|long lever)\b/i;

const IQ_TRAIT_RE =
  /\b(?:football IQ|high IQ|IQ|field vision|instincts?|processing|quick decisions?|diagnosis|leader(?:ship)?|captain|vocal|chess)\b/i;

function slugKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function normalizePos(pos) {
  return String(pos || '')
    .trim()
    .toUpperCase();
}

function parseHeightInches(player) {
  const raw = String(player?.htWt || player?.height || '').trim();
  const m = raw.match(/(\d)\s*[-'′]\s*(\d{1,2}(?:\.\d+)?)/);
  if (!m) return null;
  const feet = Number(m[1]);
  const inches = Number(m[2]);
  if (!Number.isFinite(feet) || !Number.isFinite(inches)) return null;
  return feet * 12 + inches;
}

function isFloridaGeo(player) {
  if (player?.inState === true) return true;
  const st = String(player?.hometownState || player?.state || '').toUpperCase();
  return st === 'FL' || st === 'FLORIDA';
}

function traitBlob(player, warRoom, film) {
  const parts = [
    ...(Array.isArray(warRoom?.strengths) ? warRoom.strengths : []),
    warRoom?.comparison,
    warRoom?.projection,
    warRoom?.schemeFit,
    warRoom?.insiderNotes,
    warRoom?.scoutingSummary,
    ...(Array.isArray(film?.traits) ? film.traits : []),
    film?.vaultFilmAngle,
    player?.skinny,
    player?.profileNote,
    player?.evaluation_notes || player?.evaluationNotes,
  ];
  return parts.filter(Boolean).join(' · ');
}

/**
 * Physical upside 0–100: frame + rating/vault + trait language.
 * Does not use visit count.
 */
function scorePhysicalUpside(player, warRoom, film) {
  let pts = 0;
  const rating = Number(player?.vaultGrade ?? player?.displayRating ?? player?.rating);
  if (Number.isFinite(rating)) {
    if (rating >= 94) pts += 40;
    else if (rating >= 90) pts += 32;
    else if (rating >= 86) pts += 22;
    else if (rating >= 80) pts += 12;
  }
  const stars = Number(player?.stars) || 0;
  if (stars >= 5) pts += 18;
  else if (stars >= 4) pts += 12;
  else if (stars >= 3) pts += 5;

  const natl = Number(player?.natlRank);
  if (Number.isFinite(natl) && natl > 0) {
    if (natl <= 50) pts += 16;
    else if (natl <= 150) pts += 10;
    else if (natl <= 300) pts += 5;
  }

  const pos = normalizePos(player?.pos || player?.position);
  const inches = parseHeightInches(player);
  if (inches != null) {
    if ((pos === 'OT' || pos === 'OL' || pos === 'IOL') && inches >= 77) pts += 14;
    else if ((pos === 'EDGE' || pos === 'DE' || pos === 'DL') && inches >= 75) pts += 12;
    else if ((pos === 'CB' || pos === 'WR' || pos === 'S') && inches >= 72) pts += 8;
  }

  const blob = traitBlob(player, warRoom, film);
  if (PHYSICAL_TRAIT_RE.test(blob)) pts += 12;
  if (warRoom?.comparison || warRoom?.projection) pts += 6;

  return Math.min(100, pts);
}

/** Football IQ / processing / leadership from film + War Room text. */
function scoreFootballIq(player, warRoom, film) {
  let pts = 0;
  const blob = traitBlob(player, warRoom, film);
  if (!blob) return 0;
  if (IQ_TRAIT_RE.test(blob)) pts += 55;
  const hits = (blob.match(IQ_TRAIT_RE) || []).length;
  if (hits >= 2) pts += 20;
  if (/\bleader(?:ship)?\b|\bcaptain\b/i.test(blob)) pts += 15;
  if (Array.isArray(film?.traits) && film.traits.length >= 3) pts += 10;
  return Math.min(100, pts);
}

/** Must-get fit = physical + IQ (+ light vault presence). */
function scoreMustGetFit(player, warRoom, film) {
  const physical = scorePhysicalUpside(player, warRoom, film);
  const iq = scoreFootballIq(player, warRoom, film);
  return Math.round(physical * 0.7 + iq * 0.3);
}

/** Positional need 0–100 from cycle weights (+ optional roster density later). */
function scorePositionalNeed(player, needWeights = POSITION_NEED_WEIGHT) {
  const pos = normalizePos(player?.pos || player?.position);
  const w = needWeights[pos];
  if (w == null) return 40;
  return Math.round(w * 100);
}

/**
 * In-state pipeline advantage — access / relationship edge.
 * Explicitly NOT a reward for stacking Gainesville UVs.
 */
function scoreGeoPipeline(player) {
  if (!isFloridaGeo(player)) return 15;
  let pts = 70;
  const rating = Number(player?.vaultGrade ?? player?.rating);
  const stars = Number(player?.stars) || 0;
  if ((Number.isFinite(rating) && rating >= 88) || stars >= 4) pts += 25;
  else if (stars >= 3) pts += 10;
  return Math.min(100, pts);
}

/**
 * Market pressure = movement OR locked-in UF market standing.
 * A 97% On3 RPM board (Cyion Smith) must not score 0 just because delta7d is flat.
 */
function scoreMarketPressure(delta7d, ufMarketPct = null) {
  const d = Number(delta7d) || 0;
  let fromDelta = 0;
  if (d >= 12) fromDelta = 100;
  else if (d >= 8) fromDelta = 75;
  else if (d >= 5) fromDelta = 55;
  else if (d >= 2) fromDelta = 35;
  else if (d > 0) fromDelta = 20;

  const rpm = Number(ufMarketPct);
  let fromRpm = 0;
  if (Number.isFinite(rpm) && rpm > 0) {
    if (rpm >= 90) fromRpm = 95;
    else if (rpm >= 75) fromRpm = 80;
    else if (rpm >= 50) fromRpm = 55;
    else if (rpm >= 30) fromRpm = 30;
    else if (rpm >= 15) fromRpm = 15;
  }
  return Math.max(fromDelta, fromRpm);
}

/** Normalize chase score onto 0–100 for blending. */
function normalizeStaffHeat(chaseScore) {
  const n = Number(chaseScore) || 0;
  return Math.min(100, Math.round((n / 80) * 100));
}

/**
 * @param {object} player — recruiting / HP card fields
 * @param {object} opts
 */
function computeHotTargetScore(player, opts = {}) {
  const chaseIndex =
    opts.chaseIndex || buildChaseFeatureIndex({ classYear: Number(player.classYear) || 2028 });
  const chase = computeChaseScore(
    {
      slug: player.slug || player.id,
      ufFitScore: player.fitScore ?? player.ufFitScore,
      uf_status: player.uf_status || player.ufStatus || null,
      evaluation_notes: player.evaluation_notes || player.evaluationNotes || null,
      signals: Array.isArray(player.signals) ? player.signals : [],
      ufOvStatus: player.ufOvStatus || player.uf_ov_status || null,
    },
    chaseIndex
  );

  let warRoom = opts.warRoom;
  let film = opts.film;
  if (warRoom === undefined || film === undefined) {
    const slug = slugKey(player.slug || player.id);
    if (warRoom === undefined) {
      try {
        warRoom = require('./war-room-store').getBreakdownBySlug(slug);
      } catch {
        warRoom = null;
      }
    }
    if (film === undefined) {
      try {
        film = require('./film-traits-store').getFilmTraitsBySlug(slug);
      } catch {
        film = null;
      }
    }
  }

  const staffHeat = normalizeStaffHeat(chase.chaseScore);
  const mustGetFit = scoreMustGetFit(player, warRoom, film);
  const positionalNeed = scorePositionalNeed(player);
  const geoPipeline = scoreGeoPipeline(player);
  const ufMarketPct =
    opts.ufRpmPct ??
    player.ufRpmPct ??
    player.ufProbability ??
    player.ufConfidence ??
    null;
  const marketPressure = scoreMarketPressure(opts.delta7d ?? player.delta7d, ufMarketPct);

  const hotScore =
    Math.round(
      (staffHeat * 0.42 +
        mustGetFit * 0.28 +
        positionalNeed * 0.18 +
        geoPipeline * 0.07 +
        marketPressure * 0.05) *
        10
    ) / 10;

  const quietChase =
    staffHeat >= 45 &&
    mustGetFit >= 35 &&
    (chase.chase?.intel || 0) <= 1 &&
    !(chase.chase?.pursuit > 0);

  return {
    hotScore,
    chaseScore: chase.chaseScore,
    chase: chase.chase,
    lanes: {
      staffHeat,
      mustGetFit,
      positionalNeed,
      geoPipeline,
      marketPressure,
    },
    badges: {
      quietChase,
      inState: isFloridaGeo(player),
      homeVisit: (chase.chase?.home || 0) > 0,
      staffAssigned: !!(chase.chase?.hasStaffLead || chase.chase?.hasSecondaryRecruiter),
    },
  };
}

function enrichPlayerForHotScore(player) {
  const slug = slugKey(player?.slug || player?.id);
  if (!slug) return player || {};
  try {
    const store = require('./recruiting-store');
    const local = typeof store.findBySlug === 'function' ? store.findBySlug(slug) : null;
    if (!local) return { ...player, pos: player.pos || player.position };
    return {
      ...local,
      ...player,
      // Prefer card movement/status; keep identity/fit fields from recruiting record when thin.
      pos: player.pos || player.position || local.pos,
      position: player.position || player.pos || local.pos,
      stars: player.stars ?? local.stars,
      rating: player.rating ?? local.rating ?? local.displayRating,
      vaultGrade: player.vaultGrade ?? local.vaultGrade,
      natlRank: player.natlRank ?? local.natlRank,
      htWt: player.htWt || local.htWt,
      height: player.height || local.height,
      inState: player.inState ?? local.inState,
      state: player.state || local.state,
      hometownState: player.hometownState || local.hometownState,
      skinny: player.skinny || local.skinny,
      profileNote: player.profileNote || local.profileNote,
      classYear: player.classYear ?? local.classYear,
    };
  } catch {
    return { ...player, pos: player.pos || player.position };
  }
}

function scoreHotTargetBoard(players, opts = {}) {
  const classYear = Number(opts.classYear) || 2028;
  const chaseIndex = buildChaseFeatureIndex({ classYear });
  return (players || []).map((p) => {
    const enriched = enrichPlayerForHotScore(p);
    const hot = computeHotTargetScore(enriched, { chaseIndex, delta7d: p.delta7d });
    return {
      ...p,
      hotScore: hot.hotScore,
      chaseScore: hot.chaseScore,
      chase: hot.chase,
      hotLanes: hot.lanes,
      hotBadges: hot.badges,
      priorityScore: hot.hotScore,
    };
  });
}

module.exports = {
  POSITION_NEED_WEIGHT,
  computeHotTargetScore,
  scoreHotTargetBoard,
  scorePhysicalUpside,
  scoreFootballIq,
  scoreMustGetFit,
  scorePositionalNeed,
  scoreGeoPipeline,
  scoreMarketPressure,
  normalizeStaffHeat,
  isFloridaGeo,
};
