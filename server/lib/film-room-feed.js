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

const FILM_HUBS = [
  'Offensive Scheme',
  'Defensive Scheme',
  'Film Breakdown',
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

function inferSchemeSide(lesson, conceptCategory) {
  const cat = String(conceptCategory || '').toLowerCase();
  if (cat === 'offense' || cat === 'defense') return cat;
  const text = `${lesson?.title || ''} ${lesson?.summary || ''} ${lesson?.category || ''}`.toLowerCase();
  if (/defense|3-3-5|jack|star|linebacker|coverage|blitz|defensive|opponent prep/.test(text)) return 'defense';
  return 'offense';
}

function inferFilmHub(item) {
  const cat = item.category || '';
  if (cat === legacy.LEGACY_CATEGORIES.GNFP || cat === legacy.LEGACY_CATEGORIES.FILM_GUY) return 'Film Breakdown';
  if (cat === legacy.LEGACY_CATEGORIES.PRESS) return 'UF Press Conferences';
  if (cat === legacy.LEGACY_CATEGORIES.HIGHLIGHTS) return 'Highlights';
  if (item.schemeSide === 'defense') return 'Defensive Scheme';
  if (item.schemeSide === 'offense') return 'Offensive Scheme';
  return 'Offensive Scheme';
}

function lessonToCatalogItem(lesson, conceptCategory) {
  const primarySource = lesson.sources?.[0];
  const schemeSide = inferSchemeSide(lesson, conceptCategory);
  const base = {
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
    youtubeId: null,
    schemeSide: schemeSide
  };
  base.filmHub = inferFilmHub(base);
  return base;
}

function buildFilmRoomCatalog() {
  const lessons = engine.listValidatedLessons();
  const lessonItems = lessons.map((lesson) => {
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
  const legacyItems = legacy.loadLegacyVideoCatalog().map((item) => {
    item.schemeSide = item.category === legacy.LEGACY_CATEGORIES.PRESS ? null : item.schemeSide;
    item.filmHub = inferFilmHub(item);
    return item;
  });
  const items = [...lessonItems, ...legacyItems].sort(
    (a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0)
  );

  const byCategory = {};
  FILM_HUBS.forEach((hub) => {
    byCategory[hub] = items.filter((i) => i.filmHub === hub).length;
  });

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
  FILM_HUBS,
  KNOWLEDGE_CATEGORIES,
  LEGACY_VIDEO_CATEGORIES,
  inferFilmHub
};
