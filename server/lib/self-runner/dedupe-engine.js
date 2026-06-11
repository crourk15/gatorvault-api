/**
 * Self-Runner 2.0 — re-exports canonical live-feed-dedup engine.
 */
const feedDedup = require('../live-feed-dedup');

module.exports = {
  DEFAULT_WINDOW_SEC: feedDedup.DEDUP_WINDOW_SEC,
  normalizeFeedText: feedDedup.normalizeFeedText,
  normalizePlayerName: feedDedup.normalizePlayerName,
  normalizePosition: feedDedup.normalizePosition,
  contentHash: feedDedup.contentHash,
  isPlaceholderHash: feedDedup.isPlaceholderHash,
  enrichFeedItem: feedDedup.enrichFeedItem,
  findDuplicateIndex: (items, candidate, opts) => {
    const hit = feedDedup.findDuplicateReason(items, candidate, opts);
    if (!hit) return null;
    return { index: hit.index, hash: hit.hash, normalized: hit.normalized, reason: hit.reason };
  },
  dedupeFeedItemsSmart: (items, opts) => feedDedup.dedupeFeedItems(items, opts),
  validateFeedIntegrity: feedDedup.validateFeedIntegrity,
  repairFeedItems: feedDedup.repairFeedItems,
  appendDedupeLog: feedDedup.appendDedupeLog,
  isValidSha256Hash: (hash) => /^[a-f0-9]{64}$/i.test(String(hash || ''))
};
