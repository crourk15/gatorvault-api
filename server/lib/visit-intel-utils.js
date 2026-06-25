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
  if (/beat/.test(src) && entry?.identityConfirmed) return true;
  return false;
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

function getVerifiedFloridaVisitWindow(entry) {
  if (!entry || !isVerifiedVisitLogSource(entry.source, entry)) return null;
  if (!isFloridaVisitLog(entry)) return null;
  const visitType = String(entry.visitType || entry.eventType || '').toLowerCase();
  if (!visitType.includes('official')) return null;

  const visitStart = parseVisitLogDateYmd(entry);
  if (!visitStart) return null;

  return {
    visitStart,
    visitEnd: defaultVisitEndYmd(visitStart),
    source: entry.source,
    visitType,
    fingerprint: entry.fingerprint || null,
  };
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
      return { ...window, entry };
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
  getVerifiedFloridaVisitWindow,
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
