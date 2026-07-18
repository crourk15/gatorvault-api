/**
 * On3 RPM UF % for allowlist / Closing Class / Lab-promoted targets.
 * Also backfills store ufRpmPct + competitors so Lab logos match curated 2028 targets.
 */
const fs = require("fs");
const path = require("path");
const on3 = require("./on3-recruit-client");
const { buildOn3ProfileUrl } = require("./on3-urls");
const { toPercent } = require("./uf-probability-utils");

const DATA_PATH = path.join(__dirname, "..", "data", "war-room", "on3-rpm-allowlist.json");
const DEFAULT_CLASS_YEAR = 2027;

function boardPathForClassYear(classYear) {
  return path.join(__dirname, "..", "data", "recruiting", `${classYear}-target-board.json`);
}

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

function loadTargetBoard(classYear = DEFAULT_CLASS_YEAR) {
  const year = Number(classYear) || DEFAULT_CLASS_YEAR;
  const bySlug = new Map();

  const add = (row) => {
    const slug = String(row?.slug || "").toLowerCase();
    if (!slug) return;
    const prev = bySlug.get(slug) || { slug };
    bySlug.set(slug, {
      ...prev,
      ...row,
      slug,
      name: row.name || prev.name || null,
      classYear: year,
    });
  };

  try {
    const doc = JSON.parse(fs.readFileSync(boardPathForClassYear(year), "utf8"));
    for (const t of doc.targets || []) add(t);
  } catch {
    /* board file optional */
  }

  try {
    const { getAllowlistSet } = require("./recruiting-target-allowlist");
    const { loadTargetBoardBySlug } = require("./target-board-path");
    const board = loadTargetBoardBySlug(year);
    for (const slug of getAllowlistSet(year)) {
      add(board.get(String(slug).toLowerCase()) || { slug });
    }
  } catch {
    /* allowlist optional */
  }

  // Closing Class remaining Florida board (2027).
  if (year === 2027) {
    try {
      const { SNAPSHOT_PATH } = require("./uf-closing-board-247");
      const board = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, "utf8"));
      for (const row of board.open || []) {
        add({ slug: row.slug, name: row.name, stars: row.stars });
      }
    } catch {
      /* closing board optional */
    }
  }

  return [...bySlug.values()];
}

function entryBySlug(doc, slug) {
  const key = String(slug || "").toLowerCase();
  return (doc.entries || []).find((row) => String(row.playerSlug || "").toLowerCase() === key) || null;
}

