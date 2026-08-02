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

function isUnofficialVisit(visitType) {
  const t = String(visitType || '').toLowerCase();
  // Check unofficial FIRST — "unofficial_visit" contains the substring "official".
  return t.includes('unofficial') || /\buv\b/.test(t) || /junior\s*day/.test(t) || t.includes('camp');
}

function isOfficialVisit(visitType) {
  const t = String(visitType || '').toLowerCase();
  if (isUnofficialVisit(t)) return false;
  return t.includes('official') || t === 'ov' || /(?:^|[^a-z])ov(?:[^a-z]|$)/.test(t);
}

function buildChaseFeatureIndex(opts = {}) {
  // Recruiting chase windows are seasonal — keep spring visits relevant into summer.
  const days = Number(opts.days) || 180;
  const cutoffMs = Date.now() - days * DAY_MS;
  // Load broad, then filter on visit/offer DATE (not ingest reportedAt).
  const visits = visitLogStore.listVisitLogs({ limit: 8000 });
  const offers = offerLogStore.listOfferLogs({ limit: 8000 });

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
    const ts = new Date(row.date || row.reportedAt).getTime();
    if (!Number.isFinite(ts) || ts < cutoffMs) continue;
    const feat = ensure(row.playerSlug);
    if (!feat) continue;
    const vt = row.visitType || row.eventType;
    if (isOfficialVisit(vt)) feat.ov += 1;
    else feat.uv += 1;
    if (ts > feat.latestVisitAt) feat.latestVisitAt = ts;
  }

  for (const row of offers) {
    if (!isFloridaSchool(row.school || 'Florida')) continue;
    const ts = new Date(row.date || row.reportedAt).getTime();
    if (!Number.isFinite(ts) || ts < cutoffMs) continue;
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
    const intel = intelStore.listIntel({ limit: 2500, since: sinceIso(days) });
    /** Dedupe auto-ingest spam: count unique source+day, not raw rows. */
    const intelKeys = new Map();
    for (const row of intel) {
      const key = slugKey(row.playerSlug || row.player_slug || row.slug);
      if (!key) continue;
      if (!intelKeys.has(key)) intelKeys.set(key, new Set());
      const src = String(row.source || row.outlet || 'unknown').trim().toLowerCase() || 'unknown';
      const day = String(row.reportedAt || row.createdAt || row.date || '').slice(0, 10) || 'nodate';
      intelKeys.get(key).add(`${src}|${day}`);
    }
    for (const [key, set] of intelKeys) {
      intelCounts.set(key, set.size);
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
  isOfficialVisit,
  isUnofficialVisit,
};
