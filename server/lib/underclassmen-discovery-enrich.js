/**
 * Discovery-score enrichment for 2028 underclassmen watchboard (Early Discovery parity).
 */
const { ALLOWLIST_2028 } = require('./recruiting-target-allowlist');
const { loadTargetBoardBySlug } = require('./target-board-path');
const {
  buildAllowlistDiscoveryRow,
  ALLOWLIST_DISCOVERY_FLOOR,
} = require('./early-discovery-allowlist-merge');
const { resolveFutureCastPosition } = require('./recruiting-editorial-positions');

/**
 * @typedef {object} DiscoveryEnrichment
 * @property {number} discoveryScore
 * @property {number | null} ufFitScore
 * @property {number | null} ufProbability
 * @property {boolean} allowlistTarget
 */

/**
 * Load discovery scores for locked 2028 allowlist slugs (Postgres + board seed fallback).
 * @returns {Promise<Map<string, DiscoveryEnrichment>>}
 */
async function loadDiscoveryEnrichmentBySlug(classYear = 2028) {
  const map = new Map();
  if (Number(classYear) !== 2028) return map;

  try {
    require('tsx/cjs');
    const { db } = require('../models/db.ts');
    const slugs = ALLOWLIST_2028.map((s) => String(s).toLowerCase());
    const { rows } = await db.query(
      `
      SELECT
        lower(p.slug) AS slug,
        COALESCE(hs.discovery_score, 0)::int AS discovery_score,
        uf.uf_fit_score,
        NULL::numeric AS uf_probability
      FROM futurecast.players p
      LEFT JOIN futurecast.high_school_profiles hs ON hs.player_id = p.id
      LEFT JOIN futurecast.uf_specific_profiles uf ON uf.player_id = p.id
      WHERE lower(p.slug) = ANY($1::text[])
      `,
      [slugs]
    );
    for (const row of rows || []) {
      const key = String(row.slug || '').toLowerCase();
      if (!key) continue;
      map.set(key, {
        discoveryScore: Number(row.discovery_score) || 0,
        ufFitScore: row.uf_fit_score != null ? Number(row.uf_fit_score) : null,
        ufProbability: null,
        allowlistTarget: true,
      });
    }
  } catch (err) {
    console.warn(
      '[underclassmen-discovery] Postgres unavailable, using board seed:',
      err instanceof Error ? err.message : err
    );
  }

  const boardBySlug = loadTargetBoardBySlug(2028);
  for (const slug of ALLOWLIST_2028) {
    const key = String(slug).toLowerCase();
    const boardRow = boardBySlug.get(key);
    if (!boardRow) continue;

    const seedRow = buildAllowlistDiscoveryRow(boardRow, 2028);
    const existing = map.get(key);
    const discoveryScore = Math.max(
      Number(existing?.discoveryScore) || 0,
      Number(seedRow.discoveryScore) || 0,
      ALLOWLIST_DISCOVERY_FLOOR
    );

    map.set(key, {
      discoveryScore,
      ufFitScore: existing?.ufFitScore ?? seedRow.ufFitScore ?? null,
      ufProbability:
        existing?.ufProbability ??
        (seedRow.ufProbability != null ? Number(seedRow.ufProbability) : null),
      allowlistTarget: true,
    });
  }

  return map;
}

/**
 * @param {Record<string, unknown>} player
 * @param {DiscoveryEnrichment | undefined} enrichment
 */
function applyDiscoveryEnrichment(player, enrichment) {
  if (!enrichment) return player;
  const ufFromBoard =
    enrichment.ufProbability != null && Number.isFinite(Number(enrichment.ufProbability))
      ? Math.round(Number(enrichment.ufProbability) * 100)
      : null;

  return {
    ...player,
    discoveryScore: enrichment.discoveryScore ?? player.discoveryScore ?? null,
    fitScore: player.fitScore ?? enrichment.ufFitScore ?? null,
    ufConfidence: player.ufConfidence ?? ufFromBoard,
    allowlistTarget: enrichment.allowlistTarget ?? player.allowlistTarget ?? false,
  };
}

/**
 * Build a minimal watchboard row from allowlist discovery seed when board enrichment skipped a slug.
 * @param {string} slug
 * @param {import('./early-discovery-allowlist-merge').DiscoveryEnrichment} enrichment
 */
function buildAllowlistWatchboardFallback(slug, enrichment) {
  const boardBySlug = loadTargetBoardBySlug(2028);
  const boardRow = boardBySlug.get(String(slug).toLowerCase());
  if (!boardRow) return null;

  const seedRow = buildAllowlistDiscoveryRow(boardRow, 2028);
  const ufPct =
    enrichment?.ufProbability != null
      ? Math.round(Number(enrichment.ufProbability) * 100)
      : seedRow.ufProbability != null
        ? Math.round(Number(seedRow.ufProbability) * 100)
        : null;

  const position =
    resolveFutureCastPosition({
      slug: seedRow.slug,
      classYear: 2028,
      seed: boardRow,
      recruiting: boardRow,
    }) ||
    seedRow.position ||
    'TBD';

  return {
    id: seedRow.id || seedRow.slug,
    slug: seedRow.slug,
    name: seedRow.fullName,
    classYear: 2028,
    position,
    school: boardRow.school ?? null,
    hometown: null,
    state: boardRow.state ?? null,
    composite: Math.round(Number(boardRow.rating ?? 0) * 100) / 100,
    stars: Number(boardRow.stars ?? 0) || 0,
    natlRank: boardRow.natlRank ?? null,
    posRank: boardRow.posRank ?? null,
    stateRank: boardRow.stateRank ?? null,
    ufConfidence: ufPct,
    fitScore: enrichment?.ufFitScore ?? seedRow.ufFitScore ?? null,
    trendDelta7d: null,
    volatility7d: 0,
    priority: 'target',
    committedTo: boardRow.committedTo ?? null,
    predictors: [],
    competingSchools: [],
    tier: 'target',
    discoveryScore: enrichment?.discoveryScore ?? seedRow.discoveryScore ?? ALLOWLIST_DISCOVERY_FLOOR,
    earlyMovement: null,
    allowlistTarget: true,
  };
}

function sortUnderclassmenForWatchboard(players, classYear = 2028) {
  return [...players].sort((a, b) => {
    if (Number(a.classYear) === classYear && Number(b.classYear) === classYear) {
      const discDiff = Number(b.discoveryScore ?? 0) - Number(a.discoveryScore ?? 0);
      if (discDiff !== 0) return discDiff;
    }
    return (Number(b.ufConfidence) || 0) - (Number(a.ufConfidence) || 0);
  });
}

module.exports = {
  loadDiscoveryEnrichmentBySlug,
  applyDiscoveryEnrichment,
  buildAllowlistWatchboardFallback,
  sortUnderclassmenForWatchboard,
};
