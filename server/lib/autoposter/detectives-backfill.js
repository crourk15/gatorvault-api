/** Rebuild Detectives pile from beat cache after deploy or empty pile. */
const store = require('./detectives-store');
const detectives = require('./detectives');

function normalizePosts(beatResult) {
  if (!beatResult) return [];
  if (Array.isArray(beatResult)) return beatResult;
  if (Array.isArray(beatResult.posts)) return beatResult.posts;
  return [];
}

function emptyStats() {
  return {
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
    blockedSkipReasons: {},
    sources: { beatCache: 0, opsLog: 0, needsResolution: 0 },
  };
}

function mergeStats(into, from) {
  if (!from) return into;
  into.scanned += from.scanned || 0;
  into.prefilterSkipped += from.prefilterSkipped || 0;
  into.stillEligible += from.stillEligible || 0;
  into.notHandoffEligible += from.notHandoffEligible || 0;
  into.handoffs += from.handoffs || 0;
  into.created += from.created || 0;
  into.refreshed += from.refreshed || 0;
  into.blocked += from.blocked || 0;
  into.failedFinal += from.failedFinal || 0;
  into.sources = into.sources || { beatCache: 0, opsLog: 0, needsResolution: 0 };
  if (from.sources) {
    into.sources.beatCache += from.sources.beatCache || 0;
    into.sources.opsLog += from.sources.opsLog || 0;
    into.sources.needsResolution += from.sources.needsResolution || 0;
  }
  for (const [reason, count] of Object.entries(from.blockedSkipReasons || {})) {
    into.blockedSkipReasons[reason] = (into.blockedSkipReasons[reason] || 0) + count;
  }
  return into;
}

function noteBlockedReason(stats, reason) {
  const key = String(reason || 'unknown').trim() || 'unknown';
  stats.blockedSkipReasons[key] = (stats.blockedSkipReasons[key] || 0) + 1;
}

async function handoffPayload(payload, stats) {
  if (!detectives.shouldHandoff(payload.skipReason, payload)) {
    stats.notHandoffEligible += 1;
    noteBlockedReason(stats, payload.skipReason);
    return;
  }
  stats.handoffs += 1;
  const out = await detectives.handoffToDetectives(payload);
  if (out?.created) stats.created += 1;
  if (out?.refreshed) stats.refreshed += 1;
  if (out?.blocked) stats.blocked += 1;
  if (out?.failedFinal) stats.failedFinal += 1;
}

async function backfillFromPosts(posts, { skipStage = 'beat_prefilter_backfill', limit = null, sourceKey = 'beatCache' } = {}) {
  if (!detectives.detectivesEnabled()) {
    return { ok: false, reason: 'detectives_disabled' };
  }

  const prefilter = require('../beat-intel-prefilter');
  const rows = normalizePosts(posts).slice(0, limit || posts.length || 0);
  const stats = emptyStats();
  stats.sources = { beatCache: 0, opsLog: 0, needsResolution: 0 };
  if (sourceKey) stats.sources[sourceKey] = rows.length;

  for (const post of rows) {
    stats.scanned += 1;
    const guarded = await prefilter.guardBeatPost(post);
    if (guarded.eligible) {
      stats.stillEligible += 1;
      continue;
    }

    const skipReason = prefilter.resolveGuardSkipReason(guarded);
    stats.prefilterSkipped += 1;
    await handoffPayload({
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
    }, stats);
  }

  stats.counts = store.countByStatus();
  return stats;
}

function postFromOpsSkipEvent(event) {
  const details = event?.details || {};
  const text = String(details.triggerPhrase || details.text || '').trim();
  if (!text) return null;
  const rawHandle = details.handle || details.source || null;
  const handle = rawHandle
    ? (String(rawHandle).startsWith('@') ? String(rawHandle) : '@' + String(rawHandle).replace(/^@/, ''))
    : null;
  return {
    text,
    handle,
    writerName: details.writerName || (rawHandle ? String(rawHandle).replace(/^@/, '') : null),
    url: details.url || null,
    publishedAt: event.timestamp || null,
  };
}

