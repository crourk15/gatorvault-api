/**
 * Live feed deduplication — SHA-256 normalized hashes, URL/title/similarity rules.
 * Used by live-store, live-aggregator, Self-Runner, and QA integrity checks.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DEDUP_WINDOW_MS = parseInt(process.env.LIVE_FEED_DEDUP_WINDOW_MS || String(48 * 60 * 60 * 1000), 10);
const DEDUP_WINDOW_SEC = parseInt(
  process.env.SELF_RUNNER_DEDUPE_WINDOW_SEC || String(Math.round(DEDUP_WINDOW_MS / 1000)),
  10
);
const SIMILARITY_THRESHOLD = parseFloat(process.env.LIVE_FEED_SIMILARITY_THRESHOLD || '0.9');
const LOG_PATH = path.join(__dirname, '..', 'data', 'ops', 'feed-dedupe-log.json');
const LOG_MAX = parseInt(process.env.LIVE_FEED_DEDUPE_LOG_MAX || '500', 10);

const PLACEHOLDER_HASHES = new Set(['text-hash', 'normalized-text-hash', 'placeholder', 'hash']);

function readLog() {
  try {
    return JSON.parse(fs.readFileSync(LOG_PATH, 'utf8'));
  } catch {
    return { entries: [] };
  }
}

function appendDedupeLog(entry) {
  try {
    const doc = readLog();
    doc.entries = Array.isArray(doc.entries) ? doc.entries : [];
    doc.entries.unshift({ at: new Date().toISOString(), ...entry });
    if (doc.entries.length > LOG_MAX) doc.entries.length = LOG_MAX;
    doc.updatedAt = new Date().toISOString();
    fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
    fs.writeFileSync(LOG_PATH, JSON.stringify(doc, null, 2));
  } catch {
    /* optional */
  }
  try {
    const logger = require('./self-runner/self-runner-logger');
    logger.log.dedupe(entry);
  } catch {
    /* optional */
  }
}

function stripEmojis(text) {
  return String(text || '').replace(
    /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}]/gu,
    ''
  );
}

function normalizePlayerName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/\b(jr\.?|sr\.?|iii|ii|iv)\b/gi, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizePosition(pos) {
  const p = String(pos || '').toUpperCase().trim();
  const map = {
    QUARTERBACK: 'QB',
    RUNNINGBACK: 'RB',
    WIDE: 'WR',
    WIDERECEIVER: 'WR',
    TIGHTEND: 'TE',
    LINEBACKER: 'LB',
    CORNERBACK: 'CB',
    SAFETY: 'S',
    DEFENSIVEEND: 'DE',
    DEFENSIVETACKLE: 'DT'
  };
  return map[p.replace(/\s+/g, '')] || p.slice(0, 4);
}

function removeTrailingTruncation(text) {
  return String(text || '')
    .replace(/…+$/g, '')
    .replace(/\.{3,}$/g, '')
    .replace(/\s+[-–—]\s*$/g, '')
    .trim();
}

