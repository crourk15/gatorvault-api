/**
 * Live feed deduplication — same player + event type within 48 hours → keep newest.
 */
const DEDUP_WINDOW_MS = 48 * 60 * 60 * 1000;

function feedItemPlayerId(item) {
  return (
    item?.meta?.playerSlug ||
    item?.meta?.playerId ||
    item?.playerSlug ||
    item?.meta?.on3Id ||
    ''
  );
}

function feedItemEventType(item) {
  return String(item?.type || item?.meta?.eventType || item?.meta?.type || '').toLowerCase();
}

function feedItemEventDate(item) {
  const raw = item?.createdAt || item?.meta?.eventDate || item?.meta?.createdAt || null;
  if (!raw) return '';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function feedDedupeKey(item) {
  const playerId = feedItemPlayerId(item);
  const eventType = feedItemEventType(item);
  const eventDate = feedItemEventDate(item);
  if (!playerId || !eventType) return null;
  return `${playerId}|${eventType}|${eventDate}`;
}

function dedupeFeedItems(items, { windowMs = DEDUP_WINDOW_MS } = {}) {
  const sorted = [...(items || [])].sort(
    (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
  );
  const kept = [];
  for (const item of sorted) {
    const key = feedDedupeKey(item);
    if (!key) {
      kept.push(item);
      continue;
    }
    const ts = new Date(item.createdAt || 0).getTime();
    const dupIdx = kept.findIndex((k) => {
      if (feedDedupeKey(k) !== key) return false;
      const kts = new Date(k.createdAt || 0).getTime();
      return Math.abs(kts - ts) < windowMs;
    });
    if (dupIdx >= 0) continue;
    kept.push(item);
  }
  return kept.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

module.exports = {
  DEDUP_WINDOW_MS,
  feedDedupeKey,
  feedItemPlayerId,
  feedItemEventType,
  dedupeFeedItems
};
