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

function isBrewsterFalseCommit(record) {
  if (!isBrewsterIdentity(record)) return false;
  const et = String(record.eventType || record.type || '').toLowerCase();
  const blob = `${record.title || ''} ${record.detail || ''} ${record.text || ''} ${record.skinny || ''}`.toLowerCase();
  if (et === 'commit' || et === 'flip') return true;
  if (/\bcommit(?:ted|ment)?\b/.test(blob) && /\bflorida|\bgators\b|\buf\b/.test(blob)) return true;
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

  const source = String(event.source || '').toLowerCase();
  const et = String(event.eventType).toLowerCase();

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
  if (!isBrewsterIdentity({ playerSlug: item.meta?.playerSlug, title: item.title, detail: item.summary })) {
    return false;
  }
  const et = String(item.meta?.eventType || item.type || '').toLowerCase();
  const blob = `${item.title || ''} ${item.summary || ''}`.toLowerCase();
  if (et === 'commit' || et === 'beat') {
    if (/\bcommit/.test(blob)) return true;
  }
  if (/\bcommit(?:ted|ment)?\b/.test(blob) && /\bflorida|\bgators\b/.test(blob)) return true;
  return false;
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
  const intelResult = intelStore.removeIntelMatching((i) => isBrewsterFalseCommit(i));
  const feedResult = liveStore.removeFeedItemsMatching(
    (item) => isBrewsterFalseFeedItem(item) || isBrewsterFalseCommit({ title: item.title, detail: item.summary, eventType: item.meta?.eventType })
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

module.exports = {
  isBrewsterFalseCommit,
  isBrewsterFalseFeedItem,
  isPublicRecruitingEvent,
  isPublicIntelItem,
  filterPublicEvents,
  runPurgeFalseBrewsterIntel,
  countBrewsterFalseIntel
};