function normalizeFeedText(item) {
  const parts = [
    item?.title,
    item?.summary,
    item?.text,
    item?.meta?.playerSlug,
    normalizePlayerName(item?.meta?.player?.name || item?.meta?.playerName),
    normalizePosition(item?.meta?.player?.pos || item?.meta?.pos),
    item?.type,
    item?.meta?.eventType
  ];
  return stripEmojis(
    parts
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z/g, '')
      .replace(/\b\d{1,2}:\d{2}\s*(am|pm)?\b/gi, '')
      .replace(/https?:\/\/\S+/g, '')
      .replace(/…+/g, '')
      .replace(/\.{3,}/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

function tokenSet(normalized) {
  return new Set(String(normalized || '').split(/\s+/).filter((w) => w.length > 2));
}

function similarityRatio(a, b) {
  const sa = tokenSet(a);
  const sb = tokenSet(b);
  if (!sa.size || !sb.size) return 0;
  let inter = 0;
  sa.forEach((t) => {
    if (sb.has(t)) inter += 1;
  });
  const union = sa.size + sb.size - inter;
  return union ? inter / union : 0;
}

function contentHash(normalizedText) {
  return crypto.createHash('sha256').update(normalizedText || '').digest('hex');
}

function isPlaceholderHash(hash) {
  if (!hash) return true;
  const h = String(hash).toLowerCase().trim();
  if (PLACEHOLDER_HASHES.has(h)) return true;
  return h.length < 32;
}

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

function feedItemUrl(item) {
  return String(item?.url || item?.source_url || item?.link || '').trim() || null;
}

function normalizeTitleKey(item) {
  return String(item?.title || item?.headline || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .slice(0, 120);
}

function hasExplicitTruncation(text) {
  const t = String(text || '').trim();
  if (!t) return false;
  if (/…|\.\.\./.test(t)) return true;
  if (/\b(https?|htt|http)$/i.test(t)) return true;
  return false;
}

function isTruncatedAutoposterBody(text) {
  const t = String(text || '').trim();
  if (!t || t.length < 40) return false;
  if (hasExplicitTruncation(t)) return true;
  try {
    const tpl = require('./x-autoposter-template');
    if (tpl.isTruncatedCopy && tpl.isTruncatedCopy(t)) return true;
  } catch {
    /* optional */
  }
  return false;
}

function isTruncatedFeedItem(item) {
  const title = String(item?.title || item?.headline || '').trim();
  if (hasExplicitTruncation(title)) return true;

  const bodyFields = [item?.summary, item?.text].filter(Boolean);
  const fromAutoposter =
    item?.source === 'autoposter' ||
    item?.source === 'x' ||
    item?.meta?.autoposter === true;

  for (const f of bodyFields) {
    const t = String(f).trim();
    if (hasExplicitTruncation(t)) return true;
    if (fromAutoposter && isTruncatedAutoposterBody(t)) return true;
  }
  return false;
}

function isEmptyFeedItem(item) {
  if (!item || typeof item !== 'object') return true;
  const title = String(item.title || '').trim();
  const summary = String(item.summary || item.text || '').trim();
  return !title && !summary && !item.id;
}

function enrichFeedItem(item, { windowSec = DEDUP_WINDOW_SEC } = {}) {
  const normalized = normalizeFeedText(item);
  const hash = contentHash(normalized);
  const now = new Date().toISOString();
  const window = Number.isFinite(windowSec) && windowSec > 0 ? windowSec : DEDUP_WINDOW_SEC;
  return {
    ...item,
    hash,
    hashNormalizedPreview: normalized.slice(0, 120),
    hashWindowSec: window,
    hashCreatedAt: item.hashCreatedAt || now,
    updatedAt: now
  };
}

function findDuplicateReason(kept, candidate, { windowSec = DEDUP_WINDOW_SEC } = {}) {
  const candUrl = feedItemUrl(candidate);
  const candTitle = normalizeTitleKey(candidate);
  const candNorm = normalizeFeedText(candidate);
  const candHash = contentHash(candNorm);
  const candTs = new Date(candidate.createdAt || 0).getTime();
  const windowMs = windowSec * 1000;

  for (let i = 0; i < kept.length; i++) {
    const existing = kept[i];
    const existUrl = feedItemUrl(existing);
    if (candUrl && existUrl && candUrl === existUrl) {
      return { index: i, reason: 'duplicate_url', hash: candHash, windowSec, url: candUrl };
    }

    const existTitle = normalizeTitleKey(existing);
    if (candTitle.length > 12 && existTitle === candTitle) {
      return { index: i, reason: 'duplicate_title', hash: candHash, windowSec, title: candTitle };
    }

    const existNorm = normalizeFeedText(existing);
    const existHash = isPlaceholderHash(existing.hash) ? contentHash(existNorm) : existing.hash;
    if (existHash === candHash) {
      const existTs = new Date(existing.createdAt || 0).getTime();
      if (Math.abs(existTs - candTs) <= windowMs) {
        return { index: i, reason: 'hash_window_match', hash: candHash, windowSec, normalized: candNorm.slice(0, 80) };
      }
    }

    const sim = similarityRatio(candNorm, existNorm);
    if (sim >= SIMILARITY_THRESHOLD && candNorm.length > 40) {
      const existTs = new Date(existing.createdAt || 0).getTime();
      if (Math.abs(existTs - candTs) <= windowMs) {
        return {
          index: i,
          reason: 'content_similarity',
          hash: candHash,
          windowSec,
          similarity: Math.round(sim * 100),
          normalized: candNorm.slice(0, 80)
        };
      }
    }

    const playerKey = feedDedupeKey(candidate);
    if (playerKey && feedDedupeKey(existing) === playerKey) {
      const existTs = new Date(existing.createdAt || 0).getTime();
      if (Math.abs(existTs - candTs) <= windowMs) {
        return { index: i, reason: 'player_event_window', hash: candHash, windowSec, key: playerKey };
      }
    }
  }
  return null;
}

function dedupeFeedItems(items, opts = {}) {
  const windowSec = opts.windowSec ?? DEDUP_WINDOW_SEC;
  const logEvents = opts.log !== false;
  const rejectTruncated = opts.rejectTruncated !== false;
  const sorted = [...(items || [])].sort(
    (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
  );
  const kept = [];
  const removed = [];
  const rejected = [];

  for (const raw of sorted) {
    if (isEmptyFeedItem(raw)) {
      removed.push({ id: raw?.id, reason: 'empty_entry' });
      if (logEvents) {
        appendDedupeLog({ action: 'removed', reason: 'empty_entry', id: raw?.id });
      }
      continue;
    }

    if (rejectTruncated && isTruncatedFeedItem(raw)) {
      rejected.push({ id: raw.id, reason: 'truncated_copy', title: raw.title?.slice(0, 80) });
      if (logEvents) {
        appendDedupeLog({
          action: 'rejected',
          reason: 'truncated_copy',
          id: raw.id,
          title: raw.title,
          rawText: String(raw.summary || raw.text || '').slice(0, 200)
        });
      }
      continue;
    }

    try {
      const enriched = enrichFeedItem(raw, { windowSec });
      const dup = findDuplicateReason(kept, enriched, { windowSec });
      if (dup) {
        removed.push({
          id: raw.id,
          reason: dup.reason,
          hash: dup.hash,
          windowSec: dup.windowSec,
          duplicateOf: kept[dup.index]?.id,
          url: dup.url,
          title: dup.title,
          similarity: dup.similarity
        });
        if (logEvents) {
          appendDedupeLog({
            action: 'removed_duplicate',
            id: raw.id,
            duplicateOf: kept[dup.index]?.id,
            reason: dup.reason,
            hash: dup.hash,
            windowSec: dup.windowSec,
            normalized: enriched.hashNormalizedPreview,
            rawText: String(raw.title || raw.summary || '').slice(0, 200)
          });
        }
        continue;
      }
      kept.push(enriched);
    } catch (e) {
      if (logEvents) {
        appendDedupeLog({
          action: 'dedupe_failure',
          id: raw?.id,
          error: e.message,
          normalized: normalizeFeedText(raw),
          rawText: String(raw?.title || raw?.summary || '').slice(0, 200)
        });
      }
      kept.push(enrichFeedItem(raw, { windowSec }));
    }
  }

  return {
    items: kept.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)),
    removed,
    rejected,
    windowSec
  };
}

function collapseByFeedUrl(items) {
  return dedupeFeedItems(items, { log: false }).items;
}

function validateFeedIntegrity(items) {
  const list = Array.isArray(items) ? items : [];
  const issues = [];
  const seenUrl = new Map();
  const seenTitle = new Map();
  const seenHash = new Map();

  list.forEach((item, idx) => {
    if (isEmptyFeedItem(item)) {
      issues.push({ type: 'empty_entry', index: idx, id: item?.id });
      return;
    }

    if (item.hash != null && isPlaceholderHash(item.hash)) {
      issues.push({ type: 'placeholder_hash', index: idx, id: item.id, hash: item.hash });
    }

    if (item.hashWindowSec != null && (!Number.isFinite(item.hashWindowSec) || item.hashWindowSec <= 0)) {
      issues.push({ type: 'malformed_window', index: idx, id: item.id, hashWindowSec: item.hashWindowSec });
    }

    if (
      hasExplicitTruncation(item?.title) ||
      hasExplicitTruncation(item?.summary) ||
      hasExplicitTruncation(item?.text)
    ) {
      issues.push({
        type: 'truncated_copy',
        index: idx,
        id: item.id,
        sample: String(item.title || item.summary || '').slice(0, 60)
      });
    }

    const url = feedItemUrl(item);
    if (url) {
      if (seenUrl.has(url)) {
        issues.push({ type: 'duplicate_url', url, indices: [seenUrl.get(url), idx] });
      } else seenUrl.set(url, idx);
    }

    const title = normalizeTitleKey(item);
    if (title.length > 12) {
      if (seenTitle.has(title)) {
        issues.push({ type: 'duplicate_title', title, indices: [seenTitle.get(title), idx] });
      } else seenTitle.set(title, idx);
    }

    const norm = normalizeFeedText(item);
    const hash = isPlaceholderHash(item.hash) ? contentHash(norm) : item.hash;
    if (seenHash.has(hash)) {
      issues.push({ type: 'duplicate_hash', hash, indices: [seenHash.get(hash), idx] });
    } else seenHash.set(hash, idx);
  });

  return { ok: !issues.length, issues, count: list.length };
}

function shouldRejectFeedUpsert(item, existingItems) {
  if (isEmptyFeedItem(item)) {
    return { reject: true, reason: 'empty_entry' };
  }
  if (isTruncatedFeedItem(item)) {
    return { reject: true, reason: 'truncated_copy' };
  }
  const enriched = enrichFeedItem(item);
  const selfKey = item?.dedupeKey || item?.id;
  const peers = (existingItems || []).filter((row) => {
    if (!selfKey) return true;
    return (row?.dedupeKey || row?.id) !== selfKey;
  });
  const dup = findDuplicateReason(peers, enriched);
  if (dup) {
    return {
      reject: true,
      reason: dup.reason,
      duplicateOf: peers[dup.index]?.id,
      hash: dup.hash,
      windowSec: dup.windowSec
    };
  }
  return { reject: false, enriched };
}

function repairFeedItems(items, opts = {}) {
  const before = Array.isArray(items) ? items.length : 0;
  const result = dedupeFeedItems(items, {
    rejectTruncated: false,
    log: opts.log !== false,
    ...opts
  });
  const enriched = result.items.map((item) => enrichFeedItem(item, { windowSec: opts.windowSec }));
  const validation = validateFeedIntegrity(enriched);
  return {
    ...result,
    items: enriched,
    before,
    after: enriched.length,
    removedCount: result.removed.length,
    rejectedCount: result.rejected.length,
    validation
  };
}

module.exports = {
  DEDUP_WINDOW_MS,
  DEDUP_WINDOW_SEC,
  SIMILARITY_THRESHOLD,
  LOG_PATH,
  normalizeFeedText,
  normalizePlayerName,
  normalizePosition,
  contentHash,
  isPlaceholderHash,
  hasExplicitTruncation,
  isTruncatedAutoposterBody,
  isTruncatedFeedItem,
  isEmptyFeedItem,
  enrichFeedItem,
  feedDedupeKey,
  feedItemPlayerId,
  feedItemEventType,
  feedItemUrl,
  similarityRatio,
  findDuplicateReason,
  dedupeFeedItems,
  collapseByFeedUrl,
  validateFeedIntegrity,
  shouldRejectFeedUpsert,
  repairFeedItems,
  appendDedupeLog
};
