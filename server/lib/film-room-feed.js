/**
 * Film Room catalog — verified Knowledge Engine lessons only.
 * No external videos, press conferences, or third-party embeds.
 */
const engine = require('./film-room-knowledge-engine');
const store = require('./film-room-knowledge-store');

const FILM_ROOM_CATEGORIES = [
  'Scheme Library',
  'Concept Breakdown',
  'Recruiting Fit',
  'Opponent Prep',
  'Position Traits'
];

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
  const items = lessons.map(lessonToCatalogItem).sort(
    (a, b) => new Date(b.publishedAt) - new Date(a.publishedAt)
  );

  const byCategory = {};
  FILM_ROOM_CATEGORIES.forEach((cat) => {
    byCategory[cat] = items.filter((i) => i.category === cat).length;
  });

  return {
    ok: true,
    mode: 'knowledge_engine',
    items,
    categories: FILM_ROOM_CATEGORIES,
    byCategory,
    counts: {
      total: items.length,
      validated: items.length,
      skipped: store.listLessons().length - items.length
    },
    updatedAt: store.loadKnowledge().manifest.updatedAt,
    policy: {
      translatorOnly: true,
      noExternalVideo: true,
      skipOnMissingData: true,
      minSourceConfidence: 80,
      noCharlesAsSource: true,
      noAiInventedKnowledge: true
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
  FILM_ROOM_CATEGORIES
};
