/**
 * Daily UF % snapshots for allowlist targets — powers 7d deltas + movement narratives.
 */
const fs = require("fs");
const path = require("path");

const SNAPSHOT_PATH = path.join(__dirname, "..", "data", "futurecast", "uf-trend-snapshots.json");
const MAX_DAYS_PER_SLUG = 45;
const DELTA_WINDOW_DAYS = 7;

function readDoc() {
  try {
    const raw = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, "utf8"));
    return {
      version: 1,
      updatedAt: raw.updatedAt || null,
      snapshots: raw.snapshots && typeof raw.snapshots === "object" ? raw.snapshots : {},
    };
  } catch {
    return { version: 1, updatedAt: null, snapshots: {} };
  }
}

function writeDoc(doc) {
  fs.mkdirSync(path.dirname(SNAPSHOT_PATH), { recursive: true });
  doc.updatedAt = new Date().toISOString();
  fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(doc, null, 2));
}

function ymd(input = new Date()) {
  const d = input instanceof Date ? input : new Date(input);
  return d.toISOString().slice(0, 10);
}

function daysAgoYmd(days, asOf = new Date()) {
  const d = new Date(asOf);
  d.setUTCDate(d.getUTCDate() - Math.max(0, Math.floor(days)));
  return ymd(d);
}

function slugKey(slug) {
  return String(slug || "").toLowerCase();
}

function clampPct(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return null;
  return Math.min(100, Math.max(0, n));
}

function listSnapshots(slug) {
  const doc = readDoc();
  const rows = doc.snapshots[slugKey(slug)] || [];
  return rows.slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

function upsertSnapshot(slug, ufPct, dateYmd) {
  const pct = clampPct(ufPct);
  const date = String(dateYmd || ymd()).slice(0, 10);
  if (pct == null || !date) return false;

  const doc = readDoc();
  const key = slugKey(slug);
  const rows = doc.snapshots[key] || [];
  const idx = rows.findIndex((row) => row.date === date);
  const next = { date, ufPct: pct };
  if (idx >= 0) rows[idx] = { ...rows[idx], ...next };
  else rows.push(next);
  rows.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  doc.snapshots[key] = rows.slice(-MAX_DAYS_PER_SLUG);
  writeDoc(doc);
  return true;
}

function resolveLatestUfPct(slug, asOf = new Date()) {
  const today = ymd(asOf);
  const rows = listSnapshots(slug).filter((row) => row.date <= today);
  if (!rows.length) return null;
  return rows[rows.length - 1].ufPct;
}

function resolveUfPct7dAgo(slug, asOf = new Date()) {
  const cutoff = daysAgoYmd(DELTA_WINDOW_DAYS, asOf);
  const rows = listSnapshots(slug).filter((row) => row.date <= cutoff);
  if (rows.length) return rows[rows.length - 1].ufPct;
  const all = listSnapshots(slug);
  return all.length ? all[0].ufPct : null;
}

function computeDelta7d(slug, asOf = new Date()) {
  const now = resolveLatestUfPct(slug, asOf);
  const ago = resolveUfPct7dAgo(slug, asOf);
  if (now == null || ago == null) return null;
  return Math.round((now - ago) * 10) / 10;
}

const TREND_HISTORY_DAYS = 30;

function buildTrendHistoryForSlug(slug, { days = TREND_HISTORY_DAYS, asOf = new Date() } = {}) {
  const cutoff = daysAgoYmd(days, asOf);
  const today = ymd(asOf);
  return listSnapshots(slug)
    .filter((row) => row.date >= cutoff && row.date <= today)
    .map((row) => ({ date: row.date, confidence: row.ufPct }));
}

function mergeTrendHistories(primary = [], supplement = []) {
  const byDate = new Map();
  for (const row of primary || []) {
    const date = String(row?.date || "").slice(0, 10);
    if (!date || !Number.isFinite(Number(row?.confidence))) continue;
    byDate.set(date, Math.round(Number(row.confidence)));
  }
  for (const row of supplement || []) {
    const date = String(row?.date || "").slice(0, 10);
    if (!date || !Number.isFinite(Number(row?.confidence))) continue;
    if (!byDate.has(date)) byDate.set(date, Math.round(Number(row.confidence)));
  }
  return [...byDate.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, confidence]) => ({ date, confidence }));
}

