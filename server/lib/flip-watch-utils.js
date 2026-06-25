/**
 * Flip Watch — committed elsewhere + verified UF official visit completed.
 */
const { formatVisitSourceLabel } = require("./visit-intel-utils");

function isFloridaCommit(school) {
  return /\bflorida\b|\bgators\b|\buf\b/i.test(String(school || ""));
}

function shortSchoolName(school) {
  const raw = String(school || "").trim();
  if (!raw) return "Other";
  return raw.replace(/\bUniversity\b/gi, "").trim().split(/\s+/)[0] || raw;
}

function buildFlipWatchRows(players, visitRecap, { limit = 8 } = {}) {
  const recapBySlug = new Map(
    (visitRecap || []).map((row) => [String(row.slug || "").toLowerCase(), row])
  );

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
  buildFlipWatchRows,
  prioritizeVisitRecapForTargets,
};
