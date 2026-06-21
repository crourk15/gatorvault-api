/**
 * Vault dashboard APIs — ticker, latest content, personalized hints.
 */
const contentStore = require('./content-store');
const communityStore = require('./community-store');

const CACHE = {
  ticker: { ttlMs: 30_000, payload: null, at: 0 },
  content: { ttlMs: 120_000, payload: null, at: 0 },
};

function nowIso() {
  return new Date().toISOString();
}

function getLiveDash(feedLimit = 40) {
  const dashCache = require('./live-dashboard-cache');
  return dashCache.getCachedDashboard({ feedLimit });
}

function categorizeFeedItem(item) {
  const blob = `${item.type || ''} ${item.title || ''} ${item.source || ''}`.toLowerCase();
  if (blob.includes('portal') || blob.includes('transfer')) return 'portal';
  if (blob.includes('nil') || blob.includes('collective')) return 'nil';
  if (blob.includes('injur') || blob.includes('out for')) return 'injury';
  if (blob.includes('staff') || blob.includes('coach')) return 'staff';
  if (blob.includes('commit') || blob.includes('recruit') || blob.includes('ov')) return 'recruiting';
  return 'breaking';
}

function buildTickerItems() {
  const dash = getLiveDash(50);
  const items = [];
  const seen = new Set();

  function push(item) {
    const key = String(item.text || '').slice(0, 80);
    if (!key || seen.has(key)) return;
    seen.add(key);
    items.push(item);
  }

  for (const row of dash.feed || []) {
    const text = String(row.title || '').trim();
    if (!text) continue;
    push({
      id: row.id || `feed_${items.length}`,
      text,
      category: categorizeFeedItem(row),
      url: row.url || '/vault/live',
      source: row.source || 'GatorNation Live',
    });
  }

  for (const post of dash.beat?.posts || []) {
    const snippet = String(post.text || '').trim().replace(/\s+/g, ' ').slice(0, 140);
    if (!snippet) continue;
    const writer = post.writerName || post.handle || post.outlet || 'Beat Writer';
    push({
      id: post.id || `beat_${items.length}`,
      text: `${writer}: ${snippet}`,
      category: 'beat',
      url: post.url || '/vault/live?tab=beat',
      source: post.outlet || 'Beat Writer',
    });
  }

  return items.slice(0, 36);
}

function buildStoryline(items) {
  const pick =
    items.find((i) => i.category === 'recruiting') ||
    items.find((i) => i.category === 'beat') ||
    items[0];
  if (!pick) {
    return 'GatorNation is live — recruiting, portal, and beat writers updating all day.';
  }
  return pick.text;
}

function buildHotCarousel(items) {
  return items.slice(0, 5).map((item) => ({
    id: item.id,
    title: item.text.length > 72 ? `${item.text.slice(0, 69)}…` : item.text,
    category: item.category,
    url: item.url,
  }));
}

function cached(key, builder) {
  const slot = CACHE[key];
  const now = Date.now();
  if (slot.payload && now - slot.at < slot.ttlMs) return slot.payload;
  slot.payload = builder();
  slot.at = now;
  return slot.payload;
}

function getFilmRoomLatest() {
  try {
    const filmRoom = require('./film-room-feed');
    const catalog = filmRoom.buildFilmRoomCatalog();
    return (catalog.items || []).slice(0, 8).map((item) => ({
      id: item.id,
      title: item.title,
      category: item.filmHub || item.category || 'Film Room',
      timestamp: null,
      icon: '📺',
      href: '/vault/film-room',
    }));
  } catch {
    return [];
  }
}

