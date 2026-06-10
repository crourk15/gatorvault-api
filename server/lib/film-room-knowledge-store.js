/**
 * Film Room Knowledge Engine — structured database store (schema v2).
 * Tables: football_concepts, uf_scheme_library, player_traits,
 *         recruiting_fit_rules, opponent_tendencies, film_room_lessons, verification_log
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data', 'film-room-knowledge');

const TABLE_FILES = {
  football_concepts: 'football_concepts.json',
  uf_scheme_library: 'uf_scheme_library.json',
  player_traits: 'player_traits.json',
  recruiting_fit_rules: 'recruiting_fit_rules.json',
  opponent_tendencies: 'opponent_tendencies.json',
  film_room_lessons: 'film_room_lessons.json',
  verification_log: 'verification_log.json'
};

const LESSON_TYPE_LABELS = {
  scheme_library: 'Scheme Library',
  concept_breakdown: 'Concept Breakdown',
  recruiting_fit: 'Recruiting Fit',
  opponent_prep: 'Opponent Prep',
  position_traits: 'Position Traits'
};

function readTable(tableName) {
  const file = TABLE_FILES[tableName];
  if (!file) return [];
  try {
    const doc = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
    return doc.records || [];
  } catch {
    return [];
  }
}

function indexById(records) {
  const map = new Map();
  for (const row of records || []) {
    if (row?.id) map.set(row.id, row);
  }
  return map;
}

let _cache = null;

function loadKnowledge() {
  if (_cache) return _cache;

  const manifest = (() => {
    try {
      return JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'manifest.json'), 'utf8'));
    } catch {
      return { version: 2 };
    }
  })();

  const football_concepts = readTable('football_concepts');
  const uf_scheme_library = readTable('uf_scheme_library');
  const player_traits = readTable('player_traits');
  const recruiting_fit_rules = readTable('recruiting_fit_rules');
  const opponent_tendencies = readTable('opponent_tendencies');
  const film_room_lessons = readTable('film_room_lessons');
  const verification_log = readTable('verification_log');

  _cache = {
    manifest,
    football_concepts,
    uf_scheme_library,
    player_traits,
    recruiting_fit_rules,
    opponent_tendencies,
    film_room_lessons,
    verification_log,
    conceptsById: indexById(football_concepts),
    schemesById: indexById(uf_scheme_library),
    traitsById: indexById(player_traits),
    fitRulesById: indexById(recruiting_fit_rules),
    opponentsById: indexById(opponent_tendencies),
    lessonsById: indexById(film_room_lessons),
    verifiedRecordIds: new Set(
      verification_log.map((v) => `${v.table_name}:${v.record_id}`)
    )
  };
  return _cache;
}

function reloadKnowledge() {
  _cache = null;
  return loadKnowledge();
}

function isHumanVerified(tableName, recordId) {
  const db = loadKnowledge();
  if (db.verifiedRecordIds.has(`${tableName}:${recordId}`)) return true;
  const row = getRecord(tableName, recordId);
  return !!(row?.last_verified);
}

function getRecord(tableName, id) {
  if (!id) return null;
  const db = loadKnowledge();
  switch (tableName) {
    case 'football_concepts':
      return db.conceptsById.get(id) || null;
    case 'uf_scheme_library':
      return db.schemesById.get(id) || null;
    case 'player_traits':
      return db.traitsById.get(id) || null;
    case 'recruiting_fit_rules':
      return db.fitRulesById.get(id) || null;
    case 'opponent_tendencies':
      return db.opponentsById.get(id) || null;
    case 'film_room_lessons':
      return db.lessonsById.get(id) || null;
    default:
      return null;
  }
}

function getConcept(id) {
  return getRecord('football_concepts', id);
}

function getScheme(id) {
  return getRecord('uf_scheme_library', id);
}

function getTrait(id) {
  return getRecord('player_traits', id);
}

function getFitRule(id) {
  return getRecord('recruiting_fit_rules', id);
}

function getOpponentTendency(id) {
  return getRecord('opponent_tendencies', id);
}

function getLesson(id) {
  return getRecord('film_room_lessons', id);
}

function listLessons({ lessonType = null } = {}) {
  const db = loadKnowledge();
  let rows = [...db.film_room_lessons];
  if (lessonType) {
    rows = rows.filter((l) => l.lesson_type === lessonType);
  }
  return rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

function lessonTypeLabel(type) {
  return LESSON_TYPE_LABELS[type] || type || 'Lesson';
}

function listCatalog() {
  const db = loadKnowledge();
  return {
    version: db.manifest.version,
    updatedAt: db.manifest.updatedAt,
    mode: 'knowledge_engine',
    counts: {
      football_concepts: db.football_concepts.length,
      uf_scheme_library: db.uf_scheme_library.length,
      player_traits: db.player_traits.length,
      recruiting_fit_rules: db.recruiting_fit_rules.length,
      opponent_tendencies: db.opponent_tendencies.length,
      film_room_lessons: db.film_room_lessons.length,
      verification_log: db.verification_log.length
    },
    lessonTypes: Object.entries(LESSON_TYPE_LABELS).map(([id, label]) => ({ id, label })),
    concepts: db.football_concepts.map((c) => ({ id: c.id, name: c.name, category: c.category })),
    schemes: db.uf_scheme_library.map((s) => ({ id: s.id, unit: s.unit, concept_id: s.concept_id })),
    traits: db.player_traits.map((t) => ({ id: t.id, position: t.position, trait_name: t.trait_name })),
    opponents: [...new Set(db.opponent_tendencies.map((o) => o.opponent))].map((name) => ({ name }))
  };
}

module.exports = {
  DATA_DIR,
  TABLE_FILES,
  LESSON_TYPE_LABELS,
  loadKnowledge,
  reloadKnowledge,
  isHumanVerified,
  getRecord,
  getConcept,
  getScheme,
  getTrait,
  getFitRule,
  getOpponentTendency,
  getLesson,
  listLessons,
  lessonTypeLabel,
  listCatalog
};
