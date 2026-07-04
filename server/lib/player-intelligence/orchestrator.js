/**
 * Player Intelligence orchestrator — reactive + proactive refresh.
 * Detectives v3 write path: fetch On3 metadata → unified store → observations.
 */
const store = require('../recruiting-store');
const { getPlayerIntelligence } = require('./index');
const observationsStore = require('./observations-store');
const { resolveCoverageTier, loadTierASlugs, clearTierCache } = require('./tiers');

async function refreshPlayerFromOn3(slug, classYear) {
  try {
    const { isGoldenProdSlug, syncGoldenFourPlayerFromOn3 } = require('./golden-four-on3');
    if (isGoldenProdSlug(slug)) {
      return syncGoldenFourPlayerFromOn3(slug);
    }
    const { syncSlugFromOn3 } = require('../allowlist-target-sync');
    return await syncSlugFromOn3(slug, classYear);
  } catch (err) {
    return { ok: false, slug, error: err.message };
  }
}

async function refreshPlayerIntelligence(slug, opts = {}) {
  const key = String(slug || '').trim().toLowerCase();
  if (!key) return { ok: false, reason: 'missing_slug' };

  const tier = opts.tier || (await resolveCoverageTier(key));
  if (tier === 'C' && !opts.force) {
    return { ok: true, skipped: true, reason: 'tier_c', slug: key, tier };
  }

  const existing = await store.getPlayerBySlug(key);
  const classYear = opts.classYear || existing?.classYear || 2028;

  let on3Refresh = null;
  const shouldFetch =
    opts.reactive === true ||
    tier === 'A' ||
    tier === 'B' ||
    opts.force === true;

  if (shouldFetch) {
    on3Refresh = await refreshPlayerFromOn3(key, classYear);
  }

  clearTierCache();
  const intel = await getPlayerIntelligence(key, { coverageTier: tier });
  if (!intel) {
    return { ok: false, reason: 'player_not_found', slug: key, tier, on3Refresh };
  }

  observationsStore.appendSnapshot(key, intel);

  return {
    ok: true,
    slug: key,
    tier,
    on3Refresh,
    gaps: intel.gaps,
    stale: intel.stale,
    rankingValid: intel.rankingBlock?.valid === true,
    rankingSource: intel.rankingBlock?.source || null,
    observedAt: intel.meta?.generatedAt
  };
}

async function refreshTierAPlayers(opts = {}) {
  const {
    syncAllGoldenFourFromOn3,
    refreshGoldenFourRankingCache
  } = require('./golden-four-on3');
  const goldenSync = await syncAllGoldenFourFromOn3();
  await refreshGoldenFourRankingCache();

  const slugs = await loadTierASlugs();
  const limit = Number(opts.limit || 0);
  const list = [...slugs];
  const targets = limit > 0 ? list.slice(0, limit) : list;
  const results = [];

  for (const slug of targets) {
    const out = await refreshPlayerIntelligence(slug, { force: true, tier: 'A' });
    results.push(out);
    if (opts.stopOnError && out.ok === false && !out.skipped) break;
  }

  const gapReport = results
    .filter((r) => r.ok && !r.skipped)
    .filter((r) => !r.rankingValid)
    .map((r) => ({ slug: r.slug, gaps: r.gaps, stale: r.stale }));

  return {
    ok: true,
    goldenFour: goldenSync.status,
    processed: results.length,
    rankingComplete: results.filter((r) => r.rankingValid).length,
    gapReport,
    results: opts.verbose ? results : results.map((r) => ({
      slug: r.slug,
      ok: r.ok,
      rankingValid: r.rankingValid,
      gaps: r.gaps
    }))
  };
}

async function listTierAGaps() {
  const slugs = await loadTierASlugs();
  const gaps = [];
  for (const slug of slugs) {
    const intel = await getPlayerIntelligence(slug, { coverageTier: 'A' });
    if (!intel) {
      gaps.push({ slug, gaps: ['player_not_found'], stale: [] });
      continue;
    }
    if (!intel.rankingBlock?.valid || intel.gaps?.length || intel.stale?.length) {
      gaps.push({
        slug,
        name: intel.identity?.name,
        gaps: intel.gaps,
        stale: intel.stale,
        rankingValid: intel.rankingBlock?.valid === true
      });
    }
  }
  return gaps;
}

module.exports = {
  refreshPlayerIntelligence,
  refreshTierAPlayers,
  listTierAGaps,
  refreshPlayerFromOn3
};
