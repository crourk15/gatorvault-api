/**
 * Shared visit intel helpers — verification, upcoming vs stale windows, sort order.
 */
const { normalizeIntelTimestamp } = require('./commit-fingerprint');

const VERIFIED_VISIT_SOURCES = new Set(['on3', 'manual', 'rivals_pm']);

function todayYmd(asOf = new Date()) {
  return asOf.toISOString().slice(0, 10);
}

function isVerifiedVisitLogSource(source, entry = null) {
  const src = String(source || '').toLowerCase();
  if (VERIFIED_VISIT_SOURCES.has(src)) return true;
  // Beat desk / writer ingest already resolved a playerSlug — treat as verified visit intel.
  if (/beat/.test(src) && (entry?.identityConfirmed || entry?.playerSlug)) return true;
  return false;
}

/** True official OV only — "unofficial_visit".includes("official") must not win. */
function isOfficialVisitType(visitType) {
  const t = String(visitType || '').toLowerCase();
  if (!t || t === 'uv' || t.includes('unofficial')) return false;
  return t.includes('official') || t === 'ov_change' || t === 'ov';
}

function parseVisitLogDateYmd(entry) {
  if (!entry) return null;
  const raw = entry.date || entry.reportedAt || entry.timestamp;
  if (!raw) return null;
  return normalizeIntelTimestamp(raw).slice(0, 10);
}

function isFloridaVisitLog(entry) {
  const school = String(entry?.school || 'Florida');
  return /\bflorida\b|\bgators\b|\buf\b|gainesville/i.test(school);
}

function defaultVisitEndYmd(startYmd) {
  const d = new Date(`${String(startYmd).slice(0, 10)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 2);
  return d.toISOString().slice(0, 10);
}

function isUnofficialVisitType(visitType) {
  const t = String(visitType || '').toLowerCase();
  if (!t) return false;
  return t === 'uv' || t.includes('unofficial');
}

/**
 * Official OV window only (3-day default). Used by OV recap / upcoming OV paths.
 */
function getVerifiedFloridaVisitWindow(entry) {
  if (!entry || !isVerifiedVisitLogSource(entry.source, entry)) return null;
  if (!isFloridaVisitLog(entry)) return null;
  const visitType = String(entry.visitType || entry.eventType || '').toLowerCase();
  if (!isOfficialVisitType(visitType)) return null;

  const visitStart = parseVisitLogDateYmd(entry);
  if (!visitStart) return null;

  return {
    visitStart,
    visitEnd: defaultVisitEndYmd(visitStart),
    source: entry.source,
    visitType,
    fingerprint: entry.fingerprint || null,
    kind: 'official',
    reportedAt: entry.reportedAt || entry.timestamp || null,
  };
}

/**
 * Board Intel activity: verified Florida OV + UV (UV = same-day window).
 * Keeps OV-only helpers intact for autoposter / OV-specific gates.
 */
function getVerifiedFloridaVisitActivity(entry) {
  if (!entry || !isVerifiedVisitLogSource(entry.source, entry)) return null;
  if (!isFloridaVisitLog(entry)) return null;
  const visitType = String(entry.visitType || entry.eventType || '').toLowerCase();
  const official = isOfficialVisitType(visitType);
  const unofficial = isUnofficialVisitType(visitType);
  if (!official && !unofficial) return null;

  const visitStart = parseVisitLogDateYmd(entry);
  if (!visitStart) return null;

  return {
    visitStart,
    visitEnd: official ? defaultVisitEndYmd(visitStart) : visitStart,
    source: entry.source,
    visitType,
    fingerprint: entry.fingerprint || null,
    kind: official ? 'official' : 'unofficial',
    reportedAt: entry.reportedAt || entry.timestamp || null,
    playerSlug: entry.playerSlug || null,
    playerName: entry.playerName || null,
  };
}

function listRecentVerifiedFloridaVisitActivity(
  visitLogs,
  { limit = 24, asOf = new Date(), kinds = null } = {}
) {
  const today = todayYmd(asOf);
  const allowKinds = kinds ? new Set(kinds) : null;
  const seen = new Set();
  const rows = [];
  for (const entry of visitLogs || []) {
    const activity = getVerifiedFloridaVisitActivity(entry);
    if (!activity) continue;
    if (allowKinds && !allowKinds.has(activity.kind)) continue;
    const key = `${String(activity.playerSlug || '').toLowerCase()}|${activity.kind}|${activity.visitStart}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      slug: activity.playerSlug,
      name: activity.playerName,
      visitStart: activity.visitStart,
      visitEnd: activity.visitEnd,
      source: activity.source,
      kind: activity.kind,
      visitType: activity.visitType,
      reportedAt: activity.reportedAt,
      completed: activity.visitEnd < today,
      upcoming: activity.visitStart >= today || activity.visitEnd >= today,
    });
  }
  rows.sort((a, b) => {
    const ar = String(a.reportedAt || a.visitStart || '');
    const br = String(b.reportedAt || b.visitStart || '');
    if (ar !== br) return br.localeCompare(ar);
    return String(b.visitStart || '').localeCompare(String(a.visitStart || ''));
  });
  return rows.slice(0, Math.max(1, limit));
}

