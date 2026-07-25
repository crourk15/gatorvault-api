/**
 * On3 snapshot - authoritative UF commit board rows for hub class metrics.
 * Used when Supabase/JSON store rows lose on3_source metadata on round-trip.
 */
const fs = require('fs');
const path = require('path');
const { slugify } = require('./slug');

const SNAPSHOT_PATH = path.join(__dirname, '..', 'data', 'recruiting', 'on3-snapshot.json');

function loadOn3Snapshot() {
  try {
    return JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));
  } catch {
    return { years: {} };
  }
}

function normalizeSnapshotStatus(entry) {
  const raw = String(entry.status || entry.sourceStatus || 'committed').toLowerCase();
  if (raw.includes('enroll')) return 'enrolled';
  if (raw.includes('sign')) return 'signed';
  if (raw === 'commit') return 'committed';
  return raw || 'committed';
}

/**
 * Portal transfers on the UF commits board lose transferRating in older snapshots.
 * Recover them: explicit category, portal copy, or HS consensus rating missing
 * (On3 HS signees always carry rating/natl/pos ranks; portal rows do not).
 */
function isSnapshotPortalEntry(entry) {
  if (!entry || typeof entry !== 'object') return false;
  if (entry.isPortal === true) return true;
  if (String(entry.category || '').toLowerCase() === 'portal') return true;
  if (/transfer|portal/i.test(String(entry.sourceStatus || entry.skinny || entry.fromSchool || ''))) {
    return true;
  }
  const rating = entry.rating;
  const hasHsRating = rating != null && rating !== '' && Number.isFinite(Number(rating));
  const hasHsRank =
    entry.natlRank != null || entry.posRank != null || entry.stateRank != null;
  return !hasHsRating && !hasHsRank;
}

function snapshotEntryToPlayer(entry, classYear) {
  const slug = slugify(entry.name);
  const status = normalizeSnapshotStatus(entry);
  const isPortal = isSnapshotPortalEntry(entry);
  return {
    slug,
    name: entry.name,
    pos: entry.pos,
    classYear: Number(entry.classYear) || classYear,
    school: entry.school || '',
    htWt: entry.htWt || '',
    stars: entry.stars || 0,
    rating: entry.rating != null ? Number(entry.rating) : null,
    natlRank: entry.natlRank ?? null,
    posRank: entry.posRank ?? null,
    stateRank: entry.stateRank ?? null,
    inState: !!entry.inState,
    category: isPortal ? 'portal' : 'recruit',
    status,
    committedTo: 'Florida',
    commitDate: entry.commitDate || null,
    on3Id: entry.on3Id || null,
    on3Source: isPortal ? 'on3-portal-sync' : 'on3-board-sync',
    protected: true,
    skinny: entry.skinny || '',
    fromSchool: entry.fromSchool || null,
  };
}

function getSnapshotHubCommits(classYear) {
  const year = parseInt(classYear, 10);
  if (!Number.isFinite(year)) return [];

  const snapshot = loadOn3Snapshot();
  const bucket = snapshot.years?.[String(year)]?.commits || snapshot.years?.[year]?.commits || {};
  return Object.values(bucket).map((entry) => snapshotEntryToPlayer(entry, year));
}

function countSnapshotHubCommits(classYear) {
  return getSnapshotHubCommits(classYear).length;
}

function preferCommitCategory(a, b) {
  const cats = [a, b].map((p) => String(p?.category || '').toLowerCase());
  return cats.includes('portal') ? 'portal' : cats.find(Boolean) || 'recruit';
}

function mergeCommitPlayerLists(...lists) {
  const map = new Map();
  for (const list of lists) {
    for (const player of list || []) {
      if (!player?.slug) continue;
      const key = String(player.slug).toLowerCase();
      const on3Key = player.on3Id ? `on3:${player.on3Id}` : null;
      const existing = map.get(key) || (on3Key ? map.get(on3Key) : null);
      const merged = existing
        ? {
            ...existing,
            ...player,
            // Never let a store 'recruit' tag clobber a snapshot portal identity.
            category: preferCommitCategory(existing, player),
          }
        : player;
      map.set(key, merged);
      if (on3Key) map.set(on3Key, merged);
    }
  }
  const seen = new Set();
  const out = [];
  for (const player of map.values()) {
    const key = String(player.slug).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(player);
  }
  return out;
}

module.exports = {
  loadOn3Snapshot,
  getSnapshotHubCommits,
  countSnapshotHubCommits,
  mergeCommitPlayerLists,
  snapshotEntryToPlayer,
  isSnapshotPortalEntry,
};