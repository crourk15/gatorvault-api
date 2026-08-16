/**
 * Live FutureCast intel alerts from verified visit logs + flip watch (no DB write).
 */
const fs = require("fs");
const path = require("path");
const store = require("./recruiting-store");
const visitLogStore = require("./recruiting-visit-log-store");
const {
  buildVerifiedVisitRecapRows,
  buildVerifiedVisitIntelRows,
  buildVerifiedVisitActivityRows,
  applyVerifiedVisitFields,
} = require("./visit-intel-utils");
const { formatUfProbabilityDisplay } = require("./uf-probability-utils");
const { buildFlipWatchWithUfContext } = require("./visit-intel-flip-context");
const { loadFuturecastPredictionBySlug } = require("./load-futurecast-prediction-by-slug");
const intelStore = require("./recruiting-intel-store");

const PREDICTOR_NAMES = { system: "FutureCast Model" };
const FUTURECAST_CLASS_YEAR = 2027;
const {
  getAllowlistSet,
  canonicalTargetSlug,
} = require("./recruiting-target-allowlist");

const TARGET_BOARD_PATHS = [
  path.join(__dirname, "../data/recruiting/2027-target-board.json"),
  path.join(__dirname, "../data/recruiting/2028-target-board.json"),
];

function isGatorVaultBoardSlug(slug) {
  const key = canonicalTargetSlug(slug);
  if (!key) return false;
  return getAllowlistSet(2027).has(key) || getAllowlistSet(2028).has(key);
}

function loadTargetBoardEntries() {
  const out = [];
  const seen = new Set();
  for (const boardPath of TARGET_BOARD_PATHS) {
    try {
      const doc = JSON.parse(fs.readFileSync(boardPath, "utf8"));
      for (const target of Array.isArray(doc.targets) ? doc.targets : []) {
        const slug = canonicalTargetSlug(target?.slug);
        if (!slug || seen.has(slug) || !isGatorVaultBoardSlug(slug)) continue;
        seen.add(slug);
        out.push(target);
      }
    } catch {
      /* optional board file */
    }
  }
  return out;
}

function loadRecruitingBySlug() {
  const map = new Map();
  try {
    const rows = JSON.parse(
      fs.readFileSync(path.join(__dirname, "../data/recruiting/players.json"), "utf8")
    );
    for (const row of rows || []) {
      if (row?.slug) map.set(String(row.slug).toLowerCase(), row);
    }
  } catch {
    /* optional */
  }
  return map;
}

function loadTargetSeedBySlug(entries) {
  const map = new Map();
  for (const target of entries || []) {
    if (target?.slug) map.set(target.slug, target);
  }
  return map;
}

function resolveCommittedTo(target, recruiting) {
  return (
    target?.committedTo ||
    recruiting?.committedTo ||
    recruiting?.commitment ||
    null
  );
}

function alertRow({ id, slug, name, type, message, createdAt, category }) {
  return {
    id,
    playerId: slug,
    playerSlug: slug,
    playerName: name,
    type,
    message,
    createdAt: createdAt || new Date().toISOString(),
    seen: false,
    category,
  };
}

function formatFlipWatchUf(row) {
  return formatUfProbabilityDisplay({
    value: row.ufProbability,
    label: row.ufProbabilityLabel,
  });
}

