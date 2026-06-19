/**
 * Runtime live-board targets — sourced from recruiting store getBoard(), not static allowlists.
 */
const store = require('./recruiting-store');

function isFloridaCommit(player) {
  const to = String(player?.committedTo || player?.committed_to || '').toLowerCase();
  const status = String(player?.status || '').toLowerCase();
  if (!(status === 'committed' || status === 'commit')) return false;
  return /\bflorida\b|\bgators\b|\buf\b/.test(to);
}

/**
 * @param {number} classYear
 * @returns {Promise<{ classYear: number, targets: object[], commits: object[] }>}
 */
async function getLiveBoard(classYear = 2027) {
  const year = parseInt(classYear, 10);
  if (!Number.isFinite(year)) {
    return { classYear: 2027, targets: [], commits: [] };
  }
  const board = await store.getBoard(year);
  return {
    classYear: board.classYear ?? year,
    targets: board.targets ?? [],
    commits: board.commits ?? [],
  };
}

/**
 * Active UF target rows from the live recruiting board (excludes UF commits).
 * @param {number} classYear
 */
async function getLiveBoardTargets(classYear = 2027) {
  const board = await getLiveBoard(classYear);
  return (board.targets || []).filter((p) => !isFloridaCommit(p));
}

/**
 * Slug set for volatility / movement filtering at runtime.
 * @param {number} classYear
 */
async function getLiveTargetSlugSet(classYear = 2027) {
  const targets = await getLiveBoardTargets(classYear);
  return new Set(
    targets
      .map((p) => String(p.slug || '').trim().toLowerCase())
      .filter(Boolean)
  );
}

/**
 * Combined slug set across multiple class years (e.g. 2027 + 2028 for hub intel).
 * @param {number[]} classYears
 */
async function getLiveTargetSlugSetMulti(classYears = [2027]) {
  const merged = new Set();
  for (const year of classYears) {
    const set = await getLiveTargetSlugSet(year);
    for (const slug of set) merged.add(slug);
  }
  return merged;
}

/**
 * Filter rolling movement rows to live-board targets only (excludes UF commits and non-targets).
 * @template T
 * @param {T[]} rows
 * @param {number} classYear
 * @returns {Promise<T[]>}
 */
async function filterMovementRowsToLiveTargets(rows, classYear = 2027) {
  const slugSet = await getLiveTargetSlugSet(classYear);
  if (!slugSet.size) return [];

  return (rows || []).filter((row) => {
    const slug = String(row?.slug || '').trim().toLowerCase();
    return slug && slugSet.has(slug);
  });
}

/**
 * Filter rolling movement rows across multiple class years.
 * @template T
 * @param {T[]} rows
 * @param {number[]} classYears
 */
async function filterMovementRowsToLiveTargetsMulti(rows, classYears = [2027]) {
  const slugSet = await getLiveTargetSlugSetMulti(classYears);
  if (!slugSet.size) return [];

  return (rows || []).filter((row) => {
    const slug = String(row?.slug || '').trim().toLowerCase();
    return slug && slugSet.has(slug);
  });
}

module.exports = {
  getLiveBoard,
  getLiveBoardTargets,
  getLiveTargetSlugSet,
  getLiveTargetSlugSetMulti,
  filterMovementRowsToLiveTargets,
  filterMovementRowsToLiveTargetsMulti,
  isFloridaCommit,
};
