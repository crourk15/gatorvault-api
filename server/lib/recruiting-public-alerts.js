/**
 * Public Recruiting Alerts gate — only validated, fan-facing intel reaches the alerts feed.
 * Internal ingest pipeline, snapshot rows, and unverified commits stay off the public page.
 */
const store = require('./recruiting-store');
const intelStore = require('./recruiting-intel-store');
const liveStore = require('./live-store');
const autoposterStore = require('./x-autoposter-store');

const VERIFIED_COMMIT_SOURCES = new Set(['on3', 'manual']);
const VERIFIED_INTEL_SOURCES = new Set(['on3', 'manual', 'rivals_pm']);

const INTERNAL_EVENT_SOURCES = new Set([
  'beat_writer_ingest',
  'beat_visit_intel',
  'auto:intel',
  'auto:beat-intel',
  'auto:beat-momentum',
  'auto:beat-writer',
  'needs_resolution',
  'snapshot',
  'internal'
]);

const BREWSTER_SLUGS = new Set(['jalen-brewster', 'brewster-jalen']);
const DAVIN_DAVIDSON_SLUGS = new Set(['davin-davidson']);

function normalizeSlug(slug) {
  return String(slug || '')
    .toLowerCase()
    .trim();
}

function normalizeNameKey(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function isBrewsterIdentity({ playerSlug, playerName, title, detail, text } = {}) {
  const slug = normalizeSlug(playerSlug);
  if (BREWSTER_SLUGS.has(slug) || slug.includes('brewster')) return true;
  const nameKey = normalizeNameKey(playerName);
  if (nameKey.includes('jalenbrewster') || nameKey === 'brewster') return true;
  const blob = `${title || ''} ${detail || ''} ${text || ''}`.toLowerCase();
  return /\bjalen\s+brewster\b/.test(blob) || /\bbrewster\b/.test(blob);
}

function isDavinDavidsonIdentity({ playerSlug, playerName, title, detail, text, summary } = {}) {
  const slug = normalizeSlug(playerSlug);
  if (DAVIN_DAVIDSON_SLUGS.has(slug)) return true;
  const nameKey = normalizeNameKey(playerName || title);
  if (nameKey.includes('davindavidson')) return true;
  const blob = `${title || ''} ${detail || ''} ${text || ''} ${summary || ''}`.toLowerCase();
  return /\bdavin\s+davidson\b/.test(blob);
}

function isFalseDavidsonDecommit(record) {
  if (!isDavinDavidsonIdentity(record)) return false;
  const et = String(record.eventType || record.type || '').toLowerCase();
  const blob = `${record.title || ''} ${record.detail || ''} ${record.summary || ''} ${record.text || ''}`.toLowerCase();
  return et === 'decommit' || /\bdecommit/.test(blob);
}

function isInvalidHsRecruitPortalHeadline(item) {
  const slug = normalizeSlug(item?.meta?.playerSlug);
  const et = String(item?.meta?.eventType || item?.type || '').toLowerCase();
  const isPortal =
    et === 'portal_in' || et === 'portal_out' || String(item?.type || '').toLowerCase() === 'portal';
  if (!isPortal) return false;

  if (isBrewsterIdentity({ playerSlug: slug, title: item?.title, summary: item?.summary })) return true;

  const player = item?.meta?.player;
  if (!player) return slug.includes('brewster');
  const cat = String(player.category || '').toLowerCase();
  if (cat === 'portal') return false;
  if (['recruit', 'target', 'commit'].includes(cat)) return true;
  const classYear = parseInt(player.classYear, 10);
  return Number.isFinite(classYear) && classYear >= 2026 && classYear <= 2032;
}

function isInvalidHeadlineFeedItem(item) {
  if (!item) return true;
  if (isBrewsterFalseFeedItem(item)) return true;
  if (
    isFalseDavidsonDecommit({
      playerSlug: item.meta?.playerSlug,
      title: item.title,
      summary: item.summary,
      eventType: item.meta?.eventType || item.type,
      type: item.type
    })
  ) {
    return true;
  }
  if (isInvalidHsRecruitPortalHeadline(item)) return true;
  return false;
}

function isBrewsterFalseCommit(record) {
  if (!isBrewsterIdentity(record)) return false;
  const et = String(record.eventType || record.type || '').toLowerCase();
  const blob = `${record.title || ''} ${record.detail || ''} ${record.text || ''} ${record.skinny || ''} ${record.summary || ''} ${record.status || ''}`.toLowerCase();
  if (et === 'commit' || et === 'flip') return true;
  if (/committed\s*[·•\-–—]\s*florida/i.test(blob)) return true;
  if (/\bhas committed to florida\b/i.test(blob)) return true;
  if (/\bcommits to florida\b/i.test(blob) && !/\btexas tech\b/i.test(blob)) return true;
  if (/\b5\s*[★*]?\s*dl jalen brewster has committed to florida\b/i.test(blob)) return true;
  return false;
}

function isMisclassifiedExternalCommitVisit(record) {
  const blob = `${record.title || ''} ${record.detail || ''} ${record.summary || ''} ${record.text || ''}`.toLowerCase();
  const et = String(record.eventType || record.type || '').toLowerCase();
  if (et !== 'commit' && et !== 'flip') return false;
  if (/\b(?:taking|take|takes|set for|scheduled for)\s+(?:an?\s+)?official visit\b/i.test(blob)) return true;
  if (/\btexas tech\b.*\bcommit\b/i.test(blob) && /\b(?:florida|gators|\buf\b|gainesville)\b/i.test(blob)) {
    return true;
  }
  if (/\bcommit\b/i.test(blob) && !/\b(?:committed|commits?)\s+to\s+(?:florida|the gators|\buf\b)/i.test(blob)) {
    if (/\b(?:official visit|visit to florida|on campus|in gainesville)\b/i.test(blob)) return true;
  }
  return false;
}

function isInternalEventSource(source) {
  const s = String(source || '').toLowerCase();
  if (!s) return true;
  if (INTERNAL_EVENT_SOURCES.has(s)) return true;
  if (/beat.?writer|auto:beat|needs_resolution|snapshot|internal|auto:intel/.test(s)) return true;
  return false;
}

function eventIdentityConfirmed(event) {
  const p = event?.payload || {};
  return !!(
    p.identityConfirmed ||
    p.beatVisit?.identityConfirmed ||
    p.autoposterApproved ||
    p.publicApproved ||
    p.alertPosted
  );
}

/**
 * Whether a recruiting event may appear on the public Recruiting Alerts page / poll API.
 */
function isPublicRecruitingEvent(event) {
  if (!event || !event.eventType) return false;
  if (isBrewsterFalseCommit(event)) return false;
  if (isFalseDavidsonDecommit(event)) return false;

  const source = String(event.source || '').toLowerCase();
  const et = String(event.eventType).toLowerCase();

  if (isBrewsterIdentity(event) && (et === 'portal_in' || et === 'portal_out')) return false;

  if (isInternalEventSource(source)) return false;

  if (et === 'commit' || et === 'flip') {
    return VERIFIED_COMMIT_SOURCES.has(source);
  }

  if (et === 'decommit') {
    try {
      const decommitValidator = require('./decommit-validator');
      if (decommitValidator.isFalseInferredDecommitEvent(event)) return false;
    } catch {
      /* optional */
    }
    return VERIFIED_COMMIT_SOURCES.has(source) || !!event.payload?.verifiedDecommit;
  }

  if (
    ['official_visit', 'unofficial_visit', 'visit_cancelled', 'ov_change', 'offer', 'target_update'].includes(
      et
    )
  ) {
    if (VERIFIED_INTEL_SOURCES.has(source)) return true;
    if (/beat|auto:/.test(source)) return eventIdentityConfirmed(event);
    return false;
  }

  if (et === 'prediction' || et === 'rivals_futurecast') {
    if (VERIFIED_INTEL_SOURCES.has(source)) return true;
    return eventIdentityConfirmed(event);
  }

  if (et === 'ranking_change' || et === 'portal_in' || et === 'portal_out') {
    return VERIFIED_INTEL_SOURCES.has(source);
  }

  return VERIFIED_INTEL_SOURCES.has(source);
}

function isPublicIntelItem(intel) {
  if (!intel) return false;
  if (intel.resolutionStatus === 'needs_resolution' || intel.surfaced === false) return false;
  if (isBrewsterFalseCommit(intel)) return false;
  if (isMisclassifiedExternalCommitVisit(intel)) return false;
  if (/^committed\s*[·•\-–—]\s*florida$/i.test(String(intel.status || '').trim())) return false;

  const source = String(intel.source || '').toLowerCase();
  const et = String(intel.eventType || '').toLowerCase();

  if (isInternalEventSource(source)) return false;

  if (et === 'commit' || et === 'flip') return false;

  if (VERIFIED_INTEL_SOURCES.has(source)) {
    if (et === 'prediction' || et === 'rivals_futurecast') return true;
    return !!intel.identityConfirmed;
  }

  if (/beat|auto:/.test(source)) {
    return !!(intel.identityConfirmed && (intel.alertPosted || intel.xPostQueued));
  }

  return false;
}

function filterPublicEvents(events) {
  return (events || []).filter(isPublicRecruitingEvent);
}

function isBrewsterFalseFeedItem(item) {
  if (!item) return false;
  const record = {
    playerSlug: item.meta?.playerSlug,
    title: item.title,
    summary: item.summary,
    detail: item.summary,
    eventType: item.meta?.eventType || item.type,
    type: item.type
  };
  if (isBrewsterFalseCommit(record)) return true;
  if (isMisclassifiedExternalCommitVisit(record)) return true;
  return false;
}

function isPublicLiveFeedItem(item) {
  if (!item) return false;
  if (isInvalidHeadlineFeedItem(item)) return false;
  if (isBrewsterFalseFeedItem(item)) return false;
  const titleSummary = `${item.title || ''} ${item.summary || ''}`;
  if (
    isBrewsterIdentity({ playerSlug: item.meta?.playerSlug, title: item.title, summary: item.summary }) &&
    /committed\s*[·•\-–—]\s*florida/i.test(titleSummary)
  ) {
    return false;
  }
  if (isMisclassifiedExternalCommitVisit({
    title: item.title,
    summary: item.summary,
    eventType: item.meta?.eventType || item.type,
    type: item.type
  })) {
    return false;
  }
  const et = String(item.meta?.eventType || item.type || '').toLowerCase();
  const source = String(item.source || item.meta?.source || '').toLowerCase();
  if (et === 'commit' || et === 'flip') {
    if (source !== 'on3' && source !== 'manual' && !item.meta?.on3) return false;
    const player = item.meta?.player;
    if (player && player.committedTo && !/^florida$/i.test(String(player.committedTo).trim())) return false;
    if (isBrewsterIdentity({ playerSlug: item.meta?.playerSlug, title: item.title, summary: item.summary })) {
      return false;
    }
  }
  if (/beat.?writer|auto:beat|needs_resolution|snapshot|internal/.test(source)) {
    if (et === 'commit' || et === 'flip') return false;
    if (!item.meta?.identityConfirmed && !item.meta?.alertPosted) return false;
  }
  return true;
}

function filterPublicLiveFeed(items) {
  return (items || []).filter(isPublicLiveFeedItem);
}

function isBrewsterFalseQueueItem(item) {
  if (!item) return false;
  return isBrewsterFalseCommit({
    playerSlug: item.playerSlug,
    playerName: item.playerName,
    text: item.text,
    eventType: item.intelType || item.sourceEventType
  });
}

async function countBrewsterFalseIntel() {
  const events = await store.getEvents({ limit: 5000 });
  const intel = intelStore.listIntel({ limit: 5000 });
  const feed = liveStore.getFeedItems({ limit: 5000, categoriesOnly: false });
  const queue = autoposterStore.loadQueue();
  return {
    falseCommitEvents: events.filter(isBrewsterFalseCommit).length,
    falseCommitIntel: intel.filter(isBrewsterFalseCommit).length,
    falseCommitFeed: feed.filter(isBrewsterFalseFeedItem).length,
    falseCommitQueue: (queue.items || []).filter(isBrewsterFalseQueueItem).length
  };
}

async function runPurgeFalseBrewsterIntel(options = {}) {
  const before = await countBrewsterFalseIntel();

  const eventResult = await store.deleteEventsMatching((e) => isBrewsterFalseCommit(e));
  const intelResult = intelStore.removeIntelMatching(
    (i) =>
      isBrewsterFalseCommit(i) ||
      isMisclassifiedExternalCommitVisit(i) ||
      (isBrewsterIdentity(i) && /^committed\s*[·•\-–—]\s*florida$/i.test(String(i.status || '').trim()))
  );
  const feedResult = liveStore.removeFeedItemsMatching(
    (item) =>
      isBrewsterFalseFeedItem(item) ||
      isMisclassifiedExternalCommitVisit({
        title: item.title,
        summary: item.summary,
        eventType: item.meta?.eventType || item.type,
        type: item.type
      }) ||
      (normalizeSlug(item.meta?.playerSlug) === 'jalen-brewster' &&
        String(item.meta?.eventType || item.type || '').toLowerCase() === 'commit')
  );

  const queueDoc = autoposterStore.loadQueue();
  const queueBefore = queueDoc.items.length;
  queueDoc.items = queueDoc.items.filter((i) => !isBrewsterFalseQueueItem(i));
  autoposterStore.saveQueue(queueDoc);
  const queueResult = { removed: queueBefore - queueDoc.items.length, kept: queueDoc.items.length };

  let playerFix = null;
  try {
    const existing = await store.getPlayerBySlug('jalen-brewster');
    if (existing && (existing.status === 'committed' || existing.committedTo)) {
      playerFix = await store.upsertPlayer({
        ...existing,
        status: 'uncommitted',
        committedTo: null,
        category: 'target',
        commitDate: null
      });
    }
  } catch {
    /* optional */
  }

  let refreshed = null;
  if (options.refresh !== false) {
    try {
      const { refreshLiveDashboard } = require('./live-aggregator');
      refreshed = await refreshLiveDashboard({ beat: true, podcasts: false, recruiting: true });
    } catch (e) {
      refreshed = { error: e.message };
    }
  }

  const after = await countBrewsterFalseIntel();

  return {
    before,
    eventResult,
    intelResult,
    feedResult,
    queueResult,
    playerFix: playerFix ? { slug: playerFix.slug, status: playerFix.status } : null,
    refreshed,
    after,
    clean:
      after.falseCommitEvents === 0 &&
      after.falseCommitIntel === 0 &&
      after.falseCommitFeed === 0 &&
      after.falseCommitQueue === 0
  };
}

function isStalePreGm2HeadlineEvent(event) {
  if (!event) return false;
  if (isBrewsterFalseCommit(event)) return true;
  if (isFalseDavidsonDecommit(event)) return true;
  if (isMisclassifiedExternalCommitVisit(event)) return true;
  const et = String(event.eventType || '').toLowerCase();
  const slug = normalizeSlug(event.playerSlug);
  if (slug.includes('brewster') && (et === 'portal_in' || et === 'portal_out')) return true;
  try {
    const decommitValidator = require('./decommit-validator');
    if (et === 'decommit' && decommitValidator.isFalseInferredDecommitEvent(event)) return true;
  } catch {
    /* optional */
  }
  return false;
}

async function runPurgeInvalidHeadlines(options = {}) {
  const intelStore = require('./recruiting-intel-store');
  const beforeFeed = liveStore.getFeedItems({ limit: 5000, categoriesOnly: false }).filter(isInvalidHeadlineFeedItem).length;

  const feedResult = liveStore.removeFeedItemsMatching(isInvalidHeadlineFeedItem);
  const eventResult = await store.deleteEventsMatching(isStalePreGm2HeadlineEvent);
  const intelResult = intelStore.removeIntelMatching(
    (i) =>
      isBrewsterFalseCommit(i) ||
      isFalseDavidsonDecommit(i) ||
      isMisclassifiedExternalCommitVisit(i) ||
      (normalizeSlug(i.playerSlug).includes('brewster') &&
        /portal/.test(String(i.eventType || '').toLowerCase()))
  );

  let refreshed = null;
  if (options.refresh !== false) {
    try {
      const { refreshLiveDashboard } = require('./live-aggregator');
      refreshed = await refreshLiveDashboard({ beat: false, podcasts: false, recruiting: true });
    } catch (e) {
      refreshed = { error: e.message };
    }
  }

  const afterFeed = liveStore.getFeedItems({ limit: 5000, categoriesOnly: false }).filter(isInvalidHeadlineFeedItem).length;

  return {
    before: { invalidHeadlines: beforeFeed },
    feedResult,
    eventResult,
    intelResult,
    refreshed,
    after: { invalidHeadlines: afterFeed },
    clean: afterFeed === 0
  };
}

module.exports = {
  isBrewsterFalseCommit,
  isBrewsterFalseQueueItem,
  isBrewsterFalseFeedItem,
  isFalseDavidsonDecommit,
  isInvalidHsRecruitPortalHeadline,
  isInvalidHeadlineFeedItem,
  isMisclassifiedExternalCommitVisit,
  isPublicLiveFeedItem,
  filterPublicLiveFeed,
  isPublicRecruitingEvent,
  isPublicIntelItem,
  filterPublicEvents,
  runPurgeFalseBrewsterIntel,
  runPurgeInvalidHeadlines,
  isStalePreGm2HeadlineEvent,
  countBrewsterFalseIntel
};
