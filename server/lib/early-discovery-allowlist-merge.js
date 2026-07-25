/**
 * Merge locked 2028 allowlist targets into Early Discovery API results.
 */
const { ALLOWLIST_2028, getMergedCanonicalNames } = require('./recruiting-target-allowlist');
const { loadTargetBoardBySlug } = require('./target-board-path');
const { computeDiscoveryScore } = require('./early-discovery-score');
const { mergeBoardSeed } = require('./target-board-enrich');
const { resolveFutureCastPosition } = require('./recruiting-editorial-positions');
const { resolveRecruitDisplayName } = require('./recruit-display-name');

const ALLOWLIST_DISCOVERY_FLOOR = 72;

const POSITION_ALIASES = {
  OL: ['OL', 'IOL', 'OT', 'OG', 'C'],
  DL: ['DL', 'DT', 'DE'],
  EDGE: ['EDGE', 'DE', 'OLB'],
  LB: ['LB', 'ILB', 'OLB'],
  CB: ['CB', 'DB'],
  S: ['S', 'SAF', 'DB'],
};

function expandPosition(position) {
  const key = String(position || '').toUpperCase();
  return POSITION_ALIASES[key] ? [...POSITION_ALIASES[key]] : [key];
}

function matchesPosition(position, filter) {
  if (!filter) return true;
  const pos = String(position || '').toUpperCase();
  return expandPosition(filter).includes(pos);
}

function buildAllowlistDiscoveryRow(boardRow, classYear) {
  const slug = String(boardRow.slug || '').toLowerCase();
  const merged = mergeBoardSeed(
    {
      slug,
      name: boardRow.name,
      pos: boardRow.pos || boardRow.position,
      classYear,
      stars: boardRow.stars,
      rating: boardRow.rating,
      state: boardRow.state,
    },
    boardRow,
    classYear
  );
  const inFlorida =
    String(merged.state || boardRow.state || '').toUpperCase() === 'FL' || Boolean(boardRow.inState);
  let discoveryScore = computeDiscoveryScore({
    signalTypes: ['STAFF_FLAG'],
    stars: merged.stars ?? boardRow.stars,
    rating: merged.rating ?? boardRow.rating,
    inFlorida,
  });
  discoveryScore = Math.max(discoveryScore, ALLOWLIST_DISCOVERY_FLOOR);
  const fullName = resolveRecruitDisplayName(
    { slug, name: merged.name || boardRow.name },
    { canonicalNames: getMergedCanonicalNames() }
  );
  return {
    id: slug,
    slug,
    fullName,
    classYear,
    position: resolveFutureCastPosition({
      slug,
      classYear,
      seed: boardRow,
      recruiting: merged,
    }) || merged.pos || merged.position || boardRow.pos || null,
    state: merged.state || boardRow.state || null,
    stars: merged.stars ?? boardRow.stars ?? null,
    discoveryScore,
    ufFitScore: merged.fitScore ?? null,
    ufProbability: merged.ufProbability ?? null,
    ufStatus: 'TARGET',
    signalCount: 0,
    allowlistTarget: true,
  };
}

/** Early Discovery board fields for a locked 2028 allowlist slug. */
function getAllowlistDiscoveryFields(slug, classYear = 2028) {
  const key = String(slug || '').toLowerCase();
  const boardRow = loadTargetBoardBySlug(classYear).get(key);
  if (!boardRow) return null;
  const row = buildAllowlistDiscoveryRow(boardRow, classYear);
  return {
    discoveryScore: row.discoveryScore,
    position: row.position ? String(row.position).trim().toUpperCase() : null,
    ufFitScore: row.ufFitScore ?? null,
    ufProbability: row.ufProbability ?? null,
    allowlistTarget: true,
  };
}

function enrichAllowlistRow(row, boardRow) {
  const merged = boardRow
    ? mergeBoardSeed(
        {
          slug: row.slug,
          name: row.fullName,
          pos: row.position,
          classYear: row.classYear,
          stars: row.stars,
          state: row.state,
          ufProbability: row.ufProbability,
          fitScore: row.ufFitScore,
        },
        boardRow,
        2028
      )
    : null;
  const fullName = resolveRecruitDisplayName(
    { slug: row.slug, name: merged?.name, fullName: row.fullName },
    { canonicalNames: getMergedCanonicalNames() }
  );
  return {
    ...row,
    fullName,
    allowlistTarget: true,
    discoveryScore: Math.max(Number(row.discoveryScore) || 0, ALLOWLIST_DISCOVERY_FLOOR),
    ufStatus: row.ufStatus || 'TARGET',
    ufFitScore: row.ufFitScore ?? merged?.fitScore ?? null,
    ufProbability: row.ufProbability ?? merged?.ufProbability ?? null,
  };
}

function mergeAllowlistIntoDiscovery(players, opts = {}) {
  const classYearGte = Number(opts.classYearGte) || 2028;
  if (classYearGte !== 2028) return players;

  const minDiscoveryScore = Number(opts.minDiscoveryScore) || 0;
  const minUfFitScore = Number(opts.minUfFitScore) || 0;
  const limit = Number(opts.limit) || 100;
  const position = opts.position;

  const boardBySlug = loadTargetBoardBySlug(2028);
  const bySlug = new Map(
    (players || []).map((p) => [String(p.slug || '').toLowerCase(), { ...p }])
  );

  for (const slug of ALLOWLIST_2028) {
    const key = String(slug).toLowerCase();
    const existing = bySlug.get(key);
    if (existing) {
      bySlug.set(key, enrichAllowlistRow(existing, boardBySlug.get(key)));
      continue;
    }

    const boardRow = boardBySlug.get(key);
    if (!boardRow) continue;
    const row = buildAllowlistDiscoveryRow(boardRow, 2028);
    if (row.discoveryScore < minDiscoveryScore) continue;
    if (minUfFitScore > 0 && Number(row.ufFitScore || 0) < minUfFitScore) continue;
    if (!matchesPosition(row.position, position)) continue;
    bySlug.set(key, row);
  }

  return [...bySlug.values()]
    .sort((a, b) => {
      const scoreDiff = Number(b.discoveryScore) - Number(a.discoveryScore);
      if (scoreDiff !== 0) return scoreDiff;
      return (Number(b.stars) || 0) - (Number(a.stars) || 0);
    })
    .slice(0, limit)
    .map((p, index) => ({ ...p, rank: index + 1 }));
}

module.exports = {
  ALLOWLIST_DISCOVERY_FLOOR,
  mergeAllowlistIntoDiscovery,
  buildAllowlistDiscoveryRow,
  getAllowlistDiscoveryFields,
};