function buildVerifiedVisitActivityRows(players, visitLogs, asOf = new Date(), opts = {}) {
  const limit = opts.limit || 12;
  const prioritySlugs = (opts.prioritySlugs || []).map((s) => String(s || '').toLowerCase());
  const prioritySet = new Set(prioritySlugs);
  const kinds = opts.kinds || ['unofficial'];
  const pool = listRecentVerifiedFloridaVisitActivity(visitLogs, {
    limit: Math.max(limit * 4, 48),
    asOf,
    kinds,
  });
  const playerBySlug = new Map((players || []).map((pl) => [String(pl.slug || '').toLowerCase(), pl]));
  let rows = pool
    .filter((row) => row.slug)
    .map((row) => {
      const player = playerBySlug.get(String(row.slug || '').toLowerCase());
      return {
        ...row,
        name: row.name || player?.name || row.slug,
        visitSource: row.source,
        visitSourceLabel: formatVisitSourceLabel(row.source),
        ufProbability: player?.ufProbability ?? null,
      };
    });
  if (prioritySet.size) {
    rows = rows.filter((r) => prioritySet.has(String(r.slug || '').toLowerCase()));
  }
  return rows.slice(0, limit);
}

function effectiveVisitEnd(player) {
  if (!player) return null;
  if (player.visitEnd) return String(player.visitEnd).slice(0, 10);
  if (player.visitStart) return defaultVisitEndYmd(player.visitStart);
  return null;
}

function isPastVisitWindow(player, asOf = new Date()) {
  const end = effectiveVisitEnd(player);
  if (!end) return false;
  return end < todayYmd(asOf);
}

function pickLatestVerifiedUpcomingFloridaVisit(slug, visitLogs, asOf = new Date()) {
  const key = String(slug || '').toLowerCase();
  const today = todayYmd(asOf);
  const rows = (visitLogs || [])
    .filter((e) => String(e.playerSlug || '').toLowerCase() === key)
    .sort((a, b) => parseVisitLogDateYmd(b).localeCompare(parseVisitLogDateYmd(a)));

  for (const entry of rows) {
    const window = getVerifiedFloridaVisitWindow(entry);
    if (!window) continue;
    if (window.visitEnd >= today || window.visitStart >= today) {
      return {
        ...window,
        entry,
        reportedAt: window.reportedAt || entry.reportedAt || entry.timestamp || null,
      };
    }
  }
  return null;
}

function isUpcomingVisitIntel(player, asOf = new Date()) {
  if (!player) return false;
  if (player.visitVerified === false) return false;
  const status = String(player.ufOvStatus || '').toLowerCase();
  if (status === 'cancelled' || status === 'completed') return false;
  if (isPastVisitWindow(player, asOf)) return false;

  const today = todayYmd(asOf);
  const start = player.visitStart ? String(player.visitStart).slice(0, 10) : null;
  const end = effectiveVisitEnd(player);

  if (start && start >= today) return true;
  if (end && end >= today) return true;
  return false;
}

function compareVisitIntel(a, b) {
  const aStart = a?.visitStart ? String(a.visitStart).slice(0, 10) : '9999-12-31';
  const bStart = b?.visitStart ? String(b.visitStart).slice(0, 10) : '9999-12-31';
  const byDate = aStart.localeCompare(bStart);
  if (byDate !== 0) return byDate;
  return String(a?.name || '').localeCompare(String(b?.name || ''));
}

function applyVerifiedVisitFields(player, visitLogs, asOf = new Date()) {
  const verified = pickLatestVerifiedUpcomingFloridaVisit(player?.slug, visitLogs, asOf);
  if (!verified) {
    return {
      ...player,
      visitStart: null,
      visitEnd: null,
      ufOvStatus:
        player?.ufOvStatus === 'scheduled' || player?.ufOvStatus === 'visit' ? 'completed' : player?.ufOvStatus ?? null,
      visitVerified: false,
      visitSource: null,
      visitSourceLabel: null,
    };
  }
  return {
    ...player,
    visitStart: verified.visitStart,
    visitEnd: verified.visitEnd,
    ufOvStatus: 'scheduled',
    visitVerified: true,
    visitSource: verified.source,
    visitSourceLabel: formatVisitSourceLabel(verified.source),
    reportedAt: verified.reportedAt || verified.entry?.reportedAt || null,
    visitReportedAt: verified.reportedAt || verified.entry?.reportedAt || null,
  };
}

function buildVerifiedVisitIntelRows(players, visitLogs, asOf = new Date()) {
  return (players || [])
    .map((p) => applyVerifiedVisitFields(p, visitLogs, asOf))
    .filter((p) => p.visitVerified && isUpcomingVisitIntel(p, asOf))
    .sort(compareVisitIntel)
    .slice(0, 12);
}

function countUpcomingVisitIntel(players, asOf = new Date()) {
  return (players || []).filter((p) => p.visitVerified && isUpcomingVisitIntel(p, asOf)).length;
}

