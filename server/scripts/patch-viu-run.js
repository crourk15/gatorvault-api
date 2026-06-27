const fs = require("fs");
const path = require("path");
process.chdir(path.join(__dirname, "..", ".."));

if (process.argv[2] === "write-phase-b-utils") {
  const root = path.join(__dirname, "..");
  const uf = `/**
 * UF probability truth chain — model → store → Rivals PM → labeled estimate.
 */
function toPercent(value) {
  if (value == null || Number.isNaN(Number(value))) return 0;
  const n = Number(value);
  if (n <= 0) return 0;
  return n <= 1 ? Math.round(n * 100) : Math.round(n);
}

function pickRivalsPmScore(predictors) {
  for (const p of predictors || []) {
    const name = String(p?.name || "").toLowerCase();
    if (name.includes("rivals") && Number(p.score) > 0) {
      return toPercent(p.score);
    }
  }
  return 0;
}

function resolveUfProbability({
  modelPct = 0,
  storePct = 0,
  predictors = [],
  stars = null,
  headliner = false,
} = {}) {
  const model = toPercent(modelPct);
  const store = toPercent(storePct);
  const rivals = pickRivalsPmScore(predictors);

  if (model > 0) {
    return { value: model, source: "model", label: null, lowConfidence: false };
  }
  if (store > 0) {
    return { value: store, source: "store", label: null, lowConfidence: false };
  }
  if (rivals > 0) {
    return { value: rivals, source: "rivals_pm", label: "Rivals PM", lowConfidence: false };
  }
  if (headliner || (stars != null && Number(stars) >= 4)) {
    return { value: 25, source: "estimate", label: "Est.", lowConfidence: true };
  }
  if (stars != null && Number(stars) >= 3) {
    return { value: 15, source: "estimate", label: "Est.", lowConfidence: true };
  }
  return { value: 0, source: "unknown", label: "Est.", lowConfidence: true };
}

function formatUfProbabilityDisplay(resolved) {
  if (!resolved || resolved.value == null) return "TBD";
  const pct = Math.round(resolved.value);
  if (resolved.label) return \`\${resolved.label} \${pct}%\`;
  return \`\${pct}%\`;
}

module.exports = {
  toPercent,
  pickRivalsPmScore,
  resolveUfProbability,
  formatUfProbabilityDisplay,
};
`;
  const flip = `/**
 * Flip Watch — committed elsewhere + verified UF official visit completed.
 */
const { formatVisitSourceLabel } = require("./visit-intel-utils");

function isFloridaCommit(school) {
  return /\\bflorida\\b|\\bgators\\b|\\buf\\b/i.test(String(school || ""));
}

function shortSchoolName(school) {
  const raw = String(school || "").trim();
  if (!raw) return "Other";
  return raw.replace(/\\bUniversity\\b/gi, "").trim().split(/\\s+/)[0] || raw;
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
`;
  fs.writeFileSync(path.join(root, "lib/uf-probability-utils.js"), uf, "utf8");
  fs.writeFileSync(path.join(root, "lib/flip-watch-utils.js"), flip, "utf8");
  console.log("wrote phase-b utils");
  process.exit(0);
}

if (process.argv[2] === "fix-uf-probability-fs-path") {
  const ufPath = path.join(__dirname, "..", "lib/uf-probability-utils.js");
  let uf = fs.readFileSync(ufPath, "utf8");
  if (!uf.includes("require('node:fs')") && !uf.includes('require("node:fs")')) {
    uf = uf.replace(
      "function toPercent(value)",
      "const fs = require('node:fs');\nconst path = require('node:path');\n\nfunction toPercent(value)"
    );
    fs.writeFileSync(ufPath, uf, "utf8");
    console.log("patched fs/path requires");
  } else {
    console.log("already patched");
  }
  process.exit(0);
}