function resolveUfPctFromProfile(profile, classYear = DEFAULT_CLASS_YEAR) {
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

async function persistRpmToRecruitingStore(slug, classYear, profile, ufPct) {
  if (!slug || !profile || profile.error) return { ok: false, reason: "no_profile" };
  try {
    const recruitingStore = require("./recruiting-store");
    const { profilePatchFromOn3 } = require("./allowlist-target-sync");
    const existing = await recruitingStore.getPlayerBySlug(slug);
    if (!existing && !profile.name) return { ok: false, reason: "missing_player" };

    const patch = profilePatchFromOn3(profile, classYear);
    let onClosingBoard = false;
    try {
      const { SNAPSHOT_PATH, BOARD_SOURCE, isLiveUfBoardTarget } = require("./uf-closing-board-247");
      if (isLiveUfBoardTarget(existing) || existing?.boardSource === BOARD_SOURCE) {
        onClosingBoard = true;
      } else {
        const board = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, "utf8"));
        onClosingBoard = (board.open || []).some(
          (row) => String(row.slug || "").toLowerCase() === String(slug).toLowerCase()
        );
      }
    } catch {
      onClosingBoard =
        existing?.boardSource === "247-uf-board-sync" ||
        String(existing?.on3Source || "").includes("247-uf-board-sync");
    }
    const closingBoardSource = onClosingBoard
      ? "247-uf-board-sync"
      : existing?.boardSource || null;

    const merged = {
      ...(existing || {}),
      slug,
      name: patch.name || existing?.name || profile.name || slug,
      classYear: existing?.classYear || classYear,
      pos: patch.pos || existing?.pos || profile.pos || "ATH",
      category: existing?.category || "target",
      status: existing?.status || "uncommitted",
      ufRpmPct: patch.ufRpmPct ?? ufPct ?? existing?.ufRpmPct ?? null,
      competitors: patch.competitors?.length ? patch.competitors : existing?.competitors || [],
      on3TopTeams: patch.on3TopTeams || existing?.on3TopTeams || null,
      topTeams: patch.topTeams || existing?.topTeams || null,
      on3Slug: patch.on3Slug || existing?.on3Slug || null,
      on3Id: patch.on3Id || existing?.on3Id || null,
      on3ProfileUrl: patch.on3ProfileUrl || existing?.on3ProfileUrl || null,
      boardSource: closingBoardSource,
      on3Source: patch.on3Source || existing?.on3Source || "on3-rpm-allowlist",
      updatedAt: new Date().toISOString(),
    };

    if (patch.offers?.length) merged.offers = patch.offers;
    if (patch.stars != null) merged.stars = patch.stars;
    if (patch.school) merged.school = patch.school;

    await recruitingStore.upsertPlayer(merged);
    return {
      ok: true,
      ufRpmPct: merged.ufRpmPct,
      competitors: (merged.competitors || []).length,
    };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

async function syncAllowlistOn3Rpm(options = {}) {
  const dryRun = Boolean(options.dryRun);
  const classYear = options.classYear || DEFAULT_CLASS_YEAR;
  const rivalsOnly = require("./uf-probability-utils").loadRivalsOnlyUfPctBySlug();
  const recruitingStore = require("./recruiting-store");
  const doc = readDoc();
  const targets = loadTargetBoard(classYear);
  const results = [];
  const limit = Math.max(1, parseInt(process.env.ON3_RPM_SYNC_CONCURRENCY || "2", 10) || 2);

  const jobs = targets.map((target) => async () => {
    const slug = String(target.slug || "").toLowerCase();
    if (!slug) return null;
    if (rivalsOnly.has(slug)) {
      return { slug, skipped: true, reason: "rivals_pm_present" };
    }

    const existingPlayer =
      recruitingStore.findBySlug(slug) ||
      (await recruitingStore.getPlayerBySlug(slug).catch(() => null));
    const recruitSlug = resolveRecruitSlugForTarget(target, existingPlayer);
    const existing = entryBySlug(doc, slug);
    let ufPct = null;
    let profile = null;
    const profileUrl = existing?.profileUrl || buildOn3ProfileUrl(existingPlayer || target);
    let fetchError = null;
    let storePatch = null;

    if (recruitSlug && options.fetch !== false) {
      profile = await on3.fetchRecruitProfile(recruitSlug);
      ufPct = resolveUfPctFromProfile(profile, classYear);
      if (profile?.error) fetchError = profile.error;
      if (!dryRun && profile && !profile.error) {
        storePatch = await persistRpmToRecruitingStore(slug, classYear, profile, ufPct);
      }
    }

    if (ufPct == null) {
      const fallback =
        target.ufProbability ??
        existingPlayer?.ufRpmPct ??
        existingPlayer?.ufProbability ??
        existingPlayer?.futurecastProbability;
      ufPct = fallback != null ? toPercent(fallback) : null;
    }

    if (ufPct == null || ufPct <= 0) {
      return { slug, skipped: true, reason: fetchError || "no_uf_pct", storePatch };
    }

    const priorUfPct = existing?.ufPct ?? null;
    const entry = {
      playerSlug: slug,
      playerName: target.name || existingPlayer?.name || slug,
      classYear,
      ufPct,
      priorUfPct: priorUfPct != null ? priorUfPct : null,
      profileUrl,
      source: "On3 RPM — UF",
      syncedAt: new Date().toISOString(),
    };

    if (!dryRun) {
      const idx = doc.entries.findIndex(
        (row) => String(row.playerSlug || "").toLowerCase() === slug
      );
      if (idx >= 0) doc.entries[idx] = { ...doc.entries[idx], ...entry };
      else doc.entries.push(entry);
    }

    return {
      slug,
      ufPct,
      priorUfPct,
      dryRun,
      fetchError,
      competitors: storePatch?.competitors ?? null,
      storePatched: Boolean(storePatch?.ok),
    };
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
    storePatched: results.filter((r) => r.storePatched).length,
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
  loadTargetBoard,
  resolveUfPctFromProfile,
  syncAllowlistOn3Rpm,
  loadOn3RpmUfPctBySlug,
  persistRpmToRecruitingStore,
};
