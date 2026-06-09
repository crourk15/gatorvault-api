/**
 * Film Room catalog — three sections: Film Breakdown · Press Conferences · Highlights
 * Auto: GNFP film reviews · Film Guy Network (manual) · UF @gatorsfb press conferences
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

/** Must match real pressers — coach names alone are NOT enough (excludes Mic'd Up, etc.) */
const PRESSER_TITLE_RE =
  /press conference|media availability|postgame press|post-game press|speaks to the media|speaks with the media|player press conference|coaches press|head coach press|weekly press|pre-game press|pregame press|spring game press|media day/i;

const PRESSER_EXCLUDE_RE =
  /mic[\u2018\u2019'']?\s*d\s*up|mic\s+up|all[\s-]?access|behind[\s-]?the[\s-]?scenes|player of the week|lift session|workout recap|film study|breakdown|scheme|gnfp|film guy|cut-up|cut up|podcast|interview series|defensive coordinator.*mic|coordinator mic/i;

/** Known non-presser YouTube IDs — Mic'd Up, features, etc. */
const PRESSER_BLOCKLIST_IDS = new Set(['wTnL6sOpEGI']);

function isBlockedPresserClip(clip) {
  const id = String(clip?.youtubeId || clip?.id || '').replace(/^yt_/, '');
  if (id && PRESSER_BLOCKLIST_IDS.has(id)) return true;
  return !isTruePressConference(clip?.title, clip?.dek || clip?.summary);
}

function isTruePressConference(title, summary) {
  const text = `${title || ''} ${summary || ''}`;
  if (PRESSER_EXCLUDE_RE.test(text)) return false;
  return PRESSER_TITLE_RE.test(text);
}

function sanitizePresserClips(clips) {
  return (clips || []).filter((c) => !isBlockedPresserClip(c));
}

function classifyFilmRoomItem(c) {
  let category = normalizeCategory(c.category, c.source);
  if (category === 'Press Conferences' && isBlockedPresserClip(c)) {
    category = fallbackCategoryForNonPresser(c.title, c.source);
  }
  return { ...c, category };
}

function purgePressConferenceCache(cache) {
  const next = { ...cache, auto: { ...(cache.auto || {}) } };
  next.auto.pressers = sanitizePresserClips(next.auto.pressers);
  next.auto.gnfp = next.auto.gnfp || [];
  return next;
}

function fallbackCategoryForNonPresser(title, source) {
  const text = `${title || ''} ${source || ''}`.toLowerCase();
  if (/highlight|mic[\u2018\u2019'']?\s*d\s*up|cut-up|cut up|best plays|spring game/i.test(text)) return 'Highlights';
  if (/gnfp|film guy|breakdown|film study|scheme/i.test(text)) return 'Film Breakdown';
  return 'Highlights';
}

/** Canonical Film Room hub categories (3 sections only) */
const FILM_ROOM_CATEGORIES = ['Film Breakdown', 'Press Conferences', 'Highlights'];

const LEGACY_CATEGORY_MAP = {
  'Film Guy Network': 'Film Breakdown',
  'GNFP Film Review': 'Film Breakdown',
  'GNFP': 'Film Breakdown',
  'Press Conference': 'Press Conferences',
  'Interview': 'Press Conferences',
  'Spring Game Film Study': 'Film Breakdown'
};

