/**
 * Flip Watch — committed elsewhere + verified UF official visit completed.
 */
const {
  formatVisitSourceLabel,
  getVerifiedFloridaVisitWindow,
  todayYmd,
} = require("./visit-intel-utils");
const { computeFlipWatchScore } = require("./flip-watch-score");

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

function buildFlipWatchRows(
  players,
  visitRecap,
  {
    visitLogs = null,
    asOf = new Date(),
    limit = 8,
    intelRows = [],
    commitBySlug = null,
    ufBySlug = null,
    ufLabelBySlug = null,
    ufLowConfidenceBySlug = null,
    nameBySlug = null,
  } = {}
) {
  const recapBySlug = indexCompletedVerifiedRecap(visitRecap, visitLogs, asOf);
  const playerBySlug = new Map(
    (players || []).map((p) => [String(p.slug || "").toLowerCase(), p])
  );
  const slugKeys = new Set([...playerBySlug.keys(), ...recapBySlug.keys()]);
  if (commitBySlug && typeof commitBySlug.get === "function") {
    for (const [slug, commit] of commitBySlug.entries()) {
      if (commit && !isFloridaCommit(commit)) slugKeys.add(String(slug).toLowerCase());
    }
  }

  return [...slugKeys]
    .map((slug) => {
      const p = playerBySlug.get(slug);
      const recap = recapBySlug.get(slug);
      if (!recap) return null;
      const committedTo = p?.committedTo ?? commitBySlug?.get(slug) ?? null;
      if (!committedTo || isFloridaCommit(committedTo)) return null;
      const base = {
        slug: p?.slug || recap.slug,
        name: p?.name || recap.name || nameBySlug?.get(slug) || slug,
        committedTo,
        committedShort: shortSchoolName(committedTo),
        ufProbability: p?.ufProbability ?? ufBySlug?.get(slug) ?? null,
        ufProbabilityLabel:
          p?.ufProbabilityLabel ?? ufLabelBySlug?.get(slug) ?? null,
        ufProbabilityLowConfidence: Boolean(
          p?.ufProbabilityLowConfidence ?? ufLowConfidenceBySlug?.get(slug)
        ),
        visitStart: recap?.visitStart ?? null,
        visitEnd: recap?.visitEnd ?? null,
        visitSourceLabel: recap?.visitSourceLabel ?? formatVisitSourceLabel(recap?.visitSource),
      };
      return { ...base, ...computeFlipWatchScore(base, { intelRows, asOf }) };
    })
    .filter(Boolean)
    .sort((a, b) => (b.flipScore ?? 0) - (a.flipScore ?? 0) || (b.ufProbability ?? 0) - (a.ufProbability ?? 0))
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