function buildDelta7dBySlug(slugs, asOf = new Date()) {
  const map = new Map();
  for (const slug of slugs || []) {
    const delta = computeDelta7d(slug, asOf);
    if (delta != null && Number.isFinite(delta)) {
      map.set(slugKey(slug), delta);
    }
  }
  return map;
}

function mergeDelta7dMaps(postgresMap, snapshotMap, slugs) {
  const out = new Map(postgresMap);
  for (const slug of slugs || []) {
    const key = slugKey(slug);
    const pg = out.get(slug) ?? out.get(key);
    const snap = snapshotMap.get(key);
    if (snap == null || !Number.isFinite(snap)) continue;
    if (pg == null || !Number.isFinite(pg) || Math.abs(pg) < 1) {
      out.set(slug, snap);
    }
  }
  return out;
}

function backfillBaseline(slug, { currentPct, priorPct, asOf = new Date() } = {}) {
  const current = clampPct(currentPct);
  const prior = clampPct(priorPct);
  if (current == null || prior == null) return false;
  upsertSnapshot(slug, prior, daysAgoYmd(DELTA_WINDOW_DAYS, asOf));
  upsertSnapshot(slug, current, ymd(asOf));
  return true;
}

const HEAT_CHECK_PATH = path.join(__dirname, "..", "data", "recruiting", "heat-check-history.json");
const POST_VISIT_DELTA_ESTIMATE = 6;

function slugFromHeatCheckKey(key) {
  return String(key || "")
    .toLowerCase()
    .replace(/-\d+$/, "");
}

function loadPostVisitRisingSlugs() {
  const slugs = new Set();
  try {
    const doc = JSON.parse(fs.readFileSync(HEAT_CHECK_PATH, "utf8"));
    const buckets = doc.history || doc.byPlayer || doc.players || {};
    for (const [key, entries] of Object.entries(buckets)) {
      for (const entry of entries || []) {
        if (entry.direction !== "rising") continue;
        const trigger = String(entry.trigger || "").toLowerCase();
        const school = String(entry.predictionSchool || "").toLowerCase();
        if (!trigger.includes("visit") && !trigger.includes("rpm_uf") && !school.includes("florida")) {
          continue;
        }
        slugs.add(slugKey(slugFromHeatCheckKey(key)));
      }
    }
  } catch {
    /* optional */
  }
  return slugs;
}

function loadCompletedOvTargetSlugs(targetSlugs, asOf = new Date()) {
  const slugs = new Set();
  try {
    const { getVerifiedFloridaVisitWindow, todayYmd } = require("./visit-intel-utils");
    const visitLogStore = require("./recruiting-visit-log-store");
    const allow = new Set((targetSlugs || []).map(slugKey));
    const today = todayYmd(asOf);
    for (const entry of visitLogStore.loadDoc().items || []) {
      const slug = slugKey(entry.playerSlug);
      if (!allow.has(slug)) continue;
      const window = getVerifiedFloridaVisitWindow(entry);
      if (!window || window.visitEnd >= today) continue;
      slugs.add(slug);
    }
  } catch {
    /* optional */
  }
  return slugs;
}

function inferPriorFromIntel(row, risingSlugs, completedOvSlugs) {
  if (row.priorUfPct != null && row.priorUfPct !== row.ufPct) return row.priorUfPct;
  const slug = slugKey(row.slug);
  if (risingSlugs.has(slug) || completedOvSlugs.has(slug)) {
    return Math.max(0, row.ufPct - POST_VISIT_DELTA_ESTIMATE);
  }
  return null;
}

