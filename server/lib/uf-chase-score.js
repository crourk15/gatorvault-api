/**
 * UF staff-chase / traction score for Big Board Top Targets.
 * Rank by visits, offers, staff activity, and beat intel — not RPM or star rank.
 */
const visitLogStore = require('./recruiting-visit-log-store');
const offerLogStore = require('./recruiting-offer-log-store');
const { isFloridaSchool } = require('./recruiting-target-filters');

function isFloridaVisitLog(entry) {
  const school = String(entry?.school || 'Florida');
  return isFloridaSchool(school) || /\bgators\b|\buf\b|gainesville/i.test(school);
}

const DAY_MS = 24 * 60 * 60 * 1000;

function sinceIso(days) {
  return new Date(Date.now() - days * DAY_MS).toISOString();
}

function slugKey(value) {
  return String(value || '').trim().toLowerCase();
}

function isOfficialVisit(visitType) {
  return /official|\bov\b/.test(String(visitType || '').toLowerCase());
}

function isUnofficialVisit(visitType) {
  return /unofficial|\buv\b|junior\s*day|camp/.test(String(visitType || '').toLowerCase());
}

function buildChaseFeatureIndex(opts = {}) {
  const days = Number(opts.days) || 120;
  const since = sinceIso(days);
  const visits = visitLogStore.listVisitLogs({ limit: 5000, since });
  const offers = offerLogStore.listOfferLogs({ limit: 5000, since });

  /** @type {Map<string, any>} */
  const bySlug = new Map();

  function ensure(slug) {
    const key = slugKey(slug);
    if (!key) return null;
    if (!bySlug.has(key)) {
      bySlug.set(key, {
        ov: 0,
        uv: 0,
        flOffers: 0,
        latestVisitAt: 0,
      });
    }
    return bySlug.get(key);
  }

  for (const row of visits) {
    if (!isFloridaVisitLog(row)) continue;
    const feat = ensure(row.playerSlug);
    if (!feat) continue;
    const vt = row.visitType || row.eventType;
    if (isOfficialVisit(vt)) feat.ov += 1;
    else if (isUnofficialVisit(vt)) feat.uv += 1;
    else feat.uv += 1;
    const ts = new Date(row.reportedAt || row.date).getTime();
    if (Number.isFinite(ts) && ts > feat.latestVisitAt) feat.latestVisitAt = ts;
  }

  for (const row of offers) {
    if (!isFloridaSchool(row.school || 'Florida')) continue;
    const feat = ensure(row.playerSlug);
    if (!feat) continue;
    feat.flOffers += 1;
  }

  let allowlisted = new Set();
  let staffMap = {};
  let headliners = new Set();
  let intelCounts = new Map();

  try {
    const year = Number(opts.classYear);
    if (Number.isFinite(year)) {
      const { getAllowlistSet } = require('./recruiting-target-allowlist');
      allowlisted = getAllowlistSet(year);
    }
  } catch {
    /* optional */
  }

  try {
    const { getAssignmentMap } = require('./recruiting-staff-assignments');
    staffMap = getAssignmentMap() || {};
  } catch {
    /* optional */
  }

  try {
    const store = require('./recruiting-store');
    const year = Number(opts.classYear);
    if (Number.isFinite(year) && typeof store.getBoard === 'function') {
      // sync access not available — skip async board headliners here
    }
    if (typeof store.getAllPlayers === 'function') {
      for (const p of store.getAllPlayers() || []) {
        if (p?.headliner && p?.slug) headliners.add(slugKey(p.slug));
      }
    } else if (typeof store.listPlayers === 'function') {
      for (const p of store.listPlayers() || []) {
        if (p?.headliner && p?.slug) headliners.add(slugKey(p.slug));
      }
    }
  } catch {
    /* optional */
  }

  try {
    const intelStore = require('./recruiting-intel-store');
    const intel = intelStore.listIntel({ limit: 2500, since });
    for (const row of intel) {
      const key = slugKey(row.playerSlug || row.player_slug || row.slug);
      if (!key) continue;
      intelCounts.set(key, (intelCounts.get(key) || 0) + 1);
    }
  } catch {
    /* optional */
  }

  return {
    bySlug,
    allowlisted,
    staffMap,
    headliners,
    intelCounts,
    days,
  };
}

/**
 * @param {object} player
 * @param {ReturnType<typeof buildChaseFeatureIndex>} index
 */
function computeChaseScore(player, index) {
  const slug = slugKey(player.slug || player.id);
  const feat = index.bySlug.get(slug) || { ov: 0, uv: 0, flOffers: 0, latestVisitAt: 0 };
  const signals = Array.isArray(player.signals) ? player.signals : [];
  const hasStaffFlag = signals.some((s) => String(s.signal_type || s.signalType || '').toUpperCase() === 'STAFF_FLAG');
  const hasOfferSignal = signals.some((s) => String(s.signal_type || s.signalType || '').toUpperCase() === 'OFFER');
  const ufStatus = String(player.uf_status || player.ufStatus || '').toUpperCase();
  const noteLen = String(player.evaluation_notes || player.evaluationNotes || '').trim().length;
  const allowlisted = index.allowlisted.has(slug);
  const headliner = index.headliners.has(slug);
  const hasStaffLead = Boolean(index.staffMap[slug]?.staff_lead_id || index.staffMap[slug]?.staffLeadId);
  const intel90 = index.intelCounts.get(slug) || 0;

  let score = 0;
  // Visits dominate — real campus/staff chase.
  score += Math.min(42, feat.ov * 14 + feat.uv * 7);
  if (feat.latestVisitAt > Date.now() - 45 * DAY_MS) score += 8;

  // Florida offer on file.
  if (feat.flOffers > 0 || hasOfferSignal) score += 14;

  // Staff activity.
  if (hasStaffFlag) score += 16;
  if (ufStatus === 'PRIORITY') score += 12;
  else if (ufStatus === 'TARGET') score += 7;
  if (hasStaffLead) score += 6;
  if (noteLen > 80) score += 5;

  // Beat intel volume (capped).
  score += Math.min(12, intel90 * 2);

  // Editorial chase gate (hunt list / headliner) — boost, not the whole board.
  if (allowlisted || headliner) score += 10;

  // Tiny tie-breakers only — never let fit/stars dominate.
  score += Math.min(2, (Number(player.ufFitScore) || 0) * 0.02);

  return {
    chaseScore: Math.round(score * 10) / 10,
    chase: {
      ov: feat.ov,
      uv: feat.uv,
      flOffers: feat.flOffers,
      intel: intel90,
      allowlisted,
      headliner,
      hasStaffFlag,
      hasStaffLead,
      ufStatus: ufStatus || null,
    },
  };
}

function hasChaseTraction(result) {
  if (!result) return false;
  if (result.chaseScore > 0) return true;
  return false;
}

module.exports = {
  buildChaseFeatureIndex,
  computeChaseScore,
  hasChaseTraction,
};
