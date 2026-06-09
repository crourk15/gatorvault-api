const recruitingStore = require('./recruiting-store');
const intelStore = require('./recruiting-intel-store');
const contentStore = require('./content-store');
const liveStore = require('./live-store');
const monitoring = require('./recruiting-monitoring');
const { feedDedupeKeyForCommit, commitFingerprint, feedDedupeKeyForIntel } = require('./commit-fingerprint');
const { refreshBeatStream, getBeatPosts } = require('./live-beat');
const { refreshPodcasts, getPodcastHub } = require('./live-podcasts');

const EVENT_TYPE_MAP = {
  commit: 'commit',
  flip: 'commit',
  decommit: 'commit',
  portal_in: 'portal',
  portal_out: 'portal',
  target_update: 'offer',
  official_visit: 'visit',
  unofficial_visit: 'visit',
  visit_cancelled: 'visit',
  ov_change: 'visit',
  visit: 'visit',
  prediction: 'prediction',
  ranking_change: 'prediction',
  trending: 'trending',
  heat_check: 'trending'
};

function isTestRecruitingEvent(ev) {
  const title = String(ev.title || '').toLowerCase();
  const slug = String(ev.playerSlug || '').toLowerCase();
  if (slug === 'test-recruit' || (slug === 'maxwell-hiller' && ev.source === 'manual')) return true;
  if (title.includes('test recruit') || title.includes('preview:')) return true;
  if (title.includes('ingest') || title.includes('class ranking')) return true;
  return false;
}

async function ingestRecruitingEvents() {
  const events = await recruitingStore.getEvents({ limit: 200 });
  const playerIndex = liveStore.loadPlayerIndex();
  let count = 0;
  events.forEach((ev) => {
    if (isTestRecruitingEvent(ev)) return;
    if (ev.eventType === 'decommit') {
      const decommitValidator = require('./decommit-validator');
      if (decommitValidator.isFalseInferredDecommitEvent(ev)) {
        monitoring
          .sendMonitoringAlert({
            level: 'info',
            type: 'aggregator_skip',
            eventType: ev.eventType,
            player: ev.payload?.player?.name || ev.playerSlug,
            playerSlug: ev.playerSlug,
            reason: 'Unverified event skipped',
            source: ev.source || 'on3',
            meta: { eventId: ev.id }
          })
          .catch((e) => console.warn('[monitoring]', e.message));
        return;
      }
    }
    const player = playerIndex.bySlug.get(ev.playerSlug) || ev.payload?.player || null;
    const stableCommitKey =
      ev.eventType === 'commit' || ev.eventType === 'flip'
        ? feedDedupeKeyForCommit(ev.playerSlug, player) || `commit:${ev.playerSlug}`
        : ev.eventType === 'decommit'
          ? `decommit:${ev.playerSlug}:${ev.id}`
          : `rec_${ev.id}`;
    const classified = liveStore.classifyFeedItem(
      {
        id: stableCommitKey,
        dedupeKey: stableCommitKey,
        type: EVENT_TYPE_MAP[ev.eventType] || 'info',
        title: ev.title,
        summary: ev.skinny || ev.detail || '',
        source_url: ev.playerSlug ? `/player/${ev.playerSlug}` : '/recruit',
        imageUrl: null,
        source: ev.source || 'on3',
        author: 'GatorVault Recruiting',
        createdAt: ev.createdAt,
        meta: {
          eventType: ev.eventType,
          playerSlug: ev.playerSlug,
          player,
          on3: true,
          commitFingerprint: commitFingerprint(player)
        }
      },
      playerIndex
    );
    if (!classified) return;
    liveStore.upsertFeedItem(classified);
    count += 1;
  });
  return count;
}