function assembleIntelAlerts({
  asOf,
  seedEntries,
  recruitingBySlug,
  storeBySlug,
  predictionBySlug,
}) {
  const targetSeedBySlug = loadTargetSeedBySlug(seedEntries);
  const prioritySlugs = seedEntries.map((t) => t.slug).filter(Boolean);
  const visitLogs = visitLogStore.loadDoc().items || [];
  const { buildResolveSlugUfMeta, loadUfPctPredictorsBySlug } = require("./visit-intel-flip-context");
  const resolveSlugUfMeta = buildResolveSlugUfMeta({
    recruitingBySlug,
    targetSeedBySlug,
    predictorsBySlug: loadUfPctPredictorsBySlug(),
    predictionBySlug,
    predictorNames: PREDICTOR_NAMES,
  });

  const players = seedEntries.map((target) => {
    const slug = String(target.slug || "");
    const key = slug.toLowerCase();
    const recruiting = recruitingBySlug.get(key);
    const stored = storeBySlug.get(key);
    const committedTo = resolveCommittedTo(stored || target, recruiting);
    const resolvedUf = resolveSlugUfMeta(slug);
    const base = {
      slug: target.slug,
      name: target.name,
      committedTo,
      ufProbability: resolvedUf.value,
      ufProbabilityLabel: resolvedUf.label,
      ufProbabilityLowConfidence: resolvedUf.lowConfidence,
      visitStart: stored?.visitStart ?? target.visitStart ?? null,
      visitEnd: stored?.visitEnd ?? target.visitEnd ?? null,
      ufOvStatus: stored?.ufOvStatus ?? target.ufOvStatus ?? null,
    };
    return applyVerifiedVisitFields(base, visitLogs);
  });

  const visitRecap = buildVerifiedVisitRecapRows(players, visitLogs, asOf, {
    limit: 12,
    prioritySlugs,
  });

  // Verified unofficial visits for board targets — without these Board Intel looks frozen all summer.
  const visitUv = buildVerifiedVisitActivityRows(players, visitLogs, asOf, {
    limit: 12,
    prioritySlugs,
    kinds: ["unofficial"],
  });

  const { flipWatch } = buildFlipWatchWithUfContext({
    players,
    visitRecap,
    visitLogs,
    asOf,
    limit: 8,
    intelRows: intelStore.loadIntelDoc().items || [],
    recruitingBySlug,
    targetSeedBySlug,
    predictionBySlug,
    predictorNames: PREDICTOR_NAMES,
  });

  const visitIntel = buildVerifiedVisitIntelRows(players, visitLogs);

  const today = asOf.toISOString().slice(0, 10);
  const upcoming = visitIntel.filter((p) => {
    if (p.visitVerified === false) return false;
    if (String(p.ufOvStatus || "").toLowerCase() === "completed") return false;
    if (p.visitStart && String(p.visitStart).slice(0, 10) < today) return false;
    return Boolean(p.visitStart) || p.visitVerified === true;
  });

  const alerts = [];

  function alertTime(preferred, fallback) {
    const raw = preferred || fallback || asOf.toISOString();
    const t = Date.parse(raw);
    // Never use a future visit-start as "createdAt" — that prints "Just now" forever.
    if (Number.isFinite(t) && t > asOf.getTime() + 60_000) {
      return asOf.toISOString();
    }
    return typeof raw === "string" ? raw : asOf.toISOString();
  }

  for (const row of flipWatch) {
    alerts.push(
      alertRow({
        id: `flip-${row.slug}`,
        slug: row.slug,
        name: row.name,
        type: "flip_watch",
        message: `${row.name} (${row.committedShort}) — Flip score ${row.flipScore ?? "—"} · UF ${formatFlipWatchUf(row)}`,
        createdAt: alertTime(row.reportedAt, row.visitEnd || row.visitStart),
        category: "Flip Watch",
      })
    );
  }

  // One UV card per player (newest reported) — avoid beat+On3 duplicate noise.
  const uvSeen = new Set();
  const uvDeduped = [];
  for (const row of visitUv) {
    const key = String(row.slug || "").toLowerCase();
    if (!key || uvSeen.has(key)) continue;
    uvSeen.add(key);
    uvDeduped.push(row);
    if (uvDeduped.length >= 8) break;
  }
  for (const row of uvDeduped) {
    alerts.push(
      alertRow({
        id: `uv-${row.slug}-${row.visitStart}`,
        slug: row.slug,
        name: row.name,
        type: "visit_uv",
        message: `${row.name} — UF unofficial visit (${row.visitStart})`,
        createdAt: alertTime(row.reportedAt, row.visitStart),
        category: "Visit",
      })
    );
  }

  for (const row of visitRecap.slice(0, 6)) {
    alerts.push(
      alertRow({
        id: `recap-${row.slug}-${row.visitStart}`,
        slug: row.slug,
        name: row.name,
        type: "visit_recap",
        message: `${row.name} — verified UF OV completed (${row.visitStart}${row.visitEnd ? `–${row.visitEnd}` : ""})`,
        createdAt: alertTime(row.reportedAt, row.visitEnd || row.visitStart),
        category: "Visit",
      })
    );
  }

  for (const p of upcoming.slice(0, 4)) {
    alerts.push(
      alertRow({
        id: `ov-up-${p.slug}`,
        slug: p.slug,
        name: p.name,
        type: "visit_upcoming",
        message: `Upcoming UF OV: ${p.name} (${p.visitStart || "TBD"}${p.visitEnd ? `–${p.visitEnd}` : ""})`,
        createdAt: alertTime(p.visitReportedAt || p.reportedAt, asOf.toISOString()),
        category: "Visit",
      })
    );
  }

  return alerts;
}

/** Sync Board Intel for soft deferred GET (no DB / store wake). */
function buildFutureCastIntelAlertsSync(options = {}) {
  const asOf = options.asOf ? new Date(options.asOf) : new Date();
  return assembleIntelAlerts({
    asOf,
    seedEntries: loadTargetBoardEntries(),
    recruitingBySlug: loadRecruitingBySlug(),
    storeBySlug: new Map(),
    predictionBySlug: new Map(),
  });
}

async function buildFutureCastIntelAlerts(options = {}) {
  const asOf = options.asOf ? new Date(options.asOf) : new Date();
  const seedEntries = loadTargetBoardEntries();
  const recruitingBySlug = loadRecruitingBySlug();

  let storeBySlug = new Map();
  try {
    const storePlayers = await store.getAllPlayers();
    storeBySlug = new Map(
      storePlayers.filter((p) => p.slug).map((p) => [String(p.slug).toLowerCase(), p])
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[futurecast-intel-alerts] store load skipped:", message);
  }

  // Predictions are enrichment only — never block Board Intel on DB wake/failure.
  let predictionBySlug = new Map();
  try {
    predictionBySlug = await loadFuturecastPredictionBySlug(FUTURECAST_CLASS_YEAR);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[futurecast-intel-alerts] prediction load skipped:", message);
  }

  return assembleIntelAlerts({
    asOf,
    seedEntries,
    recruitingBySlug,
    storeBySlug,
    predictionBySlug,
  });
}

module.exports = {
  buildFutureCastIntelAlerts,
  buildFutureCastIntelAlertsSync,
};