/**
 * Closest-to-commit process evidence - Florida still in it, not On3 % alone.
 *
 * Board lead (RPM / GV odds) is necessary but not sufficient. Closest stamp
 * requires structured UF process: offer, visits, and/or recent pursuit intel.
 */
const { buildChaseFeatureIndex } = require('./uf-chase-score');
const { isFloridaSchool } = require('./recruiting-target-filters');

const DAY_MS = 24 * 60 * 60 * 1000;

function slugKey(value) {
  return String(value || '').trim().toLowerCase();
}

function playerHasUfOfferFlag(player) {
  if (!player || typeof player !== 'object') return false;
  if (player.hasUFOffer === true || player.ufOffer === true || player.ufOfferVerified === true) {
    return true;
  }
  const offers = Array.isArray(player.offers) ? player.offers : [];
  return offers.some((o) => isFloridaSchool(o?.school || o?.name || o));
}

/**
 * Build per-slug process evidence for Closest / Who commits next.
 * @param {{ classYear?: number, days?: number, warmDays?: number }} [opts]
 */
function buildClosestCommitEvidenceIndex(opts = {}) {
  const classYear = Number(opts.classYear) || 2028;
  const days = Number(opts.days) || 180;
  const chase = buildChaseFeatureIndex({ classYear, days });
  const warmDays = Number(opts.warmDays) || 120;
  const warmCutoff = Date.now() - warmDays * DAY_MS;

  /** @type {Map<string, object>} */
  const bySlug = new Map();

  const slugs = new Set([
    ...chase.bySlug.keys(),
    ...chase.intelCounts.keys(),
    ...chase.allowlisted,
  ]);

  let playersBySlug = new Map();
  try {
    const store = require('./recruiting-store');
    const fs = require('fs');
    const path = require('path');
    const file = path.join(store.DATA_DIR, 'players.json');
    const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const p of Array.isArray(rows) ? rows : []) {
      const key = slugKey(p?.slug);
      if (key) playersBySlug.set(key, p);
    }
  } catch {
    playersBySlug = new Map();
  }

  for (const slug of slugs) {
    const key = slugKey(slug);
    if (!key) continue;
    const feat = chase.bySlug.get(key) || {
      ov: 0,
      uv: 0,
      home: 0,
      flOffers: 0,
      latestVisitAt: 0,
      pursuitHits: 0,
      scheduledOv: false,
    };
    const player = playersBySlug.get(key);
    const offerFlag = playerHasUfOfferFlag(player);
    const flOffers = Number(feat.flOffers) || 0;
    const hasOffer = flOffers > 0 || offerFlag;
    const ov = Number(feat.ov) || 0;
    const uv = Number(feat.uv) || 0;
    const home = Number(feat.home) || 0;
    const visitCount = ov + uv + home;
    const intel = Number(chase.intelCounts.get(key) || 0);
    const pursuit = Number(chase.pursuitCounts?.get(key) || feat.pursuitHits || 0);
    const scheduledOv = Boolean(feat.scheduledOv) || chase.scheduledOvSlugs?.has(key);
    const latestVisitAt = Number(feat.latestVisitAt) || Number(feat.latestHomeVisitAt) || 0;
    const recentVisit = latestVisitAt >= warmCutoff;
    const allowlisted = chase.allowlisted.has(key);

    // Florida process on file (not market %).
    const hasProcess =
      hasOffer || visitCount > 0 || scheduledOv || home > 0 || pursuit > 0 || intel > 0;

    // Still warm: recent campus/home contact, pursuit language, scheduled OV,
    // or offer + multi-visit stack (offer alone can go cold).
    const stillWarm =
      recentVisit ||
      pursuit > 0 ||
      scheduledOv ||
      home > 0 ||
      (hasOffer && visitCount >= 2) ||
      (hasOffer && intel >= 2);

    const closestEligible = Boolean(allowlisted && hasProcess && stillWarm);

    bySlug.set(key, {
      allowlisted,
      hasUFOffer: hasOffer,
      flOfferCount: flOffers,
      floridaVisits: visitCount,
      ov,
      uv,
      home,
      intel90: intel,
      pursuitHits: pursuit,
      scheduledOv,
      recentVisit,
      hasProcess,
      stillWarm,
      closestEligible,
      reasons: [
        hasOffer ? 'uf_offer' : null,
        visitCount > 0 ? 'florida_visit' : null,
        home > 0 ? 'home_visit' : null,
        scheduledOv ? 'scheduled_ov' : null,
        pursuit > 0 ? 'pursuit_intel' : null,
        intel > 0 ? 'intel' : null,
        recentVisit ? 'recent_visit' : null,
      ].filter(Boolean),
    });
  }

  return { bySlug, classYear, days, warmDays };
}

function getClosestCommitEvidence(index, slug) {
  const key = slugKey(slug);
  if (!key) return null;
  return (
    index.bySlug.get(key) || {
      allowlisted: false,
      hasUFOffer: false,
      flOfferCount: 0,
      floridaVisits: 0,
      ov: 0,
      uv: 0,
      home: 0,
      intel90: 0,
      pursuitHits: 0,
      scheduledOv: false,
      recentVisit: false,
      hasProcess: false,
      stillWarm: false,
      closestEligible: false,
      reasons: [],
    }
  );
}

function attachClosestCommitEvidence(players, opts = {}) {
  const index = buildClosestCommitEvidenceIndex(opts);
  return (Array.isArray(players) ? players : []).map((p) => {
    const evidence = getClosestCommitEvidence(index, p?.slug);
    return {
      ...p,
      processEvidence: evidence,
      closestCommitEligible: evidence.closestEligible,
      hasUFOffer: evidence.hasUFOffer,
    };
  });
}

module.exports = {
  buildClosestCommitEvidenceIndex,
  getClosestCommitEvidence,
  attachClosestCommitEvidence,
  playerHasUfOfferFlag,
};
