/**
 * Film Room catalog — Knowledge Engine lessons + verified legacy video sources.
 */
const engine = require('./film-room-knowledge-engine');
const store = require('./film-room-knowledge-store');
const legacy = require('./film-room-legacy');
const cacheStore = require('./film-room-cache-store');

const KNOWLEDGE_CATEGORIES = [
  'Scheme Library',
  'Concept Breakdown',
  'Recruiting Fit',
  'Opponent Prep',
  'Position Traits'
];

const FILM_HUBS = [
  'Film Breakdown',
  'Scheme School',
  'UF Press Conferences',
  'Highlights'
];

const LEGACY_VIDEO_CATEGORIES = [
  legacy.LEGACY_CATEGORIES.GNFP,
  legacy.LEGACY_CATEGORIES.FILM_GUY,
  legacy.LEGACY_CATEGORIES.PRESS,
  legacy.LEGACY_CATEGORIES.HIGHLIGHTS
];

const FILM_ROOM_CATEGORIES = [...FILM_HUBS];

/** Hosted on Netlify — Capacitor WebViews need HTTPS origin + Referer for YouTube embeds (Error 153). */
const YOUTUBE_EMBED_SITE = String(process.env.PUBLIC_SITE_URL || 'https://gatorvaultinsider.com').replace(
  /\/$/,
  ''
);

function extractYoutubeId(item) {
  const direct = String(item?.youtubeId || '').trim();
  if (/^[\w-]{11}$/.test(direct)) return direct;
  const urls = [item?.embedUrl, item?.videoUrl, item?.sourceUrl].filter(Boolean);
  for (const u of urls) {
    const m = String(u).match(
      /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:embed\/|shorts\/|watch\?.*?v=)|[?&]v=)([\w-]{11})/
    );
    if (m) return m[1];
  }
  return null;
}

function youtubeRelayEmbedUrl(videoId) {
  return `${YOUTUBE_EMBED_SITE}/youtube-embed.html?v=${encodeURIComponent(videoId)}`;
}

/** Prefer site-hosted relay so iOS Capacitor iframes get a valid Referer (fixes Error 153). */
function withYoutubeEmbedRelay(item) {
  if (!item || item.noVideo) return item;
  const id = extractYoutubeId(item);
  if (!id) return item;
  const relay = youtubeRelayEmbedUrl(id);
  if (item.embedUrl === relay && item.youtubeId === id) return item;
  return { ...item, youtubeId: id, embedUrl: relay };
}

function inferSchemeSide(lesson, conceptCategory) {
  const cat = String(conceptCategory || '').toLowerCase();
  if (cat === 'offense' || cat === 'defense') return cat;
  const text = `${lesson?.title || ''} ${lesson?.summary || ''} ${lesson?.category || ''}`.toLowerCase();
  if (/defense|3-3-5|jack|star|linebacker|coverage|blitz|defensive|opponent prep/.test(text)) return 'defense';
  return 'offense';
}

function inferFilmHub(item) {
  const cat = item.category || '';
  const lessonType = String(item.lessonType || '').toLowerCase();
  if (lessonType === 'opponent_prep' || cat === 'Opponent Prep') return 'Film Breakdown';
  if (cat === legacy.LEGACY_CATEGORIES.GNFP || cat === legacy.LEGACY_CATEGORIES.FILM_GUY) return 'Film Breakdown';
  if (cat === legacy.LEGACY_CATEGORIES.PRESS) return 'UF Press Conferences';
  if (cat === legacy.LEGACY_CATEGORIES.HIGHLIGHTS) return 'Highlights';
  if (item.schemeSide === 'defense' || item.schemeSide === 'offense') return 'Scheme School';
  return 'Scheme School';
}

function lessonToCatalogItem(lesson, conceptCategory) {
  const primarySource = lesson.sources?.[0];
  const schemeSide = inferSchemeSide(lesson, conceptCategory);
  const base = {
    id: lesson.id,
    slug: lesson.id,
    title: lesson.title,
    dek: lesson.summary,
    gameLine: lesson.category || null,
    category: lesson.category,
    lessonType: lesson.lessonType,
    season: '2026',
    duration: 'Analysis',
    source: primarySource?.source_name || 'Verified coaching source',
    sourceType: primarySource?.source_type || null,
    sourceUrl: primarySource?.source_url || null,
    sourceConfidence: primarySource?.source_confidence || null,
    sources: lesson.sources || [],
    verified: true,
    mediaReady: true,
    noVideo: true,
    knowledgeEngine: true,
    translatorOnly: true,
    body: lesson.body,
    diagram: lesson.diagram,
    lastVerified: lesson.lastVerified,
    publishedAt: lesson.lastVerified || new Date().toISOString(),
    thumbUrl: null,
    videoUrl: null,
    embedUrl: null,
    youtubeId: null,
    schemeSide: schemeSide
  };
  base.filmHub = inferFilmHub(base);
  return base;
}