if (process.argv[2] === "patch-lab-truth-fix") {
  const root = path.join(__dirname, "..");
  const ufPath = path.join(root, "lib/uf-probability-utils.js");
  let uf = fs.readFileSync(ufPath, "utf8");
  if (!uf.includes("loadRivalsUfPctBySlug")) {
    uf = uf.replace(
      "module.exports = {",
      `function isFloridaSchool(name) {
  return /\\bflorida\\b|\\bgators\\b/i.test(String(name || ""));
}

function loadRivalsUfPctBySlug(predictionsPath) {
  const file =
    predictionsPath ||
    path.join(__dirname, "../data/war-room/rivals-predictions.json");
  const map = new Map();
  try {
    const doc = JSON.parse(fs.readFileSync(file, "utf8"));
    for (const row of doc.predictions || []) {
      if (!isFloridaSchool(row.predictionSchool)) continue;
      const slug = String(row.playerSlug || "").toLowerCase();
      if (!slug) continue;
      const conf = Number(row.confidence) || 0;
      map.set(slug, Math.max(map.get(slug) || 0, conf));
    }
  } catch {
    /* optional */
  }
  return map;
}

module.exports = {`
    );
    uf = uf.replace(
      "  formatUfProbabilityDisplay,\n};",
      "  formatUfProbabilityDisplay,\n  isFloridaSchool,\n  loadRivalsUfPctBySlug,\n};"
    );
    fs.writeFileSync(ufPath, uf, "utf8");
  }

  const flip = `/**
 * Flip Watch — committed elsewhere + verified UF official visit completed.
 */
const {
  formatVisitSourceLabel,
  getVerifiedFloridaVisitWindow,
  todayYmd,
} = require("./visit-intel-utils");

function isFloridaCommit(school) {
  return /\\bflorida\\b|\\bgators\\b|\\buf\\b/i.test(String(school || ""));
}

function shortSchoolName(school) {
  const raw = String(school || "").trim();
  if (!raw) return "Other";
  return raw.replace(/\\bUniversity\\b/gi, "").trim().split(/\\s+/)[0] || raw;
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
`;
  fs.writeFileSync(path.join(root, "lib/flip-watch-utils.js"), flip, "utf8");
  console.log("patched lab truth fix");
  process.exit(0);
}

const p = "server/lib/visit-intel-utils.js";
let s = fs.readFileSync(p, "utf8");
if (s.includes("getVisitIntelBoardSnapshot")) { console.log("already"); process.exit(0); }
const block = `
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
  const limit = opts.limit || 8;
  const classYear = opts.classYear || 2027;
  const recap = listRecentVerifiedFloridaOfficialVisits(visitLogs, { classYear, limit: limit * 2, asOf }).filter((row) => row.completed);
  const playerBySlug = new Map((players || []).map((pl) => [String(pl.slug || "").toLowerCase(), pl]));
  return recap.slice(0, limit).map((row) => {
    const player = playerBySlug.get(String(row.slug || "").toLowerCase());
    return { slug: row.slug, name: row.name || player?.name || row.slug, visitStart: row.visitStart, visitEnd: row.visitEnd, visitSource: row.source, visitSourceLabel: formatVisitSourceLabel(row.source), ufProbability: player?.ufProbability ?? null };
  });
}

function getVisitIntelBoardSnapshot(visitLogs, asOf = new Date()) {
  return { upcomingCount: countVerifiedUpcomingVisits(visitLogs, asOf), recapCount: countVerifiedCompletedVisits(visitLogs, asOf) };
}
`;
s = s.replace("module.exports = {", block + "module.exports = {");
s = s.replace(/  listRecentVerifiedFloridaOfficialVisits,\r?\n};/, "  listRecentVerifiedFloridaOfficialVisits,\r\n  formatVisitSourceLabel,\r\n  countVerifiedUpcomingVisits,\r\n  countVerifiedCompletedVisits,\r\n  buildVerifiedVisitRecapRows,\r\n  getVisitIntelBoardSnapshot,\r\n};");
s = s.replace(/    visitSource: verified.source,\r?\n  };/, "    visitSource: verified.source,\r\n    visitSourceLabel: formatVisitSourceLabel(verified.source),\r\n  };");
s = s.replace(/      visitSource: null,\r?\n    };/, "      visitSource: null,\r\n      visitSourceLabel: null,\r\n    };");
fs.writeFileSync(p, s, { encoding: "utf8" });
const u = require("./server/lib/visit-intel-utils");
console.log("patched", typeof u.getVisitIntelBoardSnapshot);
