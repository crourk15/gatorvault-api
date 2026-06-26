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
  applyVerifiedVisitFields,
} = require("./visit-intel-utils");
const { formatUfProbabilityDisplay } = require("./uf-probability-utils");
const { buildFlipWatchWithUfContext } = require("./visit-intel-flip-context");
const intelStore = require("./recruiting-intel-store");

const TARGET_BOARD_PATH = path.join(__dirname, "../data/recruiting/2027-target-board.json");

function loadTargetBoardEntries() {
  try {
    const doc = JSON.parse(fs.readFileSync(TARGET_BOARD_PATH, "utf8"));
    return Array.isArray(doc.targets) ? doc.targets : [];
  } catch {
    return [];
  }
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

async function buildFutureCastIntelAlerts(options = {}) {
  const asOf = options.asOf ? new Date(options.asOf) : new Date();
  const visitLogs = visitLogStore.loadDoc().items || [];
  const seedEntries = loadTargetBoardEntries();
  const recruitingBySlug = loadRecruitingBySlug();
  const targetSeedBySlug = loadTargetSeedBySlug(seedEntries);
  const prioritySlugs = seedEntries.map((t) => t.slug).filter(Boolean);

  const storePlayers = await store.getAllPlayers();
  const storeBySlug = new Map(
    storePlayers.filter((p) => p.slug).map((p) => [String(p.slug).toLowerCase(), p])
  );

  const { buildResolveSlugUfMeta, loadUfPctPredictorsBySlug } = require("./visit-intel-flip-context");
  const resolveSlugUfMeta = buildResolveSlugUfMeta({
    recruitingBySlug,
    targetSeedBySlug,
    predictorsBySlug: loadUfPctPredictorsBySlug(),
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

  const { flipWatch } = buildFlipWatchWithUfContext({
    players,
    visitRecap,
    visitLogs,
    asOf,
    limit: 8,
    intelRows: intelStore.loadIntelDoc().items || [],
    recruitingBySlug,
    targetSeedBySlug,
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

  for (const row of flipWatch) {
    alerts.push(
      alertRow({
        id: `flip-${row.slug}`,
        slug: row.slug,
        name: row.name,
        type: "flip_watch",
        message: `${row.name} (${row.committedShort}) — Flip score ${row.flipScore ?? "—"} · UF ${formatFlipWatchUf(row)}`,
        createdAt: row.visitEnd || row.visitStart,
        category: "Flip Watch",
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
        createdAt: row.visitEnd || row.visitStart,
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
        createdAt: p.visitStart || asOf.toISOString(),
        category: "Visit",
      })
    );
  }

  return alerts;
}

module.exports = { buildFutureCastIntelAlerts };
