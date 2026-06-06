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
  target_update: 'breaking',
  ranking_change: 'breaking'
};

function isTestRecruitingEvent(ev) {
  const title = String(ev.title || '').toLowerCase();
  const slug = String(ev.playerSlug || '').toLowerCase();
  if (slug === 'maxwell-hiller' && ev.source === 'manual') return true;
  if (title.includes('preview:')) return true;
  return false;
}

async function ingestRecruitingEvents() {
  const events = await recruitingStore.getEvents({ limit: 40 });
  let count = 0;
  events.forEach((ev) => {
    if (isTestRecruitingEvent(ev)) return;
    const type = EVENT_TYPE_MAP[ev.eventType] || 'breaking';
    liveStore.upsertFeedItem({
      id: `rec_${ev.id}`,
      dedupeKey: `rec_${ev.id}`,
      type,
      title: ev.title,
      summary: ev.skinny || ev.detail || '',
      url: ev.playerSlug ? `/player/${ev.playerSlug}` : null,
      imageUrl: null,
      source: ev.source || 'recruiting',
      author: 'GatorVault Recruiting',
      createdAt: ev.createdAt,
      meta: { eventType: ev.eventType, playerSlug: ev.playerSlug }
    });
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
        url: '/#articles',
        imageUrl: null,
        source: 'content',
        author: a.author || 'GatorVault',
        createdAt: a.publishedAt || a.date || liveStore.nowIso(),
        meta: { tier: a.tier }
      });
      count += 1;
    });
  } catch (e) {
    /* content optional */
  }
  return count;
}

async function refreshLiveDashboard({ beat = true, podcasts = true, recruiting = true } = {}) {
  const results = { recruiting: 0, content: 0, beat: null, podcasts: null };
  liveStore.purgeTestFeedItems();
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
    feed: liveStore.getFeedItems({ limit: feedLimit }),
    beat: getBeatPosts(40),
    podcasts: getPodcastHub(),
    updatedAt: liveStore.nowIso()
  };
}

module.exports = {
  refreshLiveDashboard,
  getDashboard,
  isTestRecruitingEvent,
  ingestRecruitingEvents
};
