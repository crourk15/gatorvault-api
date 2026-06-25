/**
 * Clear expired OV windows from the recruiting store so boards don't show past dates.
 */
const { isPastVisitWindow, pickLatestVerifiedUpcomingFloridaVisit } = require('./visit-intel-utils');

async function expireStaleVisitIntelInStore(options = {}) {
  const store = require('./recruiting-store');
  const visitLogStore = require('./recruiting-visit-log-store');
  const asOf = options.asOf ? new Date(options.asOf) : new Date();
  const dryRun = Boolean(options.dryRun);
  const visitLogs = visitLogStore.loadDoc().items || [];
  const all = await store.getAllPlayers();
  let expired = 0;
  let scanned = 0;

  for (const player of all) {
    if (!player?.slug) continue;
    scanned += 1;

    const verified = pickLatestVerifiedUpcomingFloridaVisit(player.slug, visitLogs, asOf);
    const hasStaleFields =
      player.visitStart ||
      player.visitEnd ||
      player.ufOvStatus === 'scheduled' ||
      player.ufOvStatus === 'visit';

    if (!verified && !hasStaleFields) continue;
    if (verified) continue;

    const status = String(player.ufOvStatus || '').toLowerCase();
    const patch = {
      ...player,
      visitStart: null,
      visitEnd: null,
      updatedAt: asOf.toISOString(),
    };
    if (status === 'scheduled' || status === 'visit' || isPastVisitWindow(player, asOf)) {
      patch.ufOvStatus = player.visitStart || player.visitEnd ? 'completed' : player.ufOvStatus ?? null;
      if (patch.ufOvStatus === 'scheduled' || patch.ufOvStatus === 'visit') {
        patch.ufOvStatus = 'completed';
      }
    }

    if (!dryRun) {
      await store.upsertPlayer(patch);
    }
    expired += 1;
  }

  return { expired, dryRun, scanned, storageMode: store.storageMode() };
}

/**
 * Expire stale player visit fields, then bust FutureCast caches when rows changed.
 * Safe for Supabase + local JSON — run on cron or after ingest.
 */
async function reconcileVisitIntelInStore(options = {}) {
  const visitLogStore = require('./recruiting-visit-log-store');
  const { getVisitIntelBoardSnapshot } = require('./visit-intel-utils');
  const asOf = options.asOf ? new Date(options.asOf) : new Date();
  const visitLogs = visitLogStore.loadDoc().items || [];
  const boardSnapshotBefore = getVisitIntelBoardSnapshot(visitLogs, asOf);
  const expire = await expireStaleVisitIntelInStore({ ...options, asOf });
  let futurecastCacheCleared = false;

  if (!options.dryRun && expire.expired > 0) {
    const { clearFuturecastCacheSafe } = require('./recruiting-intel-cache');
    clearFuturecastCacheSafe();
    futurecastCacheCleared = true;
  }

  const boardSnapshotAfter = getVisitIntelBoardSnapshot(visitLogs, asOf);
  return {
    ...expire,
    futurecastCacheCleared,
    reconciledAt: asOf.toISOString(),
    boardSnapshotBefore,
    boardSnapshotAfter,
  };
}

module.exports = { expireStaleVisitIntelInStore, reconcileVisitIntelInStore };