function normalizeCategory(raw, source) {
  const c = String(raw || '').trim();
  if (FILM_ROOM_CATEGORIES.includes(c)) return c;
  if (LEGACY_CATEGORY_MAP[c]) return LEGACY_CATEGORY_MAP[c];

  const lower = c.toLowerCase();
  const src = String(source || '').toLowerCase();

  if (/gnfp|film guy/i.test(c) || /gnfp|film guy/i.test(src)) return 'Film Breakdown';
  if (/press conference|media availability|postgame press|post-game press/i.test(c)) return 'Press Conferences';
  if (/highlight|spring game|practice|cut-up|cut up|best plays|mic['']?d up/i.test(c)) return 'Highlights';
  if (/breakdown|film review|film study|scheme|formation/i.test(c)) return 'Film Breakdown';

  if (/gnfp/i.test(src)) return 'Film Breakdown';
  if (/film guy/i.test(src)) return 'Film Breakdown';
  if (/gators online|highlight|spring/i.test(src) && /highlight|spring|cut/i.test(lower)) {
    return 'Highlights';
  }
  if (/florida gators youtube|@gatorsfb/i.test(src)) {
    return isTruePressConference(c, '') ? 'Press Conferences' : 'Highlights';
  }

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
        category: 'Film Breakdown',
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
    .filter((r) => isTruePressConference(r.title, r.summary))
    .slice(0, 8)
    .map((r) =>
      rowToClip(r, {
        category: 'Press Conferences',
        gameLine: 'Florida Gators Football',
        source: 'Florida Gators YouTube',
        autoUpdate: true
      })
    )
    .filter(Boolean)
    .filter((c) => !isBlockedPresserClip(c));
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
  let cache = readJson(CACHE_PATH, { auto: {}, updatedAt: null });
  cache = purgePressConferenceCache(cache);

  const stale =
    !cache.updatedAt || Date.now() - new Date(cache.updatedAt).getTime() > 6 * 3600000;

  if (force || stale) {
    try {
      const [gnfp, pressers] = await Promise.all([
        syncGnfpReviews().catch((e) => {
          console.warn('[film-room] GNFP sync failed:', e.message);
          return sanitizePresserClips(cache.auto?.gnfp || []);
        }),
        syncUfPressers().catch((e) => {
          console.warn('[film-room] UF presser sync failed:', e.message);
          return sanitizePresserClips(cache.auto?.pressers || []);
        })
      ]);
      cache.auto = { gnfp, pressers: sanitizePresserClips(pressers) };
      cache.updatedAt = new Date().toISOString();
      cache.purgedAt = cache.updatedAt;
      writeJson(CACHE_PATH, cache);
    } catch (e) {
      console.warn('[film-room] sync error:', e.message);
    }
  } else {
    writeJson(CACHE_PATH, cache);
  }

  const manual = loadManualClips();
  const auto = [...(cache.auto?.gnfp || []), ...(cache.auto?.pressers || [])];
  const byId = new Map();
  manual.forEach((c) => byId.set(c.id || c.slug, c));
  auto.forEach((c) => byId.set(c.id || c.slug, c));

  const items = [...byId.values()].map(classifyFilmRoomItem).sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

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

/** Admin rebuild scopes: all (full sync), pressers (UF YouTube only), catalog (purge + reclassify cache). */
async function rebuildFilmRoomCatalog({ scope = 'all' } = {}) {
  const mode = String(scope || 'all').toLowerCase();
  if (mode === 'catalog') {
    return buildFilmRoomCatalog({ force: false });
  }
  if (mode === 'pressers') {
    let cache = readJson(CACHE_PATH, { auto: {}, updatedAt: null });
    cache = purgePressConferenceCache(cache);
    try {
      const pressers = await syncUfPressers().catch((e) => {
        console.warn('[film-room] UF presser sync failed:', e.message);
        return sanitizePresserClips(cache.auto?.pressers || []);
      });
      cache.auto = {
        gnfp: cache.auto?.gnfp || [],
        pressers: sanitizePresserClips(pressers)
      };
      cache.updatedAt = new Date().toISOString();
      cache.purgedAt = cache.updatedAt;
      writeJson(CACHE_PATH, cache);
    } catch (e) {
      console.warn('[film-room] presser rebuild error:', e.message);
    }
    return buildFilmRoomCatalog({ force: false });
  }
  return buildFilmRoomCatalog({ force: true });
}

module.exports = {
  buildFilmRoomCatalog,
  rebuildFilmRoomCatalog,
  loadManualClips,
  syncGnfpReviews,
  syncUfPressers,
  isTruePressConference,
  isBlockedPresserClip,
  sanitizePresserClips,
  purgePressConferenceCache,
  classifyFilmRoomItem,
  FILM_ROOM_CATEGORIES,
  normalizeCategory,
  DATA_DIR,
  MANUAL_PATH,
  CACHE_PATH
};
