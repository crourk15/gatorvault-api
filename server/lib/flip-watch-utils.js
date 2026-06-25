/**
 * Flip Watch — committed elsewhere + verified UF official visit completed.
 */
const {
  formatVisitSourceLabel,
  getVerifiedFloridaVisitWindow,
  todayYmd,
} = require("./visit-intel-utils");

function isFloridaCommit(school) {
  return /\bflorida\b|\bgators\b|\buf\b/i.test(String(school || ""));
}

function shortSchoolName(school) {
  const raw = String(school || "").trim();
  if (!raw) return "Other";
  return raw.replace(/\bUniversity\b/gi, "").trim().split(/\s+/)[0] || raw;
}

function indexCompletedVerifiedRecap(visitRecap, visitLogs, asOf = new Date()) {
  const recapBySlug = new Map(
    (visitRecap || []).map((row) => [String(row.slug || "").toLowerCase(), row])
  );
  const today = todayYmd(asOf);
  for (const entry of visitLogs || []) {
    const window = getVerifiedFloridaVisitWindow(entry);
    if (!window || window.visitEnd >= today) continue;
    const slug = String(entry.playerSlug || "").toLowerCase();
    if (!slug || recapBySlug.has(slug)) continue;
    recapBySlug.set(slug, {
      slug: entry.playerSlug,
      name: entry.playerName || entry.playerSlug,
      visitStart: window.visitStart,
      visitEnd: window.visitEnd,
      visitSource: window.source,
      visitSourceLabel: formatVisitSourceLabel(window.source),
    });
  }
  return recapBySlug;
}

function buildFlipWatchRows(players, visitRecap, { visitLogs = null, asOf = new Date(), limit = 8 } = {}) {
  const recapBySlug = indexCompletedVerifiedRecap(visitRecap, visitLogs, asOf);

  return (players || [])
    .filter((p) => {
      if (!p.committedTo || isFloridaCommit(p.committedTo)) return false;
      return recapBySlug.has(String(p.slug || "").toLowerCase());
    })
    .map((p) => {
      const recap = recapBySlug.get(String(p.slug || "").toLowerCase());
      return {
        slug: p.slug,
        name: p.name,
        committedTo: p.committedTo,
        committedShort: shortSchoolName(p.committedTo),
        ufProbability: p.ufProbability ?? null,
        ufProbabilityLabel: p.ufProbabilityLabel ?? null,
        ufProbabilityLowConfidence: Boolean(p.ufProbabilityLowConfidence),
        visitStart: recap?.visitStart ?? null,
        visitEnd: recap?.visitEnd ?? null,
        visitSourceLabel: recap?.visitSourceLabel ?? formatVisitSourceLabel(recap?.visitSource),
      };
    })
    .sort((a, b) => (b.ufProbability ?? 0) - (a.ufProbability ?? 0))
    .slice(0, limit);
}

function prioritizeVisitRecapForTargets(visitRecap, prioritySlugs, { limit = 12 } = {}) {
  const slugSet = new Set((prioritySlugs || []).map((s) => String(s).toLowerCase()));
  const rows = [...(visitRecap || [])];
  rows.sort((a, b) => {
    const aPri = slugSet.has(String(a.slug || "").toLowerCase()) ? 1 : 0;
    const bPri = slugSet.has(String(b.slug || "").toLowerCase()) ? 1 : 0;
    if (aPri !== bPri) return bPri - aPri;
    return String(b.visitStart || "").localeCompare(String(a.visitStart || ""));
  });
  return rows.slice(0, limit);
}

module.exports = {
  isFloridaCommit,
  shortSchoolName,
  indexCompletedVerifiedRecap,
  buildFlipWatchRows,
  prioritizeVisitRecapForTargets,
};
