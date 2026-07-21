/**
 * On3 RPM UF % sync — allowlist / Closing Class / Lab targets + UF-active inventory (Pass 4).
 * Gap-fills when Rivals PM is missing; writes ufRpmPct + competitor logos onto player cards.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const on3 = require('./on3-recruit-client');
const { buildOn3ProfileUrl } = require('./on3-urls');
const { toPercent } = require('./uf-probability-utils');

const DATA_PATH = path.join(__dirname, '..', 'data', 'war-room', 'on3-rpm-allowlist.json');
const DEFAULT_CLASS_YEAR = 2027;
const DEFAULT_CLASS_YEARS = [2027, 2028];

function boardPathForClassYear(classYear) {
  return path.join(__dirname, '..', 'data', 'recruiting', `${classYear}-target-board.json`);
}

function readDoc() {
  try {
    const raw = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
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

/**
 * Target rows for RPM sync: board file + allowlist + 2027 Closing Class snapshot.
 */
function loadTargetBoard(classYear = DEFAULT_CLASS_YEAR) {
  const year = Number(classYear) || DEFAULT_CLASS_YEAR;
  const bySlug = new Map();

  const add = (row) => {
    const slug = String(row?.slug || '').toLowerCase();
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
    const doc = JSON.parse(fs.readFileSync(boardPathForClassYear(year), 'utf8'));
    for (const t of doc.targets || []) add(t);
  } catch {
    /* board file optional */
  }

  try {
    const { getAllowlistSet } = require('./recruiting-target-allowlist');
    const { loadTargetBoardBySlug } = require('./target-board-path');
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
      const { SNAPSHOT_PATH } = require('./uf-closing-board-247');
      const board = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));
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
  const key = String(slug || '').toLowerCase();
  return (doc.entries || []).find((row) => String(row.playerSlug || '').toLowerCase() === key) || null;
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
    on3Slug: target.on3Slug || recruiting?.on3Slug,
    on3Id: target.on3Id || recruiting?.on3Id,
  };
  return on3.resolveRecruitSlug(player, new Map());
}

function normalizeScope(scope) {
  const s = String(scope || process.env.ON3_RPM_SYNC_SCOPE || 'all').toLowerCase();
  if (s === 'allowlist' || s === 'board') return 'allowlist';
  if (s === 'inventory') return 'inventory';
  return 'all';
}

function classYearsFromOptions(options = {}) {
  if (Array.isArray(options.classYears) && options.classYears.length) {
    return options.classYears.map((y) => parseInt(y, 10)).filter((y) => Number.isFinite(y));
  }
  if (options.classYear != null && Number.isFinite(Number(options.classYear))) {
    return [parseInt(options.classYear, 10)];
  }
  const fromEnv = String(process.env.ON3_RPM_CLASS_YEARS || '')
    .split(',')
    .map((y) => parseInt(y.trim(), 10))
    .filter((y) => Number.isFinite(y));
  return fromEnv.length ? fromEnv : DEFAULT_CLASS_YEARS.slice();
}

function collectAllowlistTargets(classYears) {
  const bySlug = new Map();
  for (const year of classYears) {
    for (const target of loadTargetBoard(year)) {
      const slug = String(target.slug || '').toLowerCase();
      if (!slug) continue;
      if (!bySlug.has(slug)) {
        bySlug.set(slug, {
          slug,
          name: target.name || slug,
          classYear: Number(target.classYear) || year,
          on3Slug: target.on3Slug || null,
          on3Id: target.on3Id || null,
          ufProbability: target.ufProbability,
          sourceBucket: 'allowlist',
        });
      }
    }
    // Admin allowlist extras for the year
    try {
      const { getAllowlistSet, CANONICAL_TARGET_NAMES } = require('./recruiting-target-allowlist');
      for (const slug of getAllowlistSet(year)) {
        const key = String(slug).toLowerCase();
        if (bySlug.has(key)) continue;
        bySlug.set(key, {
          slug: key,
          name: CANONICAL_TARGET_NAMES[key] || key,
          classYear: year,
          sourceBucket: 'allowlist',
        });
      }
    } catch {
      /* optional */
    }
  }
  return bySlug;
}

