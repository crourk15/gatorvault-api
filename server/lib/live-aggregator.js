const recruitingStore = require('./recruiting-store');
const contentStore = require('./content-store');
const liveStore = require('./live-store');
const { refreshBeatStream, getBeatPosts } = require('./live-beat');
const { refreshPodcasts, getPodcastHub } = require('./live-podcasts');

const EVENT_TYPE_MAP = {
  commit: 'commit',
  flip: 'commit',
  decommit: 'commit',
  portal_in: 'portal',
  portal_out: 'portal',
  target_update: 'offers',
  ranking_change: null
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
    const player = playerIndex.bySlug.get(ev.playerSlug) || ev.payload?.player || null;
    const stableCommitKey =
      ev.eventType === 'commit' || ev.eventType === 'flip'
        ? `commit:${ev.playerSlug}`
        : ev.eventType === 'decommit'
          ? `decommit:${ev.playerSlug}:${ev.id}`
          : `rec_${ev.id}`;
    const classified = liveStore.classifyFeedItem(
      {
        id: stableCommitKey,
        dedupeKey: stableCommitKey,
        type: EVENT_TYPE_MAP[ev.eventType] || 'breaking',
        title: ev.title,
        summary: ev.skinny || ev.detail || '',
        source_url: ev.playerSlug ? `/player/${ev.playerSlug}` : '/recruit',
        imageUrl: null,
        source: ev.source || 'on3',
        author: 'GatorVault Recruiting',
        createdAt: ev.createdAt,
        meta: { eventType: ev.eventType, playerSlug: ev.playerSlug, player, on3: true }
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
  if (recruiting) results.recruiting = await ingestRecruitingEvents();
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
  ingestPublishedContent
};
