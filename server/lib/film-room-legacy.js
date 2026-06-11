/**
 * Film Room — legacy verified video catalog (GNFP, Film Guy Network, UF pressers).
 * Merged alongside Knowledge Engine lessons in film-room-feed.js.
 */
const fs = require('fs');
const path = require('path');

const CACHE_PATH = path.join(__dirname, '..', 'data', 'film-room', 'cache.json');
const MANUAL_PATH = path.join(__dirname, '..', 'data', 'film-room', 'manual.json');

const LEGACY_CATEGORIES = {
  GNFP: 'GNFP Film Review',
  FILM_GUY: 'Film Guy Network',
  PRESS: 'UF Press Conferences'
};

const PRESS_CONFERENCE_LIMIT = 5;

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

function loadLegacyVideoCatalog() {
  const cache = readJson(CACHE_PATH, { auto: {} });
  const manual = readJson(MANUAL_PATH, { items: [] });
  const items = [];

  (cache.auto?.gnfp || []).forEach((row) => {
    items.push(legacyItemToCatalog(row, LEGACY_CATEGORIES.GNFP));
  });

  (manual.items || []).forEach((row) => {
    const src = String(row.source || row.title || '');
    if (/film guy/i.test(src)) {
      items.push(legacyItemToCatalog(row, LEGACY_CATEGORIES.FILM_GUY));
    }
  });

  const pressers = (cache.auto?.pressers || [])
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
  loadLegacyVideoCatalog
};
