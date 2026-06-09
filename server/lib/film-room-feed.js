/**
 * Film Room catalog — two auto-updating YouTube sources + manual-only entries.
 * Auto: GNFP 2026 Buster Faulkner film reviews · UF @gatorsfb press conferences (latest 5)
 * Manual: spring game highlights / Film Guy Network (admin-curated, never auto-pruned)
 */
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const { parseRssItems } = require('./rss-parse');

const DATA_DIR = path.join(__dirname, '..', 'data', 'film-room');
const MANUAL_PATH = path.join(DATA_DIR, 'manual.json');
const CACHE_PATH = path.join(DATA_DIR, 'cache.json');

const GNFP_CHANNEL_ID = process.env.GNFP_YOUTUBE_CHANNEL_ID || 'UC4uzOAHPLPqEnNpNmDUP1VA';
const UF_FB_CHANNEL_ID = process.env.UF_FB_YOUTUBE_CHANNEL_ID || 'UCq0YlZqYQZqYQZqYQZqYQZQ'; // fallback overwritten on sync

const GNFP_TITLE_RE =
  /2026.*(buster faulkner|faulkner offense|film review|gnfp film)/i;
const PRESSER_TITLE_RE =
  /press conference|media availability|head coach jon sumrall|jon sumrall speaks/i;

/** Canonical Film Room hub categories */
const FILM_ROOM_CATEGORIES = [
  'Film Breakdown',
  'Film Guy Network',
  'GNFP Film Review',
  'Press Conferences',
  'Highlights'
];

function normalizeCategory(raw, source) {
  const c = String(raw || '').trim();
  if (FILM_ROOM_CATEGORIES.includes(c)) return c;
  if (/gnfp/i.test(c) || source === 'GNFP') return 'GNFP Film Review';
  if (/film guy/i.test(c) || /film guy/i.test(source || '')) return 'Film Guy Network';
  if (/press/i.test(c)) return 'Press Conferences';
  if (/highlight|spring game/i.test(c)) return 'Highlights';
  if (/breakdown|film review|film study/i.test(c)) return 'Film Breakdown';
  return 'Film Breakdown';
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function slugify(title) {
  return String(title || 'clip')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64);
}