function listRecentVerifiedFloridaOfficialVisits(visitLogs, { classYear = 2027, limit = 8, asOf = new Date() } = {}) {
  const today = todayYmd(asOf);
  return (visitLogs || [])
    .map((entry) => {
      const window = getVerifiedFloridaVisitWindow(entry);
      if (!window) return null;
      return {
        slug: entry.playerSlug,
        name: entry.playerName,
        visitStart: window.visitStart,
        visitEnd: window.visitEnd,
        source: window.source,
        reportedAt: window.reportedAt || entry.reportedAt || null,
        completed: window.visitEnd < today,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.visitStart.localeCompare(a.visitStart))
    .slice(0, limit);
}


function formatVisitSourceLabel(source) {
  const src = String(source || "").toLowerCase();
  if (src === "on3") return "On3";
  if (src === "manual") return "Manual";
  if (src === "rivals_pm") return "Rivals";
  if (/beat/.test(src)) return "Beat verified";
  return source ? String(source) : "Verified";
}

function dedupeVisitWindowKey(entry, window) {
  return String(entry.playerSlug || "").toLowerCase() + "|" + window.visitStart;
}

function countVerifiedUpcomingVisits(visitLogs, asOf = new Date()) {
  const today = todayYmd(asOf);
  const seen = new Set();
  let count = 0;
  for (const entry of visitLogs || []) {
    const window = getVerifiedFloridaVisitWindow(entry);
    if (!window) continue;
    const key = dedupeVisitWindowKey(entry, window);
    if (seen.has(key)) continue;
    if (window.visitEnd >= today || window.visitStart >= today) { seen.add(key); count += 1; }
  }
  return count;
}

function countVerifiedCompletedVisits(visitLogs, asOf = new Date()) {
  const today = todayYmd(asOf);
  const seen = new Set();
  let count = 0;
  for (const entry of visitLogs || []) {
    const window = getVerifiedFloridaVisitWindow(entry);
    if (!window) continue;
    const key = dedupeVisitWindowKey(entry, window);
    if (seen.has(key)) continue;
    if (window.visitEnd < today) { seen.add(key); count += 1; }
  }
  return count;
}

function buildVerifiedVisitRecapRows(players, visitLogs, asOf = new Date(), opts = {}) {
  const limit = opts.limit || 12;
  const prioritySlugs = opts.prioritySlugs || [];
  const poolLimit = prioritySlugs.length ? Math.max(limit * 4, 48) : Math.max(limit * 2, 16);
  const classYear = opts.classYear || 2027;
  const recap = listRecentVerifiedFloridaOfficialVisits(visitLogs, {
    classYear,
    limit: poolLimit,
    asOf,
  }).filter((row) => row.completed);
  const playerBySlug = new Map((players || []).map((pl) => [String(pl.slug || '').toLowerCase(), pl]));
  let rows = recap.map((row) => {
    const player = playerBySlug.get(String(row.slug || '').toLowerCase());
    return {
      slug: row.slug,
      name: row.name || player?.name || row.slug,
      visitStart: row.visitStart,
      visitEnd: row.visitEnd,
      visitSource: row.source,
      visitSourceLabel: formatVisitSourceLabel(row.source),
      reportedAt: row.reportedAt || null,
      ufProbability: player?.ufProbability ?? null,
    };
  });
  if (prioritySlugs.length) {
    const slugSet = new Set(prioritySlugs.map((s) => String(s).toLowerCase()));
    rows.sort((a, b) => {
      const aPri = slugSet.has(String(a.slug || '').toLowerCase()) ? 1 : 0;
      const bPri = slugSet.has(String(b.slug || '').toLowerCase()) ? 1 : 0;
      if (aPri !== bPri) return bPri - aPri;
      return String(b.visitStart || '').localeCompare(String(a.visitStart || ''));
    });
  }
  return rows.slice(0, limit);
}

function getVisitIntelBoardSnapshot(visitLogs, asOf = new Date()) {
  return { upcomingCount: countVerifiedUpcomingVisits(visitLogs, asOf), recapCount: countVerifiedCompletedVisits(visitLogs, asOf) };
}
module.exports = {
  VERIFIED_VISIT_SOURCES,
  todayYmd,
  isVerifiedVisitLogSource,
  parseVisitLogDateYmd,
  isOfficialVisitType,
  isUnofficialVisitType,
  getVerifiedFloridaVisitWindow,
  getVerifiedFloridaVisitActivity,
  listRecentVerifiedFloridaVisitActivity,
  buildVerifiedVisitActivityRows,
  effectiveVisitEnd,
  isPastVisitWindow,
  pickLatestVerifiedUpcomingFloridaVisit,
  isUpcomingVisitIntel,
  compareVisitIntel,
  applyVerifiedVisitFields,
  buildVerifiedVisitIntelRows,
  countUpcomingVisitIntel,
  listRecentVerifiedFloridaOfficialVisits,
  formatVisitSourceLabel,
  countVerifiedUpcomingVisits,
  countVerifiedCompletedVisits,
  buildVerifiedVisitRecapRows,
  getVisitIntelBoardSnapshot,
};