function buildLatestContent() {
  const feed = contentStore.getPublishedFeed();
  const dash = getLiveDash(20);
  const threads = communityStore
    .loadThreads()
    .filter((t) => !t.deleted)
    .sort((a, b) => new Date(b.lastActivityAt || b.createdAt) - new Date(a.lastActivityAt || a.createdAt))
    .slice(0, 8);

  const articles = (feed.articles || []).slice(0, 8).map((a) => ({
    id: a.id,
    title: a.title,
    timestamp: a.publishedAt || a.date || null,
    icon: '📰',
    source: a.author || 'GatorVault Insider',
    href: `/vault/articles#${a.id}`,
  }));

  const podcasts = (dash.podcasts?.shows || []).slice(0, 8).map((show, idx) => ({
    id: show.id || `pod_${idx}`,
    title: show.title || show.name || 'Gator Podcast',
    timestamp: dash.updatedAt || null,
    icon: '🎙️',
    source: 'Podcast Hub',
    href: '/vault/live?tab=podcasts',
  }));

  const filmRoom = getFilmRoomLatest();
  const community = threads.map((t) => ({
    id: t.id,
    title: t.title,
    timestamp: t.lastActivityAt || t.createdAt || null,
    icon: '💬',
    source: t.categoryLabel || 'Community',
    href: `/vault/community?thread=${encodeURIComponent(t.id)}`,
    replyCount: t.replyCount || 0,
  }));

  return {
    articles,
    podcasts,
    filmRoom,
    community,
    updatedAt: nowIso(),
  };
}

function buildPersonalizedHints(req) {
  const followRaw = String(req.query.followPlayers || req.query.follow || '');
  const followPlayers = followRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20);

  const ticker = buildTickerItems();
  const alerts = ticker.slice(0, 6).map((item) => ({
    id: item.id,
    title: item.text.length > 64 ? `${item.text.slice(0, 61)}…` : item.text,
    category: item.category,
    url: item.url,
    isNew: item.category === 'recruiting' || item.category === 'breaking',
  }));

  const savedPlayers = followPlayers.map((name) => ({ name, slug: null }));
  const watchlist = followPlayers.length
    ? [{ label: 'Your Followed Players', count: followPlayers.length }]
    : [{ label: '2027 WR Board', href: '/vault/recruiting?tab=targets-2027' }];

  const threads = communityStore
    .loadThreads()
    .filter((t) => !t.deleted && !t.locked)
    .sort((a, b) => (b.replyCount || 0) - (a.replyCount || 0))
    .slice(0, 4)
    .map((t) => ({
      id: t.id,
      title: t.title,
      href: `/vault/community?thread=${encodeURIComponent(t.id)}`,
    }));

  return {
    alerts,
    savedPlayers,
    watchlist,
    favoriteThreads: threads,
    updatedAt: nowIso(),
  };
}

function mountVaultDashboardRoutes(app) {
  app.get('/api/live/ticker', (req, res) => {
    try {
      const payload = cached('ticker', buildTickerPayload);
      return res.status(200).json(payload);
    } catch (err) {
      return res.status(200).json({
        ok: true,
        items: [],
        storyline: 'GatorVault Insider — your GameDay command center.',
        hotToday: [],
        updatedAt: nowIso(),
        error: err.message,
      });
    }
  });

  app.get('/api/content/latest', (req, res) => {
    try {
      const payload = cached('content', () => buildContentLatestPayload());
      return res.status(200).json(payload);
    } catch (err) {
      return res.status(200).json({
        ok: true,
        articles: [],
        podcasts: [],
        filmRoom: [],
        community: [],
        updatedAt: nowIso(),
        error: err.message,
      });
    }
  });

  app.get('/api/user/personalized', (req, res) => {
    try {
      res.set('Cache-Control', 'no-store, must-revalidate');
      const payload = buildPersonalizedHints(req);
      return res.status(200).json({ ok: true, ...payload });
    } catch (err) {
      return res.status(200).json({
        ok: true,
        alerts: [],
        savedPlayers: [],
        watchlist: [],
        favoriteThreads: [],
        updatedAt: nowIso(),
        error: err.message,
      });
    }
  });
}

function buildTickerPayload() {
  const items = buildTickerItems();
  return {
    ok: true,
    items,
    storyline: buildStoryline(items),
    hotToday: buildHotCarousel(items),
    updatedAt: nowIso(),
  };
}

function buildContentLatestPayload() {
  return { ok: true, ...buildLatestContent() };
}

module.exports = {
  mountVaultDashboardRoutes,
  buildTickerPayload,
  buildContentLatestPayload,
};