function youtubeThumb(videoId) {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

function parseYoutubeVideoId(url) {
  const s = String(url || '');
  const m =
    s.match(/[?&]v=([^&]+)/) ||
    s.match(/youtu\.be\/([^?&]+)/) ||
    s.match(/\/embed\/([^?&]+)/);
  return m ? m[1] : null;
}

async function fetchYoutubeRss(channelId) {
  const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
  const res = await fetch(url, { timeout: 25000 });
  if (!res.ok) throw new Error(`YouTube RSS HTTP ${res.status} for ${channelId}`);
  const xml = await res.text();
  return parseRssItems(xml, 30);
}

function rowToClip(row, opts) {
  const videoId = parseYoutubeVideoId(row.link) || row.id;
  if (!videoId) return null;
  return {
    id: `yt_${videoId}`,
    slug: slugify(row.title) || `yt-${videoId}`,
    title: row.title,
    dek: row.summary || '',
    gameLine: opts.gameLine || '',
    season: '2026',
    category: normalizeCategory(opts.category, opts.source),
    duration: 'YouTube',
    thumbUrl: youtubeThumb(videoId),
    videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
    youtubeId: videoId,
    embedUrl: `https://www.youtube.com/embed/${videoId}`,
    source: opts.source,
    autoUpdate: !!opts.autoUpdate,
    mediaReady: true,
    featured: !!opts.featured,
    publishedAt: row.publishedAt || new Date().toISOString()
  };
}

async function syncGnfpReviews() {
  const rows = await fetchYoutubeRss(GNFP_CHANNEL_ID);
  return rows
    .filter((r) => GNFP_TITLE_RE.test(r.title || '') || GNFP_TITLE_RE.test(r.summary || ''))
    .map((r) =>
      rowToClip(r, {
        category: 'GNFP Film Review',
        gameLine: '2026 · Buster Faulkner Offense',
        source: 'GNFP',
        autoUpdate: true
      })
    )
    .filter(Boolean);
}

async function syncUfPressers() {
  let channelId = process.env.UF_FB_YOUTUBE_CHANNEL_ID;
  if (!channelId) {
    const cache = readJson(CACHE_PATH, {});
    channelId = cache.ufFbChannelId;
  }
  if (!channelId) {
    channelId = await resolveGatorsFbChannelId();
  }
  const rows = await fetchYoutubeRss(channelId);
  return rows
    .filter((r) => PRESSER_TITLE_RE.test(r.title || ''))
    .slice(0, 5)
    .map((r) =>
      rowToClip(r, {
        category: 'Press Conferences',
        gameLine: 'Florida Gators Football',
        source: 'Florida Gators YouTube',
        autoUpdate: true
      })
    )
    .filter(Boolean);
}

async function resolveGatorsFbChannelId() {
  try {
    const res = await fetch('https://www.youtube.com/@gatorsfb', { timeout: 20000 });
    const html = await res.text();
    const m = html.match(/"channelId":"(UC[^"]+)"/) || html.match(/"externalId":"(UC[^"]+)"/);
    if (m) {
      const cache = readJson(CACHE_PATH, {});
      cache.ufFbChannelId = m[1];
      cache.resolvedAt = new Date().toISOString();
      writeJson(CACHE_PATH, cache);
      return m[1];
    }
  } catch (e) {
    console.warn('[film-room] Could not resolve @gatorsfb channel id:', e.message);
  }
  return 'UCq0YlZqYQZqYQZqYQZqYQZQ';
}

function normalizeManualClip(item) {
  const videoId = item.youtubeId || parseYoutubeVideoId(item.videoUrl);
  const clip = {
    ...item,
    autoUpdate: false,
    mediaReady: true,
    source: item.source || 'Manual',
    slug: item.slug || slugify(item.title),
    category: normalizeCategory(item.category, item.source)
  };
  if (videoId) {
    clip.youtubeId = videoId;
    clip.videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    clip.embedUrl = `https://www.youtube.com/embed/${videoId}`;
    if (!clip.thumbUrl || !String(clip.thumbUrl).startsWith('http')) {
      clip.thumbUrl = youtubeThumb(videoId);
    }
    clip.mediaReady = true;
  }
  return clip;
}

function loadManualClips() {
  const doc = readJson(MANUAL_PATH, { items: [] });
  return (doc.items || []).map(normalizeManualClip);
}

async function buildFilmRoomCatalog({ force = false } = {}) {
  const cache = readJson(CACHE_PATH, { auto: {}, updatedAt: null });
  const stale =
    !cache.updatedAt || Date.now() - new Date(cache.updatedAt).getTime() > 6 * 3600000;

  if (force || stale) {
    try {
      const [gnfp, pressers] = await Promise.all([
        syncGnfpReviews().catch((e) => {
          console.warn('[film-room] GNFP sync failed:', e.message);
          return cache.auto?.gnfp || [];
        }),
        syncUfPressers().catch((e) => {
          console.warn('[film-room] UF presser sync failed:', e.message);
          return cache.auto?.pressers || [];
        })
      ]);
      cache.auto = { gnfp, pressers };
      cache.updatedAt = new Date().toISOString();
      writeJson(CACHE_PATH, cache);
    } catch (e) {
      console.warn('[film-room] sync error:', e.message);
    }
  }

  const manual = loadManualClips();
  const auto = [...(cache.auto?.gnfp || []), ...(cache.auto?.pressers || [])];
  const byId = new Map();
  manual.forEach((c) => byId.set(c.id || c.slug, c));
  auto.forEach((c) => byId.set(c.id || c.slug, c));

  const items = [...byId.values()].sort(
    (a, b) => new Date(b.publishedAt) - new Date(a.publishedAt)
  );

  const byCategory = {};
  FILM_ROOM_CATEGORIES.forEach((cat) => {
    byCategory[cat] = items.filter((i) => i.category === cat).length;
  });

  return {
    ok: true,
    items,
    categories: FILM_ROOM_CATEGORIES,
    byCategory,
    counts: {
      total: items.length,
      manual: manual.length,
      gnfp: (cache.auto?.gnfp || []).length,
      pressers: (cache.auto?.pressers || []).length
    },
    updatedAt: cache.updatedAt
  };
}

module.exports = {
  buildFilmRoomCatalog,
  loadManualClips,
  syncGnfpReviews,
  syncUfPressers,
  FILM_ROOM_CATEGORIES,
  normalizeCategory,
  DATA_DIR,
  MANUAL_PATH
};