async function ingestRecruitingIntel() {
  const intelItems = intelStore.listIntel({ limit: 100 });
  const playerIndex = liveStore.loadPlayerIndex();
  let count = 0;

  intelItems.forEach((intel) => {
    const stableKey = feedDedupeKeyForIntel(intel) || `intel_${intel.id}`;
    const player =
      playerIndex.bySlug.get(intel.playerSlug) ||
      (intel.playerSlug ? { slug: intel.playerSlug, name: intel.playerName } : null);
    const title =
      intel.eventType === 'official_visit'
        ? `${intel.playerName || 'Recruit'} — Official Visit Scheduled`
        : intel.eventType === 'unofficial_visit'
          ? `${intel.playerName || 'Recruit'} — Unofficial Visit`
          : intel.eventType === 'visit_cancelled' || intel.eventType === 'ov_change'
            ? `${intel.playerName || 'Recruit'} — OV to Florida Cancelled`
            : `${intel.playerName || 'Recruit'} — ${intel.status || intel.eventType || 'Intel'}`;

    const classified = liveStore.classifyFeedItem(
      {
        id: stableKey,
        dedupeKey: stableKey,
        type: EVENT_TYPE_MAP[intel.eventType] || 'visit',
        title,
        summary: intel.detail || intel.status || '',
        source_url: intel.playerSlug ? `/player/${intel.playerSlug}` : '/recruit',
        imageUrl: null,
        source: intel.source || 'intel',
        author: intel.source || 'GatorVault Recruiting',
        createdAt: intel.reportedAt || intel.createdAt,
        meta: {
          eventType: intel.eventType,
          playerSlug: intel.playerSlug,
          player,
          intelFingerprint: intel.fingerprint,
          visitStart: intel.visitStart,
          visitEnd: intel.visitEnd,
          status: intel.status || (intel.eventType === 'official_visit' ? 'Official Visit Scheduled' : null)
        }
      },
      playerIndex
    );
    if (!classified) return;
    liveStore.upsertFeedItem(classified);
    count += 1;
  });

  return count;
}

function ingestPublishedContent() {
  let count = 0;
  try {
    const articles = contentStore.loadPublishedArticles();
    articles.slice(0, 8).forEach((a) => {
      liveStore.upsertFeedItem({
        id: `art_${a.id || a.title}`,
        dedupeKey: `art_${a.id || a.title}`,
        type: 'article',
        title: a.title,
        summary: a.excerpt || '',
        source_url: a.id ? `/article/${a.id}` : '/articles',
        imageUrl: null,
        source: 'content',
        author: a.author || 'GatorVault',
        createdAt: a.publishedAt || a.date || liveStore.nowIso(),
        meta: { tier: a.tier, articleId: a.id }
      });
      count += 1;
    });
  } catch (e) {
    /* content optional */
  }
  return count;
}

async function refreshLiveDashboard({ beat = true, podcasts = true, recruiting = true } = {}) {
  const results = { recruiting: 0, content: 0, beat: null, podcasts: null, reclassified: null };
  liveStore.purgeTestFeedItems();
  results.reclassified = liveStore.reclassifyFeedItems();
  if (recruiting) {
    results.recruiting = await ingestRecruitingEvents();
    results.intel = await ingestRecruitingIntel();
  }
  results.content = ingestPublishedContent();
  if (beat) {
    try {
      results.beat = await refreshBeatStream();
    } catch (e) {
      results.beat = { error: e.message };
    }
  }
  if (podcasts) {
    try {
      results.podcasts = await refreshPodcasts();
    } catch (e) {
      results.podcasts = { error: e.message };
    }
  }
  return results;
}

function getDashboard({ feedLimit = 60 } = {}) {
  return {
    feed: liveStore.getFeedItems({ limit: feedLimit, categoriesOnly: true }),
    beat: getBeatPosts(40),
    podcasts: getPodcastHub(),
    updatedAt: liveStore.nowIso()
  };
}

module.exports = {
  refreshLiveDashboard,
  getDashboard,
  isTestRecruitingEvent,
  ingestRecruitingEvents,
  ingestRecruitingIntel,
  ingestPublishedContent
};