function collectInventoryTargets(classYears, { maxInventory = 80, players = null } = {}) {
  const { isActiveUfTarget } = require('./recruiting-target-filters');
  const bySlug = new Map();
  let list = Array.isArray(players) ? players : [];

  // Fallback: read players.json when caller did not pass a list (tests / cold helpers)
  if (!list.length) {
    try {
      const file = path.join(__dirname, '..', 'data', 'recruiting', 'players.json');
      const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
      list = Array.isArray(raw) ? raw : raw.players || [];
    } catch {
      list = [];
    }
  }

  const yearSet = new Set(classYears.map(Number));
  const ranked = [];
  for (const player of list) {
    const slug = String(player.slug || player.id || '').toLowerCase();
    if (!slug) continue;
    const year = parseInt(player.classYear || player.class_year, 10);
    if (!yearSet.has(year)) continue;
    if (!isActiveUfTarget(player)) continue;
    if (!player.on3Slug && !player.on3Id) continue;
    ranked.push({
      slug,
      name: player.name || slug,
      classYear: year,
      on3Slug: player.on3Slug || null,
      on3Id: player.on3Id || null,
      ufProbability: player.ufProbability,
      sourceBucket: 'inventory',
      _rank:
        (player.category === 'target' ? 100 : 0) +
        (Number(player.ufRpmPct) > 0 ? 40 : 0) +
        (player.inState ? 20 : 0) +
        (Number(player.stars) || 0) * 5,
    });
  }
  ranked.sort((a, b) => b._rank - a._rank);
  const cap = Math.max(1, parseInt(maxInventory, 10) || 80);
  for (const row of ranked.slice(0, cap)) {
    const { _rank, ...rest } = row;
    bySlug.set(rest.slug, rest);
  }
  return bySlug;
}

/**
 * Build deduped sync target list.
 * scope: allowlist | inventory | all
 */
function collectSyncTargets(options = {}) {
  const scope = normalizeScope(options.scope);
  const classYears = classYearsFromOptions(options);
  const maxInventory = Number(
    options.maxInventory || process.env.ON3_RPM_INVENTORY_MAX || 80
  );
  const bySlug = new Map();

  if (scope === 'allowlist' || scope === 'all') {
    for (const [slug, row] of collectAllowlistTargets(classYears)) {
      bySlug.set(slug, row);
    }
  }
  if (scope === 'inventory' || scope === 'all') {
    for (const [slug, row] of collectInventoryTargets(classYears, {
      maxInventory,
      players: options.players || null,
    })) {
      if (!bySlug.has(slug)) bySlug.set(slug, row);
      else {
        const prev = bySlug.get(slug);
        bySlug.set(slug, {
          ...prev,
          ...row,
          sourceBucket: prev.sourceBucket === 'allowlist' ? 'allowlist+inventory' : row.sourceBucket,
          name: prev.name || row.name,
          on3Slug: prev.on3Slug || row.on3Slug,
          on3Id: prev.on3Id || row.on3Id,
        });
      }
    }
  }
  return { targets: [...bySlug.values()], scope, classYears, maxInventory };
}

async function writeUfRpmToPlayer(slug, ufPct, meta = {}) {
  try {
    const recruitingStore = require('./recruiting-store');
    const existing =
      (typeof recruitingStore.findBySlug === 'function' && recruitingStore.findBySlug(slug)) ||
      (await recruitingStore.getPlayerBySlug(slug).catch(() => null));
    if (!existing) return { wrote: false, reason: 'player_missing' };
    const prior = existing.ufRpmPct != null ? Number(existing.ufRpmPct) : null;
    if (prior != null && prior === ufPct) return { wrote: false, reason: 'unchanged', prior };
    const patch = {
      ...existing,
      slug,
      ufRpmPct: ufPct,
      on3RpmSyncedAt: meta.syncedAt || new Date().toISOString(),
    };
    if (typeof recruitingStore.upsertPlayer === 'function') {
      await recruitingStore.upsertPlayer(patch);
    } else if (typeof recruitingStore.savePlayer === 'function') {
      await recruitingStore.savePlayer(patch);
    } else {
      return { wrote: false, reason: 'no_upsert' };
    }
    return { wrote: true, prior, ufPct };
  } catch (err) {
    return { wrote: false, error: err.message };
  }
}