function buildFilmRoomCatalog() {
  let lessonItems = [];
  let legacyItems = [];
  let knowledgeError = null;

  try {
    const lessons = engine.listValidatedLessons();
    lessonItems = lessons.map((lesson) => {
      let conceptCategory = null;
      try {
        const ref = lesson.references?.conceptId;
        if (ref) {
          const concept = store.getConcept(ref);
          conceptCategory = concept?.category || null;
        }
      } catch (e) {
        conceptCategory = null;
      }
      return lessonToCatalogItem(lesson, conceptCategory);
    });
  } catch (err) {
    knowledgeError = err.message || String(err);
  }

  try {
    legacyItems = legacy.loadLegacyVideoCatalog().map((item) => {
      item.schemeSide = item.category === legacy.LEGACY_CATEGORIES.PRESS ? null : item.schemeSide;
      item.filmHub = inferFilmHub(item);
      return item;
    });
  } catch (err) {
    if (!knowledgeError) knowledgeError = err.message || String(err);
    legacyItems = [];
  }

  const items = [...lessonItems, ...legacyItems]
    .map(withYoutubeEmbedRelay)
    .sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));

  const byCategory = {};
  FILM_HUBS.forEach((hub) => {
    byCategory[hub] = items.filter((i) => i.filmHub === hub).length;
  });

  let manifestUpdatedAt = null;
  try {
    manifestUpdatedAt = store.loadKnowledge().manifest.updatedAt;
  } catch {
    manifestUpdatedAt = new Date().toISOString();
  }

  // Prefer last rebuild stamp so ops freshness survives Render sleep
  // (knowledge manifest.updatedAt can sit for months without content edits).
  let stampUpdatedAt = null;
  try {
    stampUpdatedAt = cacheStore.loadCatalogStamp()?.updatedAt || null;
  } catch {
    stampUpdatedAt = null;
  }
  const stampMs = stampUpdatedAt ? new Date(stampUpdatedAt).getTime() : NaN;
  const manifestMs = manifestUpdatedAt ? new Date(manifestUpdatedAt).getTime() : NaN;
  const updatedAt =
    Number.isFinite(stampMs) && (!Number.isFinite(manifestMs) || stampMs >= manifestMs)
      ? stampUpdatedAt
      : manifestUpdatedAt;

  let totalLessons = 0;
  let skippedLessons = 0;
  try {
    totalLessons = store.listLessons().length;
    skippedLessons = totalLessons - lessonItems.length;
  } catch {
    skippedLessons = 0;
  }

  return {
    ok: true,
    mode: 'merged',
    items,
    categories: FILM_ROOM_CATEGORIES,
    hubs: FILM_HUBS,
    byCategory,
    counts: {
      total: items.length,
      knowledgeLessons: lessonItems.length,
      legacyVideos: legacyItems.length,
      validated: lessonItems.length,
      skipped: skippedLessons
    },
    updatedAt,
    knowledgeUpdatedAt: manifestUpdatedAt,
    rebuiltAt: stampUpdatedAt,
    degraded: !!knowledgeError,
    warning: knowledgeError,
    policy: {
      translatorOnly: true,
      mergedLegacyVideo: true,
      legacyPressConferenceLimit: legacy.PRESS_CONFERENCE_LIMIT,
      skipOnMissingData: true,
      minSourceConfidence: 80,
      noCharlesAsSource: true,
      noAiInventedKnowledge: true,
      verifiedCoachIdentity: true
    }
  };
}

function rebuildFilmRoomCatalog() {
  store.reloadKnowledge();
  const catalog = buildFilmRoomCatalog();
  const now = new Date().toISOString();
  const stamped = {
    ...catalog,
    updatedAt: now,
    rebuiltAt: now,
  };
  try {
    cacheStore.saveCatalogStamp({
      updatedAt: now,
      rebuiltAt: now,
      counts: stamped.counts,
      mode: stamped.mode,
    });
  } catch (err) {
    stamped.warning = stamped.warning || (err && err.message) || 'catalog stamp save failed';
  }
  return stamped;
}

function getLessonDetail(lessonId) {
  return engine.renderLesson(lessonId);
}

module.exports = {
  buildFilmRoomCatalog,
  rebuildFilmRoomCatalog,
  getLessonDetail,
  FILM_ROOM_CATEGORIES,
  FILM_HUBS,
  KNOWLEDGE_CATEGORIES,
  LEGACY_VIDEO_CATEGORIES,
  inferFilmHub,
  extractYoutubeId,
  withYoutubeEmbedRelay,
  youtubeRelayEmbedUrl,
};