async function syncPostgresSnapshot(playerId, dateYmd, ufPct) {
  if (!playerId) return { ok: false, skipped: true, reason: "no_player_id" };
  try {
    const { insertPredictionHistoryForDate } = require("../models/predictions");
    await insertPredictionHistoryForDate(playerId, dateYmd, ufPct);
    return { ok: true };
  } catch (err) {
    return { ok: false, skipped: true, reason: err.message };
  }
}

async function runDailyUfTrendSnapshot(options = {}) {
  const asOf = options.asOf ? new Date(options.asOf) : new Date();
  const dryRun = Boolean(options.dryRun);
  const { loadTargetSnapshots } = require("./uf-trend-snapshot-build");
  const rows = await loadTargetSnapshots();
  const dayKey = ymd(asOf);
  let written = 0;
  let postgresSynced = 0;
  const samples = [];

  for (const row of rows) {
    if (dryRun) {
      written += 1;
      if (samples.length < 5) samples.push({ slug: row.slug, ufPct: row.ufPct });
      continue;
    }
    if (upsertSnapshot(row.slug, row.ufPct, dayKey)) {
      written += 1;
      if (samples.length < 5) samples.push({ slug: row.slug, ufPct: row.ufPct });
    }
    const pg = await syncPostgresSnapshot(row.playerId, dayKey, row.ufPct);
    if (pg.ok) postgresSynced += 1;
  }

  return {
    ok: true,
    dryRun,
    dayKey,
    targetCount: rows.length,
    written,
    postgresSynced,
    samples,
  };
}

async function backfillUfTrendSnapshots(options = {}) {
  const asOf = options.asOf ? new Date(options.asOf) : new Date();
  const dryRun = Boolean(options.dryRun);
  const { loadTargetSnapshots } = require("./uf-trend-snapshot-build");
  const rows = await loadTargetSnapshots();
  let baselines = 0;
  let todayOnly = 0;

  let rollingBySlug = new Map();
  try {
    const { listRollingMovement } = require("../models/predictions");
    const rolling = await listRollingMovement({ class_year: 2027, lifecycle: "HS" });
    rollingBySlug = new Map(rolling.map((row) => [slugKey(row.slug), row]));
  } catch {
    /* postgres optional */
  }

  const risingSlugs = loadPostVisitRisingSlugs();
  const targetSlugKeys = rows.map((row) => row.slug);
  const completedOvSlugs = loadCompletedOvTargetSlugs(targetSlugKeys, asOf);

  for (const row of rows) {
    const rolling = rollingBySlug.get(row.slug);
    let prior = inferPriorFromIntel(row, risingSlugs, completedOvSlugs);
    if (rolling && Number.isFinite(Number(rolling.delta7d))) {
      prior = Math.round(row.ufPct - Number(rolling.delta7d));
    }
    if (prior != null && prior !== row.ufPct && Math.abs(row.ufPct - prior) >= 1) {
      if (!dryRun) backfillBaseline(row.slug, { currentPct: row.ufPct, priorPct: prior, asOf });
      baselines += 1;
      continue;
    }
    if (!dryRun) upsertSnapshot(row.slug, row.ufPct, ymd(asOf));
    todayOnly += 1;
  }

  return {
    ok: true,
    dryRun,
    dayKey: ymd(asOf),
    targetCount: rows.length,
    baselines,
    todayOnly,
  };
}

module.exports = {
  SNAPSHOT_PATH,
  DELTA_WINDOW_DAYS,
  TREND_HISTORY_DAYS,
  readDoc,
  upsertSnapshot,
  listSnapshots,
  computeDelta7d,
  buildDelta7dBySlug,
  buildTrendHistoryForSlug,
  mergeTrendHistories,
  mergeDelta7dMaps,
  backfillBaseline,
  runDailyUfTrendSnapshot,
  backfillUfTrendSnapshots,
};