/**
 * Persist On3 profile RPM + competitors onto the recruiting store so Closing Class /
 * Lab-promoted cards get the same logos as curated allowlist targets.
 */
async function persistRpmToRecruitingStore(slug, classYear, profile, ufPct) {
  if (!slug || !profile || profile.error) return { ok: false, reason: 'no_profile' };
  try {
    const recruitingStore = require('./recruiting-store');
    const { profilePatchFromOn3 } = require('./allowlist-target-sync');
    const existing = await recruitingStore.getPlayerBySlug(slug);
    if (!existing && !profile.name) return { ok: false, reason: 'missing_player' };

    const patch = profilePatchFromOn3(profile, classYear);
    let onClosingBoard = false;
    try {
      const { SNAPSHOT_PATH, BOARD_SOURCE, isLiveUfBoardTarget } = require('./uf-closing-board-247');
      if (isLiveUfBoardTarget(existing) || existing?.boardSource === BOARD_SOURCE) {
        onClosingBoard = true;
      } else {
        const board = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));
        onClosingBoard = (board.open || []).some(
          (row) => String(row.slug || '').toLowerCase() === String(slug).toLowerCase()
        );
      }
    } catch {
      onClosingBoard =
        existing?.boardSource === '247-uf-board-sync' ||
        String(existing?.on3Source || '').includes('247-uf-board-sync');
    }
    const closingBoardSource = onClosingBoard
      ? '247-uf-board-sync'
      : existing?.boardSource || null;

    const merged = {
      ...(existing || {}),
      slug,
      name: patch.name || existing?.name || profile.name || slug,
      classYear: existing?.classYear || classYear,
      pos: patch.pos || existing?.pos || profile.pos || 'ATH',
      category: existing?.category || 'target',
      status: existing?.status || 'uncommitted',
      ufRpmPct: patch.ufRpmPct ?? ufPct ?? existing?.ufRpmPct ?? null,
      competitors: patch.competitors?.length ? patch.competitors : existing?.competitors || [],
      on3TopTeams: patch.on3TopTeams || existing?.on3TopTeams || null,
      topTeams: patch.topTeams || existing?.topTeams || null,
      on3Slug: patch.on3Slug || existing?.on3Slug || null,
      on3Id: patch.on3Id || existing?.on3Id || null,
      on3ProfileUrl: patch.on3ProfileUrl || existing?.on3ProfileUrl || null,
      boardSource: closingBoardSource,
      on3Source: patch.on3Source || existing?.on3Source || 'on3-rpm-allowlist',
      on3RpmSyncedAt: new Date().toISOString(),
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
  const writePlayers = options.writePlayers !== false;
  const rivalsOnly = require('./uf-probability-utils').loadRivalsOnlyUfPctBySlug();
  const recruitingStore = require('./recruiting-store');
  const doc = readDoc();
  let players = options.players || null;
  if (!players && normalizeScope(options.scope) !== 'allowlist') {
    try {
      players = await recruitingStore.getAllPlayers();
    } catch {
      players = null;
    }
  }
  const collected = collectSyncTargets({ ...options, players });
  const targets = collected.targets;
  const results = [];
  const limit = Math.max(1, parseInt(process.env.ON3_RPM_SYNC_CONCURRENCY || '2', 10) || 2);

  const jobs = targets.map((target) => async () => {
    const slug = String(target.slug || '').toLowerCase();
    if (!slug) return null;
    const classYear = Number(target.classYear) || collected.classYears[0] || DEFAULT_CLASS_YEAR;

    if (rivalsOnly.has(slug)) {
      return { slug, skipped: true, reason: 'rivals_pm_present', sourceBucket: target.sourceBucket };
    }

    const existingPlayer =
      (typeof recruitingStore.findBySlug === 'function' && recruitingStore.findBySlug(slug)) ||
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
    }

    if (ufPct == null) {
      const fallback =
        target.ufProbability ??
        existingPlayer?.ufRpmPct ??
        existingPlayer?.ufProbability ??
        existingPlayer?.futurecastProbability;
      ufPct = fallback != null ? toPercent(fallback) : null;
    }

    // On3 403 / network misses: keep last-good RPM instead of wiping the board.
    let source = 'On3 RPM · UF';
    if (
      ufPct == null &&
      fetchError &&
      existing?.ufPct != null &&
      Number(existing.ufPct) > 0
    ) {
      ufPct = toPercent(existing.ufPct);
      source = 'on3_rpm_last_good';
    }

    if (ufPct == null || ufPct <= 0) {
      return {
        slug,
        skipped: true,
        reason: fetchError || 'no_uf_pct',
        sourceBucket: target.sourceBucket,
      };
    }

    const priorUfPct = existing?.ufPct ?? null;
    const syncedAt = new Date().toISOString();
    const entry = {
      playerSlug: slug,
      playerName: target.name || existingPlayer?.name || slug,
      classYear,
      ufPct,
      priorUfPct: priorUfPct != null ? priorUfPct : null,
      profileUrl,
      source,
      sourceBucket: target.sourceBucket || 'allowlist',
      syncedAt,
      ...(fetchError && source === 'on3_rpm_last_good' ? { fetchError } : {}),
    };

    let playerWrite = null;
    if (!dryRun) {
      const idx = doc.entries.findIndex(
        (row) => String(row.playerSlug || '').toLowerCase() === slug
      );
      if (idx >= 0) doc.entries[idx] = { ...doc.entries[idx], ...entry };
      else doc.entries.push(entry);

      if (writePlayers) {
        if (profile && !profile.error) {
          storePatch = await persistRpmToRecruitingStore(slug, classYear, profile, ufPct);
          playerWrite = storePatch?.ok
            ? { wrote: true, ufPct: storePatch.ufRpmPct, competitors: storePatch.competitors }
            : { wrote: false, reason: storePatch?.reason || 'persist_failed' };
        } else {
          playerWrite = await writeUfRpmToPlayer(slug, ufPct, { syncedAt });
        }
      }
    }

    return {
      slug,
      ufPct,
      priorUfPct,
      dryRun,
      fetchError,
      sourceBucket: target.sourceBucket,
      playerWrite,
      competitors: storePatch?.competitors ?? null,
      storePatched: Boolean(storePatch?.ok),
    };
  });

  const out = await on3.mapPool(jobs, limit, (fn) => fn());
  for (const row of out) {
    if (row) results.push(row);
  }

  if (!dryRun) writeDoc(doc);

  const updated = results.filter((r) => r.ufPct != null && !r.skipped);
  return {
    ok: true,
    dryRun,
    scope: collected.scope,
    classYears: collected.classYears,
    targetCount: targets.length,
    updated: updated.length,
    skipped: results.filter((r) => r.skipped).length,
    playersWritten: results.filter((r) => r.playerWrite?.wrote).length,
    storePatched: results.filter((r) => r.storePatched).length,
    inventoryUpdated: updated.filter((r) => String(r.sourceBucket || '').includes('inventory')).length,
    allowlistUpdated: updated.filter((r) => String(r.sourceBucket || '').includes('allowlist')).length,
    results,
  };
}

/** Alias — Pass 4 inventory-first sync (still merges allowlist when scope=all). */
async function syncInventoryOn3Rpm(options = {}) {
  return syncAllowlistOn3Rpm({ ...options, scope: options.scope || 'all' });
}

function loadOn3RpmUfPctBySlug() {
  const map = new Map();
  const doc = readDoc();
  for (const row of doc.entries || []) {
    const slug = String(row.playerSlug || '').toLowerCase();
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
  syncInventoryOn3Rpm,
  collectSyncTargets,
  loadOn3RpmUfPctBySlug,
  persistRpmToRecruitingStore,
};
