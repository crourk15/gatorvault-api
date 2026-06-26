/**
 * On3 RPM UF % for allowlist targets missing Rivals PM (flip-watch / committed OVs).
 */
const fs = require("fs");
const path = require("path");
const on3 = require("./on3-recruit-client");
const { buildOn3ProfileUrl } = require("./on3-urls");
const { toPercent } = require("./uf-probability-utils");

const DATA_PATH = path.join(__dirname, "..", "data", "war-room", "on3-rpm-allowlist.json");
const BOARD_PATH = path.join(__dirname, "..", "data", "recruiting", "2027-target-board.json");
const CLASS_YEAR = 2027;

function readDoc() {
  try {
    const raw = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
    return {
      version: 1,
      updatedAt: raw.updatedAt || null,
      entries: Array.isArray(raw.entries) ? raw.entries : [],
    };
  } catch {
    return { version: 1, updatedAt: null, entries: [] };
  }
}

function writeDoc(doc) {
  fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
  doc.updatedAt = new Date().toISOString();
  fs.writeFileSync(DATA_PATH, JSON.stringify(doc, null, 2));
}

function loadTargetBoard() {
  try {
    const doc = JSON.parse(fs.readFileSync(BOARD_PATH, "utf8"));
    return doc.targets || [];
  } catch {
    return [];
  }
}

function entryBySlug(doc, slug) {
  const key = String(slug || "").toLowerCase();
  return (doc.entries || []).find((row) => String(row.playerSlug || "").toLowerCase() === key) || null;
}

function resolveUfPctFromProfile(profile, classYear = CLASS_YEAR) {
  if (!profile || profile.error) return null;
  const uf = on3.getFloridaTeam(profile.topTeams, classYear);
  const pct = uf?.prediction;
  if (pct == null || !Number.isFinite(Number(pct)) || Number(pct) <= 0) return null;
  return toPercent(pct);
}

function resolveRecruitSlugForTarget(target, recruiting) {
  const player = {
    slug: target.slug,
    name: target.name || recruiting?.name,
    on3Slug: recruiting?.on3Slug,
    on3Id: recruiting?.on3Id,
  };
  return on3.resolveRecruitSlug(player, new Map());
}

async function syncAllowlistOn3Rpm(options = {}) {
  const dryRun = Boolean(options.dryRun);
  const classYear = options.classYear || CLASS_YEAR;
  const rivalsOnly = require("./uf-probability-utils").loadRivalsOnlyUfPctBySlug();
  const recruitingStore = require("./recruiting-store");
  const doc = readDoc();
  const targets = loadTargetBoard();
  const results = [];
  const limit = Math.max(1, parseInt(process.env.ON3_RPM_SYNC_CONCURRENCY || "2", 10) || 2);

  const jobs = targets.map((target) => async () => {
    const slug = String(target.slug || "").toLowerCase();
    if (!slug) return null;
    if (rivalsOnly.has(slug)) {
      return { slug, skipped: true, reason: "rivals_pm_present" };
    }

    const recruiting = recruitingStore.findBySlug(slug);
    const recruitSlug = resolveRecruitSlugForTarget(target, recruiting);
    const existing = entryBySlug(doc, slug);
    let ufPct = null;
    const profileUrl = existing?.profileUrl || buildOn3ProfileUrl(recruiting || target);
    let fetchError = null;

    if (recruitSlug && options.fetch !== false) {
      const profile = await on3.fetchRecruitProfile(recruitSlug);
      ufPct = resolveUfPctFromProfile(profile, classYear);
      if (profile?.error) fetchError = profile.error;
    }

    if (ufPct == null) {
      const fallback =
        target.ufProbability ?? recruiting?.ufProbability ?? recruiting?.futurecastProbability;
      ufPct = fallback != null ? toPercent(fallback) : null;
    }

    if (ufPct == null || ufPct <= 0) {
      return { slug, skipped: true, reason: fetchError || "no_uf_pct" };
    }

    const priorUfPct = existing?.ufPct ?? null;
    const entry = {
      playerSlug: slug,
      playerName: target.name || recruiting?.name || slug,
      classYear,
      ufPct,
      priorUfPct: priorUfPct != null ? priorUfPct : null,
      profileUrl,
      source: "On3 RPM � UF",
      syncedAt: new Date().toISOString(),
    };

    if (!dryRun) {
      const idx = doc.entries.findIndex(
        (row) => String(row.playerSlug || "").toLowerCase() === slug
      );
      if (idx >= 0) doc.entries[idx] = { ...doc.entries[idx], ...entry };
      else doc.entries.push(entry);
    }

    return { slug, ufPct, priorUfPct, dryRun, fetchError };
  });

  const out = await on3.mapPool(jobs, limit, (fn) => fn());
  for (const row of out) {
    if (row) results.push(row);
  }

  if (!dryRun) writeDoc(doc);

  return {
    ok: true,
    dryRun,
    updated: results.filter((r) => r.ufPct != null && !r.skipped).length,
    skipped: results.filter((r) => r.skipped).length,
    results,
  };
}

function loadOn3RpmUfPctBySlug() {
  const map = new Map();
  const doc = readDoc();
  for (const row of doc.entries || []) {
    const slug = String(row.playerSlug || "").toLowerCase();
    if (!slug) continue;
    const conf = Number(row.ufPct ?? row.confidence) || 0;
    if (conf > 0) map.set(slug, conf);
  }
  return map;
}

module.exports = {
  DATA_PATH,
  readDoc,
  writeDoc,
  resolveUfPctFromProfile,
  syncAllowlistOn3Rpm,
  loadOn3RpmUfPctBySlug,
};
