/**
 * Purge false inferred decommit events from all server-side stores and rebuild live caches.
 */
const store = require('./recruiting-store');
const liveStore = require('./live-store');
const decommitValidator = require('./decommit-validator');
const { refreshLiveDashboard } = require('./live-aggregator');
const autoposterStore = require('./x-autoposter-store');

function isFalseDecommitFeedItem(item) {
  if (item.meta?.eventType === 'decommit') {
    if (!item.meta?.verifiedDecommit && !item.meta?.verification?.explicitDecommit) return true;
  }
  const title = String(item.title || '').toLowerCase();
  if (title.includes('decommits from florida') || title.includes('decommitted from florida')) {
    if (!item.meta?.verifiedDecommit && !item.meta?.verification?.explicitDecommit) return true;
  }
  const key = String(item.dedupeKey || item.id || '');
  if (key.startsWith('decommit:') && !item.meta?.verifiedDecommit) return true;
  return false;
}

function isFalseDecommitQueueItem(item) {
  const text = String(item.text || item.title || '').toLowerCase();
  if (!text.includes('decommit')) return false;
  if (String(item.intelType || '').toLowerCase() === 'decommit') return true;
  if (text.includes('decommits from florida') || text.includes('decommitted from florida')) return true;
  return false;
}

async function countRemainingFalseDecommits() {
  const events = await store.getEvents({ limit: 5000 });
  const falseEvents = events.filter(decommitValidator.isFalseInferredDecommitEvent);
  const feed = liveStore.getFeedItems({ limit: 5000, categoriesOnly: false });
  const falseFeed = feed.filter(isFalseDecommitFeedItem);
  const queue = autoposterStore.loadQueue();
  const falseQueue = (queue.items || []).filter(isFalseDecommitQueueItem);
  return {
    falseDecommitEvents: falseEvents.length,
    falseDecommitFeedItems: falseFeed.length,
    falseDecommitQueueItems: falseQueue.length,
    totalDecommitEvents: events.filter((e) => e.eventType === 'decommit').length
  };
}

async function runPurgeFalseDecommits(options = {}) {
  const before = await countRemainingFalseDecommits();

  const eventResult = await store.deleteEventsMatching((e) =>
    decommitValidator.isFalseInferredDecommitEvent(e)
  );
  const feedResult = liveStore.removeFeedItemsMatching(isFalseDecommitFeedItem);

  const queueDoc = autoposterStore.loadQueue();
  const queueBefore = queueDoc.items.length;
  queueDoc.items = queueDoc.items.filter((i) => !isFalseDecommitQueueItem(i));
  autoposterStore.saveQueue(queueDoc);
  const queueResult = { removed: queueBefore - queueDoc.items.length, kept: queueDoc.items.length };

  const dedupeResult = liveStore.dedupeCommitFeedItems();

  let refreshed = null;
  if (options.refresh !== false) {
    try {
      refreshed = await refreshLiveDashboard({ beat: false, podcasts: false, recruiting: true });
    } catch (e) {
      refreshed = { error: e.message };
    }
  }

  const after = await countRemainingFalseDecommits();

  return {
    before,
    eventResult,
    feedResult,
    queueResult,
    dedupeResult,
    refreshed,
    after,
    clean:
      after.falseDecommitEvents === 0 &&
      after.falseDecommitFeedItems === 0 &&
      after.falseDecommitQueueItems === 0
  };
}

module.exports = {
  isFalseDecommitFeedItem,
  isFalseDecommitQueueItem,
  countRemainingFalseDecommits,
  runPurgeFalseDecommits
};
