/**
 * Smoke test — Film Room Knowledge Engine v2 (schema + translator-only).
 */
const engine = require('../lib/film-room-knowledge-engine');
const validator = require('../lib/film-room-knowledge-validator');
const filmRoom = require('../lib/film-room-feed');

function assert(label, condition) {
  if (!condition) {
    console.error('FAIL:', label);
    process.exitCode = 1;
    return;
  }
  console.log('OK:', label);
}

const catalog = filmRoom.buildFilmRoomCatalog();
assert('catalog uses knowledge engine', catalog.mode === 'knowledge_engine');
assert('catalog has lessons', catalog.items.length >= 8);
assert('no youtube ids in catalog', !catalog.items.some((i) => i.youtubeId || i.embedUrl));
assert('all items marked noVideo', catalog.items.every((i) => i.noVideo === true));

const lesson = engine.renderLesson('frl00002-0000-4000-8000-000000000002');
assert('JACK lesson renders', lesson.ok && lesson.body.includes('JACK'));
assert('lesson has verified body only', lesson.mode === 'translator' && !lesson.body.includes('undefined'));

const fake = engine.renderLesson('00000000-0000-0000-0000-000000000099');
assert('missing lesson skipped', !fake.ok && fake.skipped);

const incomplete = validator.validateConceptRow({ id: 'x', name: 'Fake', category: 'test' });
assert('incomplete concept skipped', !incomplete.ok);

const sourcePolicy = require('../lib/film-room-knowledge-source');
const blockedCharles = sourcePolicy.validateSourceMetadata({
  id: 'blocked',
  source_name: 'Charles Power',
  source_type: 'analyst',
  source_url: 'https://example.com/scouting',
  source_confidence: 95
});
assert('Charles Power source blocked', !blockedCharles.ok);

const lowConfidence = sourcePolicy.validateSourceMetadata({
  id: 'low',
  source_name: 'Glazier Clinics',
  source_type: 'clinic',
  source_url: 'https://www.glazierclinics.com/defense',
  source_confidence: 70
});
assert('low confidence source rejected', !lowConfidence.ok);

assert('lesson includes verified sources section', lesson.ok && lesson.body.includes('Verified Sources'));
assert('lesson exposes source metadata', lesson.ok && Array.isArray(lesson.sources) && lesson.sources.length >= 2);

if (process.exitCode) {
  console.error('\nFilm Room Knowledge Engine v2 tests failed.');
} else {
  console.log('\nAll Film Room Knowledge Engine v2 tests passed.');
  console.log('Lessons published:', catalog.counts.validated, '/', catalog.counts.total + catalog.counts.skipped);
}
