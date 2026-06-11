/**
 * Vault Grade — unified update + cache invalidation for roster & recruiting players.
 */
const rosterStore = require('./roster-store');
const recruitingStore = require('./recruiting-store');
const { clearHeatCheckCache } = require('./heat-check-store');

function clampGrade(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n * 10) / 10));
}

function displayVaultGrade(player) {
  if (!player) return null;
  if (player.ratingOverride != null && player.ratingOverride !== '') return Number(player.ratingOverride);
  if (player.vaultGrade != null && player.vaultGrade !== '') return Number(player.vaultGrade);
  if (player.displayRating != null) return Number(player.displayRating);
  if (player.rating != null) return Number(player.rating);
  return null;
}

function normalizeSearchRow(player, source) {
  const slug = player.slug || player.id;
  return {
    playerId: player.id || slug,
    slug,
    name: player.name,
    pos: player.pos || player.position || '',
    position: player.pos || player.position || '',
    classYear: player.classYear || player.class || player.year || null,
    rating: player.rating != null ? Number(player.rating) : null,
    vaultGrade: displayVaultGrade(player),
    ratingOverride: player.ratingOverride != null ? Number(player.ratingOverride) : null,
    source,
    db: source
  };
}

async function loadUnifiedPlayerIndex() {
  const roster = rosterStore.getAllRosterPlayers().map((p) => normalizeSearchRow(p, 'roster'));
  const recruits = (await recruitingStore.getAllPlayers()).map((p) => normalizeSearchRow(p, 'recruiting'));
  const bySlug = new Map();
  for (const row of recruits) {
    if (row.slug) bySlug.set(String(row.slug).toLowerCase(), row);
  }
  for (const row of roster) {
    if (!row.slug) continue;
    const key = String(row.slug).toLowerCase();
    const existing = bySlug.get(key);
    if (existing) {
      bySlug.set(key, {
        ...existing,
        ...row,
        source: 'both',
        db: 'both',
        rating: row.rating != null ? row.rating : existing.rating,
        vaultGrade: displayVaultGrade(row) ?? existing.vaultGrade
      });
    } else {
      bySlug.set(key, row);
    }
  }
  return Array.from(bySlug.values());
}

async function searchPlayers(query = '', limit = 20) {
  const q = String(query || '').toLowerCase().trim();
  const all = await loadUnifiedPlayerIndex();
  let rows = all;
  if (q) {
    rows = all.filter((p) => {
      const name = String(p.name || '').toLowerCase();
      const slug = String(p.slug || '').toLowerCase();
      const pos = String(p.pos || '').toLowerCase();
      return name.includes(q) || slug.includes(q) || pos.includes(q);
    });
  }
  rows.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  return rows.slice(0, Math.max(1, Math.min(limit, 80)));
}

async function resolvePlayer(playerId) {
  const key = String(playerId || '').trim();
  if (!key) return null;

  const roster = rosterStore.getAllRosterPlayers();
  let rosterPlayer =
    roster.find((p) => p.slug === key || p.id === key) ||
    roster.find((p) => String(p.slug || '').toLowerCase() === key.toLowerCase()) ||
    roster.find((p) => String(p.id || '').toLowerCase() === key.toLowerCase()) ||
    null;

  const recruits = await recruitingStore.getAllPlayers();
  let recruitPlayer =
    recruits.find((p) => p.slug === key || p.id === key) ||
    recruits.find((p) => String(p.slug || '').toLowerCase() === key.toLowerCase()) ||
    recruits.find((p) => String(p.id || '').toLowerCase() === key.toLowerCase()) ||
    null;

  if (rosterPlayer && recruitPlayer) {
    return {
      source: 'both',
      roster: rosterPlayer,
      recruiting: recruitPlayer,
      slug: rosterPlayer.slug || recruitPlayer.slug,
      id: rosterPlayer.id || recruitPlayer.id
    };
  }
  if (rosterPlayer) {
    return { source: 'roster', roster: rosterPlayer, slug: rosterPlayer.slug, id: rosterPlayer.id };
  }
  if (recruitPlayer) {
    return { source: 'recruiting', recruiting: recruitPlayer, slug: recruitPlayer.slug, id: recruitPlayer.id };
  }
  return null;
}

async function updateVaultGrade({ playerId, vaultGrade, clear = false }) {
  const resolved = await resolvePlayer(playerId);
  if (!resolved) {
    const err = new Error('Player not found');
    err.code = 'not_found';
    throw err;
  }

  const grade = clear ? null : clampGrade(vaultGrade);
  if (!clear && grade == null) {
    const err = new Error('vaultGrade must be a number between 0 and 100');
    err.code = 'invalid_grade';
    throw err;
  }

  const ts = new Date().toISOString();
  const updated = { roster: null, recruiting: null };

  if (resolved.roster) {
    const patch = {
      ...resolved.roster,
      slug: resolved.roster.slug,
      name: resolved.roster.name,
      ratingOverride: clear ? null : grade,
      vaultGradeUpdatedAt: ts
    };
    updated.roster = rosterStore.upsertRosterPlayer(patch);
  }

  if (resolved.recruiting) {
    const patch = {
      ...resolved.recruiting,
      slug: resolved.recruiting.slug,
      name: resolved.recruiting.name,
      ratingOverride: clear ? null : grade,
      vaultGrade: clear ? null : grade,
      vaultGradeUpdatedAt: ts
    };
    updated.recruiting = await recruitingStore.upsertPlayer(patch, { subsystem: 'vault-grade-service' });
  }

  const primary = updated.roster || updated.recruiting;
  const refresh = invalidateCaches({ slug: resolved.slug, playerId: resolved.id });

  return {
    ok: true,
    player: primary,
    playerId: resolved.id || resolved.slug,
    slug: resolved.slug,
    source: resolved.source,
    vaultGrade: clear ? null : grade,
    displayRating: clear ? (primary?.rating != null ? Number(primary.rating) : null) : grade,
    updatedAt: ts,
    refresh
  };
}

function invalidateCaches(meta = {}) {
  const at = Date.now();
  const signals = {
    roster: at,
    recruiting: at,
    live: at,
    warRoom: at
  };

  try {
    clearHeatCheckCache();
  } catch (e) {
    console.warn('[vault-grade] heat-check cache clear:', e.message);
  }

  try {
    const { warmDashboardCache, bumpMobileRefreshSignal } = require('./live-dashboard-cache');
    warmDashboardCache();
    bumpMobileRefreshSignal();
  } catch (e) {
    console.warn('[vault-grade] live dashboard refresh:', e.message);
  }

  try {
    const { refreshLiveDashboard } = require('./live-aggregator');
    refreshLiveDashboard().catch((err) => {
      console.warn('[vault-grade] live aggregator refresh:', err.message);
    });
  } catch (e) {
    /* optional */
  }

  return {
    signals,
    localStorageKeys: ['gv_roster_updated', 'gv_recruiting_updated', 'gv_vault_grade_updated'],
    meta
  };
}

module.exports = {
  clampGrade,
  displayVaultGrade,
  searchPlayers,
  resolvePlayer,
  updateVaultGrade,
  invalidateCaches,
  loadUnifiedPlayerIndex
};
