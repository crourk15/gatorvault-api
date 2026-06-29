/**
 * D1 — Movement narratives tied to verified OV windows + rolling UF delta.
 */
const { getVerifiedFloridaVisitWindow, todayYmd } = require("./visit-intel-utils");

function formatShortVisitDate(ymd) {
  if (!ymd) return null;
  const d = new Date(`${String(ymd).slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return String(ymd).slice(0, 10);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function formatVisitWindowLabel(visitStart, visitEnd) {
  const start = formatShortVisitDate(visitStart);
  if (!start) return null;
  const end = formatShortVisitDate(visitEnd);
  if (!end || end === start) return start;
  return `${start}–${end}`;
}

function latestCompletedVisitForSlug(slug, visitLogs, asOf = new Date()) {
  const today = todayYmd(asOf);
  const key = String(slug || "").toLowerCase();
  let best = null;
  for (const entry of visitLogs || []) {
    if (String(entry.playerSlug || "").toLowerCase() !== key) continue;
    const window = getVerifiedFloridaVisitWindow(entry);
    if (!window || window.visitEnd >= today) continue;
    if (!best || window.visitStart > best.visitStart) best = window;
  }
  return best;
}

function buildMovementNarrative({ delta7d, visitStart, visitEnd, minDeltaAbs = 1 } = {}) {
  const delta = Number(delta7d);
  if (!Number.isFinite(delta) || Math.abs(delta) < minDeltaAbs) return null;
  const rounded = Math.round(delta);
  const sign = rounded > 0 ? "+" : "";
  const visit = formatVisitWindowLabel(visitStart, visitEnd);
  if (visit) return `UF ${sign}${rounded}% (7d) since verified OV (${visit})`;
  return `UF ${sign}${rounded}% (7d)`;
}

function resolveDeltaForSlug(row, deltaBySlug) {
  if (row?.movementDelta != null && Number.isFinite(Number(row.movementDelta))) {
    return Number(row.movementDelta);
  }
  if (row?.delta7d != null && Number.isFinite(Number(row.delta7d))) {
    return Number(row.delta7d);
  }
  if (row?.trendDelta7d != null && Number.isFinite(Number(row.trendDelta7d))) {
    return Number(row.trendDelta7d);
  }
  const slug = String(row?.slug || "").toLowerCase();
  if (deltaBySlug && slug && deltaBySlug.has(slug)) return deltaBySlug.get(slug);
  if (deltaBySlug && typeof deltaBySlug.get === "function" && slug) return deltaBySlug.get(slug);
  return null;
}

function attachNarrativeToRow(row, visitLogs, deltaBySlug, asOf = new Date()) {
  const visit =
    row.visitStart && row.visitEnd
      ? { visitStart: row.visitStart, visitEnd: row.visitEnd }
      : latestCompletedVisitForSlug(row.slug, visitLogs, asOf);
  const narrative = buildMovementNarrative({
    delta7d: resolveDeltaForSlug(row, deltaBySlug),
    visitStart: visit?.visitStart,
    visitEnd: visit?.visitEnd,
  });
  return narrative ? { ...row, movementNarrative: narrative } : row;
}

function enrichVisitRecapRows(rows, visitLogs, deltaBySlug, asOf = new Date()) {
  return (rows || []).map((row) => attachNarrativeToRow(row, visitLogs, deltaBySlug, asOf));
}

function enrichFlipWatchRows(rows, visitLogs, deltaBySlug, asOf = new Date()) {
  return (rows || []).map((row) => attachNarrativeToRow(row, visitLogs, deltaBySlug, asOf));
}

function buildNarrativeFeed(
  players,
  visitLogs,
  deltaBySlug,
  { limit = 6, asOf = new Date(), allowTrendOnly = false } = {}
) {
  const out = [];
  for (const player of players || []) {
    const visit =
      player.visitStart && player.visitEnd
        ? { visitStart: player.visitStart, visitEnd: player.visitEnd }
        : latestCompletedVisitForSlug(player.slug, visitLogs, asOf);
    if (!visit && !allowTrendOnly) continue;
    const delta = resolveDeltaForSlug(player, deltaBySlug);
    const movementNarrative = buildMovementNarrative({
      delta7d: delta,
      visitStart: visit?.visitStart,
      visitEnd: visit?.visitEnd,
    });
    if (!movementNarrative) continue;
    out.push({
      slug: player.slug,
      name: player.name,
      movementNarrative,
      delta7d: delta,
      trendOnly: !visit,
    });
  }
  return out
    .sort((a, b) => Math.abs(b.delta7d ?? 0) - Math.abs(a.delta7d ?? 0))
    .slice(0, limit);
}

module.exports = {
  buildMovementNarrative,
  latestCompletedVisitForSlug,
  enrichVisitRecapRows,
  enrichFlipWatchRows,
  buildNarrativeFeed,
};