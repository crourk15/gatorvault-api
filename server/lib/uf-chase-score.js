/**
 * UF staff-chase score for Big Board Top Targets / Lab High Priority.
 *
 * Core idea: visit *count* is mostly prospect logistics (locals / free calendars
 * stack UVs). Florida invites a lot of kids — making the trip is on the player,
 * not proof staff is chasing harder. Rank by staff-side pursuit (offer, staff
 * assign, PRIORITY/STAFF_FLAG, in-home visits, beat "pushing hard", scheduled
 * OV). Campus presence is a light checkmark only — never a trip-count race.
 *
 * In-home visits are scarce NCAA contacts (max ~6 off-campus contacts/prospect)
 * — strong proof staff is investing, unlike stacked UVs from local kids.
 */
const fs = require('fs');
const path = require('path');
const visitLogStore = require('./recruiting-visit-log-store');
const offerLogStore = require('./recruiting-offer-log-store');
const { isFloridaSchool } = require('./recruiting-target-filters');

function isFloridaVisitLog(entry) {
  const school = String(entry?.school || 'Florida');
  return isFloridaSchool(school) || /\bgators\b|\buf\b|gainesville/i.test(school);
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Beat / intel language that signals active Florida pursuit (not just a visit). */
const PURSUIT_TEXT_RE =
  /\b(?:pushing hard|recruiting hard|staff loves|priority target|high[- ]priority(?:\s+target)?|staff priority|in the lead(?: group)?|pulling ahead|heating up|coaches? (?:are )?(?:all[- ]in|heavy)|going to get you|want you and|another trip to (?:gainesville|florida)|staff (?:is |are )?(?:all[- ]in|heavy|pushing))\b/i;

/** Coach in-home / living-room visit — scarce staff-side contact (not campus UV). */
const HOME_VISIT_TEXT_RE =
  /\b(?:home visit|in[- ]home(?:\s+visit)?|in[- ]home visit|visited (?:him|her|them|the family) at home|coaches? (?:were |was )?in (?:the |his |her |their )?home|in the home with)\b/i;

const SCHEDULED_OV_RE =
  /\b(?:scheduled|set|slated)\b.{0,48}\b(?:official visit|\bov\b)|(?:official visit|\bov\b).{0,48}\b(?:scheduled|set|slated)\b/i;

function sinceIso(days) {
  return new Date(Date.now() - days * DAY_MS).toISOString();
}

function slugKey(value) {
  return String(value || '').trim().toLowerCase();
}

function isHomeVisit(visitType, detail = '') {
  const t = `${visitType || ''} ${detail || ''}`.toLowerCase();
  if (!t.trim()) return false;
  if (/home[_-\s]?visit|in[_-\s]?home|in the home/.test(t)) return true;
  return HOME_VISIT_TEXT_RE.test(t);
}

function isUnofficialVisit(visitType) {
  const t = String(visitType || '').toLowerCase();
  if (isHomeVisit(t)) return false;
  // Check unofficial FIRST — "unofficial_visit" contains the substring "official".
  return t.includes('unofficial') || /\buv\b/.test(t) || /junior\s*day/.test(t) || t.includes('camp');
}

function isOfficialVisit(visitType) {
  const t = String(visitType || '').toLowerCase();
  if (isHomeVisit(t) || isUnofficialVisit(t)) return false;
  return t.includes('official') || t === 'ov' || /(?:^|[^a-z])ov(?:[^a-z]|$)/.test(t);
}

/** Staff-side: first in-home is huge; a second still matters; count beyond that is rare. */
function homeVisitChasePoints(homeCount) {
  const n = Math.max(0, Number(homeCount) || 0);
  if (n <= 0) return 0;
  if (n === 1) return 18;
  return 18 + Math.min(8, (n - 1) * 4);
}

/**
 * Campus presence only — never score visit *count*.
 * OV > UV because the program hosts a limited official; extra UVs add nothing
 * (local kids / open weekends inflate trip totals without more staff chase).
 */
function visitChasePoints(ovCount, uvCount) {
  const ov = Math.max(0, Number(ovCount) || 0);
  const uv = Math.max(0, Number(uvCount) || 0);
  if (ov >= 1) return 6; // program hosted an official — light staff-side signal
  if (uv >= 1) return 3; // been on campus at least once — process checkmark only
  return 0;
}

/** Small recency nudge on presence — still not a chase proxy. */
function recentVisitPoints(latestVisitAt, nowMs = Date.now()) {
  const ts = Number(latestVisitAt) || 0;
  if (!ts) return 0;
  const age = nowMs - ts;
  if (age < 21 * DAY_MS) return 3;
  if (age < 45 * DAY_MS) return 2;
  if (age < 90 * DAY_MS) return 1;
  return 0;
}

function loadLocalPlayersSync() {
  try {
    const store = require('./recruiting-store');
    const file = path.join(store.DATA_DIR, 'players.json');
    const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
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
        home: 0,
        flOffers: 0,
        latestVisitAt: 0,
        latestHomeVisitAt: 0,
        pursuitHits: 0,
        scheduledOv: false,
      });
    }
    return bySlug.get(key);
  }

  /** Dedupe home visits from logs + beat text (source|day). */
  const homeVisitKeys = new Map();

  function bumpHomeVisit(slug, src, day, ts = 0) {
    const key = slugKey(slug);
    if (!key) return;
    const feat = ensure(key);
    if (!feat) return;
    if (!homeVisitKeys.has(key)) homeVisitKeys.set(key, new Set());
    const token = `${src || 'unknown'}|${day || 'nodate'}`;
    if (homeVisitKeys.get(key).has(token)) return;
    homeVisitKeys.get(key).add(token);
    feat.home += 1;
    if (ts > (feat.latestHomeVisitAt || 0)) feat.latestHomeVisitAt = ts;
  }

  for (const row of visits) {
    if (!isFloridaVisitLog(row)) continue;
    const ts = new Date(row.date || row.reportedAt).getTime();
    if (!Number.isFinite(ts) || ts < cutoffMs) continue;
    const feat = ensure(row.playerSlug);
    if (!feat) continue;
    const vt = row.visitType || row.eventType;
    if (isHomeVisit(vt, row.detail)) {
      const day = String(row.date || row.reportedAt || '').slice(0, 10) || 'nodate';
      bumpHomeVisit(row.playerSlug, row.source || 'visit-log', day, ts);
    } else if (isOfficialVisit(vt)) {
      feat.ov += 1;
      if (ts > feat.latestVisitAt) feat.latestVisitAt = ts;
    } else {
      feat.uv += 1;
      if (ts > feat.latestVisitAt) feat.latestVisitAt = ts;
    }
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
  /** @type {Map<string, number>} */
  const pursuitCounts = new Map();
  /** @type {Set<string>} */
  const scheduledOvSlugs = new Set();

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

  // Sync local JSON — getAllPlayers() is async and was silently skipped here.
  for (const p of loadLocalPlayersSync()) {
    const key = slugKey(p?.slug);
    if (!key) continue;
    if (p.headliner) headliners.add(key);
    const ovStatus = String(p.ufOvStatus || p.uf_ov_status || '').toLowerCase();
    if (ovStatus === 'scheduled' || ovStatus === 'pending') {
      scheduledOvSlugs.add(key);
      const feat = ensure(key);
      if (feat) feat.scheduledOv = true;
    }
  }

  /** @type {Map<string, Set<string>>} */
  const intelFamilies = new Map();

  try {
    const intelStore = require('./recruiting-intel-store');
    const intel = intelStore.listIntel({ limit: 2500, since: sinceIso(days) });
    /** Dedupe auto-ingest spam: count unique source+day, not raw rows. */
    const intelKeys = new Map();
    const pursuitKeys = new Map();
    for (const row of intel) {
      const key = slugKey(row.playerSlug || row.player_slug || row.slug);
      if (!key) continue;
      if (!intelKeys.has(key)) intelKeys.set(key, new Set());
      const src = String(row.source || row.outlet || 'unknown').trim().toLowerCase() || 'unknown';
      const day = String(row.reportedAt || row.createdAt || row.date || '').slice(0, 10) || 'nodate';
      intelKeys.get(key).add(`${src}|${day}`);
      if (!intelFamilies.has(key)) intelFamilies.set(key, new Set());
      intelFamilies.get(key).add(intelSourceFamily(src, row.sourceType || row.eventType));

      const eventType = String(row.eventType || row.triggerType || '').toLowerCase();
      const text = `${row.detail || ''} ${row.status || ''} ${row.headline || ''} ${row.title || ''}`;
      const floridaCtx = /\b(?:florida|gators|\buf\b|gainesville)\b/i.test(text) || eventType === 'home_visit';
      if (eventType === 'home_visit' || (floridaCtx && HOME_VISIT_TEXT_RE.test(text))) {
        const ts = new Date(row.reportedAt || row.createdAt || row.date || day).getTime();
        bumpHomeVisit(key, src, day, Number.isFinite(ts) ? ts : 0);
      }
      const pursuitEvent =
        eventType === 'recruiting_narrative' ||
        eventType === 'staff_push' ||
        eventType === 'trending';
      const pursuitText = PURSUIT_TEXT_RE.test(text);
      if (pursuitEvent || pursuitText) {
        if (!pursuitKeys.has(key)) pursuitKeys.set(key, new Set());
        pursuitKeys.get(key).add(`${src}|${day}|pursuit`);
      }
      if (SCHEDULED_OV_RE.test(text) || eventType === 'official_visit_scheduled') {
        scheduledOvSlugs.add(key);
        const feat = ensure(key);
        if (feat) feat.scheduledOv = true;
      }
    }
    for (const [key, set] of intelKeys) {
      intelCounts.set(key, set.size);
    }
    for (const [key, set] of pursuitKeys) {
      pursuitCounts.set(key, set.size);
      const feat = ensure(key);
      if (feat) feat.pursuitHits = set.size;
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
    intelFamilies,
    pursuitCounts,
    scheduledOvSlugs,
    days,
  };
}

/** Broad intel families — rewards real multi-channel coverage, not one spammy source. */
function intelSourceFamily(source, sourceTypeOrEvent) {
  const s = `${source || ''} ${sourceTypeOrEvent || ''}`.toLowerCase();
  if (/visit|ov|uv|junior\s*day|camp/.test(s)) return 'visit';
  if (/offer/.test(s)) return 'offer';
  if (/on3|rpm|team-news/.test(s)) return 'on3';
  if (/rivals/.test(s)) return 'rivals';
  if (/detectives|beat|writer|allowlist-intel/.test(s)) return 'beat';
  return 'other';
}

/**
 * @param {object} player
 * @param {ReturnType<typeof buildChaseFeatureIndex>} index
 */
function computeChaseScore(player, index) {
  const slug = slugKey(player.slug || player.id);
  const feat = index.bySlug.get(slug) || {
    ov: 0,
    uv: 0,
    home: 0,
    flOffers: 0,
    latestVisitAt: 0,
    latestHomeVisitAt: 0,
    pursuitHits: 0,
    scheduledOv: false,
  };
  const signals = Array.isArray(player.signals) ? player.signals : [];
  const hasStaffFlag = signals.some((s) => String(s.signal_type || s.signalType || '').toUpperCase() === 'STAFF_FLAG');
  const hasOfferSignal = signals.some((s) => String(s.signal_type || s.signalType || '').toUpperCase() === 'OFFER');
  const ufStatus = String(player.uf_status || player.ufStatus || '').toUpperCase();
  const noteLen = String(player.evaluation_notes || player.evaluationNotes || '').trim().length;
  const allowlisted = index.allowlisted.has(slug);
  const headliner = index.headliners.has(slug);
  const assignment = index.staffMap[slug] || {};
  const hasStaffLead = Boolean(assignment.staff_lead_id || assignment.staffLeadId);
  const hasSecondaryRecruiter = Boolean(
    assignment.secondary_recruiter_id || assignment.secondaryRecruiterId
  );
  const intel90 = index.intelCounts.get(slug) || 0;
  const intelFamilyCount = index.intelFamilies?.get(slug)?.size || 0;
  const pursuitHits = index.pursuitCounts?.get(slug) || feat.pursuitHits || 0;
  const playerOvStatus = String(player.ufOvStatus || player.uf_ov_status || '').toLowerCase();
  const scheduledOv =
    feat.scheduledOv ||
    index.scheduledOvSlugs?.has(slug) ||
    playerOvStatus === 'scheduled' ||
    playerOvStatus === 'pending';

  let score = 0;
  // Campus presence = light process checkmark. Trip count is ignored (locals stack).
  const visitPts = visitChasePoints(feat.ov, feat.uv);
  score += visitPts;
  score += recentVisitPoints(feat.latestVisitAt);

  // In-home visit = scarce staff contact (NCAA ~6 off-campus contacts). Dominates UV stacks.
  const homePts = homeVisitChasePoints(feat.home);
  score += homePts;
  if (feat.home > 0) score += recentVisitPoints(feat.latestHomeVisitAt || feat.latestVisitAt);

  // Staff-side chase signals dominate.
  if (feat.flOffers > 0 || hasOfferSignal) score += 14;
  if (hasStaffFlag) score += 16;
  if (ufStatus === 'PRIORITY') score += 14;
  else if (ufStatus === 'TARGET') score += 8;
  if (hasStaffLead) score += 8;
  // Dual-staff assignment = real chase investment beyond lead only.
  if (hasSecondaryRecruiter) score += 6;
  if (noteLen > 80) score += 5;

  // Beat/intel pursuit ("pushing hard", narratives) + scheduled OV (staff invited).
  score += Math.min(16, pursuitHits * 5);
  if (scheduledOv) score += 8;

  // Intel is first-class: unique source-days + multi-channel breadth.
  // Cap volume so one auto source cannot drown continuous allowlist coverage.
  score += Math.min(14, intel90 * 2);
  score += Math.min(6, Math.max(0, intelFamilyCount - 1) * 2);

  // Editorial chase gate (hunt list / headliner) — boost, not the whole board.
  if (allowlisted || headliner) score += 10;

  // Tiny tie-breakers only — never let fit/stars dominate.
  score += Math.min(2, (Number(player.ufFitScore) || 0) * 0.02);

  return {
    chaseScore: Math.round(score * 10) / 10,
    chase: {
      ov: feat.ov,
      uv: feat.uv,
      home: feat.home || 0,
      flOffers: feat.flOffers,
      visitPts,
      homePts,
      intel: intel90,
      intelFamilies: intelFamilyCount,
      pursuit: pursuitHits,
      scheduledOv: !!scheduledOv,
      allowlisted,
      headliner,
      hasStaffFlag,
      hasStaffLead,
      hasSecondaryRecruiter,
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
  isHomeVisit,
  intelSourceFamily,
  visitChasePoints,
  homeVisitChasePoints,
  recentVisitPoints,
  PURSUIT_TEXT_RE,
  HOME_VISIT_TEXT_RE,
};
