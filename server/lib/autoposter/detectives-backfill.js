/** Rebuild Detectives pile from beat cache after deploy or empty pile. */
const store = require('./detectives-store');
const detectives = require('./detectives');

function normalizePosts(beatResult) {
  if (!beatResult) return [];
  if (Array.isArray(beatResult)) return beatResult;
  if (Array.isArray(beatResult.posts)) return beatResult.posts;
  return [];
}

async function backfillFromPosts(posts, { skipStage = 'beat_prefilter_backfill', limit = null } = {}) {
  if (!detectives.detectivesEnabled()) {
    return { ok: false, reason: 'detectives_disabled' };
  }

  const prefilter = require('../beat-intel-prefilter');
  const rows = normalizePosts(posts).slice(0, limit || posts.length || 0);
  const stats = {
    ok: true,
    scanned: 0,
    prefilterSkipped: 0,
    stillEligible: 0,
    notHandoffEligible: 0,
    handoffs: 0,
    created: 0,
    refreshed: 0,
    blocked: 0,
    failedFinal: 0,
  };

  for (const post of rows) {
    stats.scanned += 1;
    const guarded = await prefilter.guardBeatPost(post);
    if (guarded.eligible) {
      stats.stillEligible += 1;
      continue;
    }

    const skipReason = prefilter.resolveGuardSkipReason(guarded);
    stats.prefilterSkipped += 1;
    const payload = {
      beatPost: post,
      skipReason,
      skipStage,
      hints: {
        handle: post?.handle,
        writerName: post?.writerName || post?.outlet,
        url: post?.url,
        playerName: post?.playerName || null,
        playerSlug: post?.playerSlug || null,
        eventType: post?.eventType || null,
      },
    };

    if (!detectives.shouldHandoff(skipReason, payload)) {
      stats.notHandoffEligible += 1;
      continue;
    }

    stats.handoffs += 1;
    const out = await detectives.handoffToDetectives(payload);
    if (out?.created) stats.created += 1;
    if (out?.refreshed) stats.refreshed += 1;
    if (out?.blocked) stats.blocked += 1;
    if (out?.failedFinal) stats.failedFinal += 1;
  }

  stats.counts = store.countByStatus();
  return stats;
}

async function backfillFromBeatCache({ limit = 80, refreshIfEmpty = true } = {}) {
  const { getBeatPosts, refreshBeatStream } = require('../live-beat');
  let beat = getBeatPosts(limit);
  let posts = normalizePosts(beat);
  let refreshed = false;

  if (refreshIfEmpty && !posts.length) {
    try {
      await refreshBeatStream();
      refreshed = true;
      beat = getBeatPosts(limit);
      posts = normalizePosts(beat);
    } catch {
      /* optional */
    }
  }

  const stats = await backfillFromPosts(posts, { limit, skipStage: 'beat_prefilter_backfill' });
  return {
    ...stats,
    beatFetchedAt: beat?.fetchedAt || null,
    beatPostCount: posts.length,
    beatError: beat?.error || null,
    beatCacheRefreshed: refreshed,
  };
}

function pileNeedsBackfill() {
  try {
    const doc = store.loadPile();
    return !doc.cases || doc.cases.length === 0;
  } catch {
    return true;
  }
}

module.exports = {
  backfillFromPosts,
  backfillFromBeatCache,
  pileNeedsBackfill,
};
