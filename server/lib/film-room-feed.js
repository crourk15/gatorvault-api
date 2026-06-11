/**
 * Film Room catalog — Knowledge Engine lessons + verified legacy video sources.
 */
const engine = require('./film-room-knowledge-engine');
const store = require('./film-room-knowledge-store');
const legacy = require('./film-room-legacy');

const KNOWLEDGE_CATEGORIES = [
  'Scheme Library',
  'Concept Breakdown',
  'Recruiting Fit',
  'Opponent Prep',
  'Position Traits'
];

const LEGACY_VIDEO_CATEGORIES = [
  legacy.LEGACY_CATEGORIES.GNFP,
  legacy.LEGACY_CATEGORIES.FILM_GUY,
  legacy.LEGACY_CATEGORIES.PRESS
];

const FILM_ROOM_CATEGORIES = [...KNOWLEDGE_CATEGORIES, ...LEGACY_VIDEO_CATEGORIES];

function lessonToCatalogItem(lesson) {
  const primarySource = lesson.sources?.[0];
  return {
    id: lesson.id,
    slug: lesson.id,
    title: lesson.title,
    dek: lesson.summary,
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
    youtubeId: null
  };
}

function buildFilmRoomCatalog() {
  const lessons = engine.listValidatedLessons();
  const lessonItems = lessons.map(lessonToCatalogItem);
  const legacyItems = legacy.loadLegacyVideoCatalog();
  const items = [...lessonItems, ...legacyItems].sort(
    (a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0)
  );

  const byCategory = {};
  FILM_ROOM_CATEGORIES.forEach((cat) => {
    byCategory[cat] = items.filter((i) => i.category === cat).length;
  });

  return {
    ok: true,
    mode: 'merged',
    items,
    categories: FILM_ROOM_CATEGORIES,
    byCategory,
    counts: {
      total: items.length,
      knowledgeLessons: lessonItems.length,
      legacyVideos: legacyItems.length,
      validated: lessonItems.length,
      skipped: store.listLessons().length - lessonItems.length
    },
    updatedAt: store.loadKnowledge().manifest.updatedAt,
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
  return buildFilmRoomCatalog();
}

function getLessonDetail(lessonId) {
  return engine.renderLesson(lessonId);
}

module.exports = {
  buildFilmRoomCatalog,
  rebuildFilmRoomCatalog,
  getLessonDetail,
  FILM_ROOM_CATEGORIES,
  KNOWLEDGE_CATEGORIES,
  LEGACY_VIDEO_CATEGORIES
};
