/**
 * Film Room — legacy verified video catalog (GNFP, Film Guy, Tengwall, UF pressers).
 * Merged alongside Knowledge Engine lessons in film-room-feed.js.
 */
const fs = require('fs');
const path = require('path');
const { loadFilmRoomCache, resolveCachePath } = require('./film-room-cache-store');
const {
  isCurrentStaffGnfpReview,
  isFilmGuyFloridaBreakdownTitle,
  isTengwallUfFilmReview,
  isCondensedGameTitle,
  dedupePressersByEvent,
} = require('./film-room-youtube-ingest');

const MANUAL_PATH = path.join(__dirname, '..', 'data', 'film-room', 'manual.json');

const LEGACY_CATEGORIES = {
  GNFP: 'GNFP Film Review',
  FILM_GUY: 'Film Guy Network',
  TENGWALL: 'Landon Tengwall',
  PRESS: 'UF Press Conferences',
  HIGHLIGHTS: 'Highlights',
  BREAKDOWN: 'Film Breakdown'
};

/** Keep SEC Media Days set + recent spring pressers visible. */
const PRESS_CONFERENCE_LIMIT = 8;

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return fallback;
  }
}

function legacyItemToCatalog(raw, category) {
  return {
    id: raw.id,
    slug: raw.slug || raw.id,
    title: raw.title,
    dek: raw.dek || raw.gameLine || '',
    category,
    lessonType: 'legacy_video',
    season: raw.season || '2026',
    duration: raw.duration || 'YouTube',
    source: raw.source || category,
    sourceType: 'film_study',
    sourceUrl: raw.videoUrl || null,
    sourceConfidence: 95,
    sources: raw.source
      ? [{ source_name: raw.source, source_type: 'film_study', source_url: raw.videoUrl || '', source_confidence: 95 }]
      : [],
    verified: true,
    mediaReady: raw.mediaReady !== false,
    noVideo: false,
    knowledgeEngine: false,
    translatorOnly: false,
    body: raw.dek || raw.gameLine || '',
    diagram: null,
    lastVerified: raw.publishedAt || null,
    publishedAt: raw.publishedAt || null,
    thumbUrl: raw.thumbUrl || null,
    videoUrl: raw.videoUrl || null,
    embedUrl: raw.embedUrl || null,
    youtubeId: raw.youtubeId || null,
    featured: !!raw.featured
  };
}

function youtubeKey(row) {
  return String(row?.youtubeId || '').trim() || String(row?.id || '').trim();
}

function loadLegacyVideoCatalog() {
  const cache = loadFilmRoomCache();
  const manual = readJson(MANUAL_PATH, { items: [] });
  const items = [];
  const seenYoutube = new Set();

  function pushUnique(row, category) {
    const key = youtubeKey(row);
    if (key && seenYoutube.has(key)) return;
    if (key) seenYoutube.add(key);
    items.push(legacyItemToCatalog(row, category));
  }

  (cache.auto?.gnfp || []).forEach((row) => {
    // Drop coach podcast / Talking Ball sit-downs — Film Breakdown is tape only.
    // Current staff only — Napier-era 2025 GNFP reviews stay off the hub.
    if (!isCurrentStaffGnfpReview(row)) return;
    pushUnique(row, LEGACY_CATEGORIES.GNFP);
  });

  (manual.items || []).forEach((row) => {
    const cat = String(row.category || '').trim();
    const src = String(row.source || row.title || '');
    if (cat === 'Highlights' || /highlights/i.test(row.title || '')) {
      if (isCondensedGameTitle(row.title)) return;
      pushUnique(row, LEGACY_CATEGORIES.HIGHLIGHTS);
    } else if (/gnfp/i.test(src) || cat === 'GNFP Film Review') {
      if (!isCurrentStaffGnfpReview(row)) return;
      pushUnique(row, LEGACY_CATEGORIES.GNFP);
    } else if (/tengwall/i.test(src) || cat === 'Landon Tengwall') {
      if (!isTengwallUfFilmReview(row)) return;
      pushUnique(row, LEGACY_CATEGORIES.TENGWALL);
    } else if (cat === 'Film Breakdown' || /film guy/i.test(src)) {
      pushUnique(row, LEGACY_CATEGORIES.FILM_GUY);
    } else if (/gators online/i.test(src) && /spring game/i.test(row.title || '')) {
      pushUnique(row, LEGACY_CATEGORIES.HIGHLIGHTS);
    }
  });

  (cache.auto?.filmGuy || []).forEach((row) => {
    if (!isFilmGuyFloridaBreakdownTitle(row?.title)) return;
    pushUnique(row, LEGACY_CATEGORIES.FILM_GUY);
  });

  (cache.auto?.tengwall || []).forEach((row) => {
    if (!isTengwallUfFilmReview(row)) return;
    pushUnique(row, LEGACY_CATEGORIES.TENGWALL);
  });

  (cache.auto?.highlights || []).forEach((row) => {
    if (isCondensedGameTitle(row?.title)) return;
    pushUnique(row, LEGACY_CATEGORIES.HIGHLIGHTS);
  });

  const pressers = dedupePressersByEvent(cache.auto?.pressers || [])
    .slice()
    .sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0))
    .slice(0, PRESS_CONFERENCE_LIMIT);

  pressers.forEach((row) => {
    items.push(legacyItemToCatalog(row, LEGACY_CATEGORIES.PRESS));
  });

  return items;
}

module.exports = {
  LEGACY_CATEGORIES,
  PRESS_CONFERENCE_LIMIT,
  loadLegacyVideoCatalog,
  resolveCachePath,
};