async function backfillFromOpsLogSkips({ limit = 250, maxAgeMs = 7 * 24 * 60 * 60 * 1000 } = {}) {
  if (!detectives.detectivesEnabled()) return { ok: false, reason: 'detectives_disabled' };

  const stats = emptyStats();
  stats.sources = { beatCache: 0, opsLog: 0, needsResolution: 0 };
  const cutoff = Date.now() - (maxAgeMs || 0);
  let events = [];
  try {
    const ops = require('../ops-monitor');
    events = (ops.getLogs({ limit: Math.min(500, limit || 250) }).events || [])
      .filter((e) => {
        if (maxAgeMs && new Date(e.timestamp).getTime() < cutoff) return false;
        if (e.message === 'non-player intel') return true;
        if (String(e.subsystem || '').startsWith('autoposter:')) return true;
        return false;
      });
  } catch {
    events = [];
  }

  const seen = new Set();
  for (const event of events) {
    const post = postFromOpsSkipEvent(event);
    if (!post) continue;
    const reason = event?.details?.reason || event?.details?.skipReason || null;
    if (!reason) continue;
    const key = [reason, post.text.slice(0, 120), post.handle || ''].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    stats.scanned += 1;
    stats.sources.opsLog += 1;
    await handoffPayload({
      beatPost: post,
      skipReason: reason,
      skipStage: 'ops_log_backfill',
      hints: {
        handle: post.handle,
        writerName: post.writerName,
        url: post.url,
      },
    }, stats);
  }

  stats.counts = store.countByStatus();
  return stats;
}

async function backfillFromNeedsResolutionIntel({ limit = 40 } = {}) {
  if (!detectives.detectivesEnabled()) return { ok: false, reason: 'detectives_disabled' };

  const stats = emptyStats();
  stats.sources = { beatCache: 0, opsLog: 0, needsResolution: 0 };
  let rows = [];
  try {
    const intelStore = require('../recruiting-intel-store');
    rows = intelStore.listNeedsResolution({ limit: limit || 40 }) || [];
  } catch {
    rows = [];
  }

  for (const row of rows) {
    const text = String(row.detail || row.status || row.text || '').trim();
    if (!text) continue;
    stats.scanned += 1;
    stats.sources.needsResolution += 1;
    const handle = row.sourceHandle
      ? (String(row.sourceHandle).startsWith('@') ? row.sourceHandle : '@' + row.sourceHandle)
      : null;
    await handoffPayload({
      beatPost: {
        text,
        handle,
        writerName: row.source || row.sourceHandle || null,
        url: row.articleUrl || row.url || null,
        publishedAt: row.timestamp || row.createdAt || null,
        playerName: row.playerName || null,
        playerSlug: row.playerSlug || null,
        eventType: row.eventType || null,
      },
      skipReason: 'needs_resolution',
      skipStage: 'intel_needs_resolution_backfill',
      hints: {
        handle,
        writerName: row.source || null,
        url: row.articleUrl || row.url || null,
        playerName: row.playerName || null,
        playerSlug: row.playerSlug || null,
        eventType: row.eventType || null,
      },
    }, stats);
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

  const stats = await backfillFromPosts(posts, { limit, skipStage: 'beat_prefilter_backfill', sourceKey: 'beatCache' });
  return {
    ...stats,
    beatFetchedAt: beat?.fetchedAt || null,
    beatPostCount: posts.length,
    beatError: beat?.error || null,
    beatCacheRefreshed: refreshed,
    tokenStatus: beat?.tokenStatus || null,
  };
}

async function backfillDetectivesPile({ limit = 80, refreshBeatIfEmpty = true } = {}) {
  if (!detectives.detectivesEnabled()) return { ok: false, reason: 'detectives_disabled' };

  let merged = emptyStats();
  const beatStats = await backfillFromBeatCache({ limit, refreshIfEmpty: refreshBeatIfEmpty });
  mergeStats(merged, beatStats);
  merged.beatFetchedAt = beatStats.beatFetchedAt;
  merged.beatPostCount = beatStats.beatPostCount;
  merged.beatError = beatStats.beatError;
  merged.beatCacheRefreshed = beatStats.beatCacheRefreshed;
  merged.tokenStatus = beatStats.tokenStatus;

  const opsStats = await backfillFromOpsLogSkips({ limit: 250 });
  mergeStats(merged, opsStats);

  const intelStats = await backfillFromNeedsResolutionIntel({ limit: 40 });
  mergeStats(merged, intelStats);

  merged.counts = store.countByStatus();
  try { store.saveBackfillMeta(merged); } catch { /* optional */ }
  return merged;
}

function pileNeedsBackfill() {
  try {
    const doc = store.loadPile();
    return !doc.cases || doc.cases.length === 0;
  } catch {
    return true;
  }
}

function formatBackfillSummary(stats) {
  if (!stats) return '';
  const parts = [
    `scanned ${stats.scanned || 0}`,
    `${stats.created || 0} new`,
    `${stats.refreshed || 0} refreshed`,
    `${stats.notHandoffEligible || 0} not eligible`,
  ];
  if ((stats.beatPostCount || 0) === 0 && stats.beatError) {
    parts.push(`beat cache: ${stats.beatError}`);
  }
  return parts.join(' · ');
}

module.exports = {
  backfillFromPosts,
  backfillFromBeatCache,
  backfillFromOpsLogSkips,
  backfillFromNeedsResolutionIntel,
  backfillDetectivesPile,
  pileNeedsBackfill,
  formatBackfillSummary,
};
