/**
 * Smoke test — Film Room merged catalog (Knowledge Engine + legacy video).
 */
const engine = require('../lib/film-room-knowledge-engine');
const validator = require('../lib/film-room-knowledge-validator');
const filmRoom = require('../lib/film-room-feed');
const sourcePolicy = require('../lib/film-room-knowledge-source');
const coachIdentity = require('../lib/official-coach-identity');

function assert(label, condition) {
  if (!condition) {
    console.error('FAIL:', label);
    process.exitCode = 1;
    return;
  }
  console.log('OK:', label);
}

const catalog = filmRoom.buildFilmRoomCatalog();
assert('catalog uses merged mode', catalog.mode === 'merged');
assert('catalog has knowledge lessons', catalog.counts.knowledgeLessons >= 8);
assert('catalog has legacy videos', catalog.counts.legacyVideos >= 3);
assert('GNFP videos present', catalog.items.some((i) => i.category === 'GNFP Film Review' && i.youtubeId));
assert('Film Guy Network present', catalog.items.some((i) => i.category === 'Film Guy Network' && i.youtubeId));
assert('press conferences capped at 5', catalog.items.filter((i) => i.category === 'UF Press Conferences').length <= 5);
assert('knowledge lessons have no youtube', catalog.items.filter((i) => i.knowledgeEngine).every((i) => !i.youtubeId));
assert('legacy videos marked noVideo false', catalog.items.filter((i) => !i.knowledgeEngine).every((i) => i.noVideo === false));

const lesson = engine.renderLesson('frl00002-0000-4000-8000-000000000002');
assert('JACK lesson renders', lesson.ok && lesson.body.includes('JACK'));
assert('lesson has verified body only', lesson.mode === 'translator' && !lesson.body.includes('undefined'));
assert('lesson never uses Robby Faulkner', !/robby faulkner/i.test(lesson.body + lesson.summary));

const fake = engine.renderLesson('00000000-0000-0000-0000-000000000099');
assert('missing lesson skipped', !fake.ok && fake.skipped);

const incomplete = validator.validateConceptRow({ id: 'x', name: 'Fake', category: 'test' });
assert('incomplete concept skipped', !incomplete.ok);

const blockedCharles = sourcePolicy.validateSourceMetadata({
  id: 'blocked',
  source_name: 'Charles Power',
  source_type: 'analyst',
  source_url: 'https://example.com/scouting',
  source_confidence: 95
});
assert('Charles Power source blocked', !blockedCharles.ok);

const blockedRobby = sourcePolicy.validateSourceMetadata({
  id: 'robby',
  source_name: 'Robby Faulkner — UF OC Spring Media Availability',
  source_type: 'oc_dc_interview',
  source_url: 'https://floridagators.com/news/2026/3/15/football-robby-faulkner-spring-practice',
  source_confidence: 95
});
assert('Robby Faulkner source blocked', !blockedRobby.ok);

const lowConfidence = sourcePolicy.validateSourceMetadata({
  id: 'low',
  source_name: 'Glazier Clinics',
  source_type: 'clinic',
  source_url: 'https://www.glazierclinics.com/defense',
  source_confidence: 70
});
assert('low confidence source rejected', !lowConfidence.ok);

assert('coach correction maps Robby to Buster', coachIdentity.applyCoachCorrections('Robby Faulkner offense') === 'Buster Faulkner offense');

assert('lesson includes verified sources section', lesson.ok && lesson.body.includes('Verified Sources'));
assert('lesson exposes source metadata', lesson.ok && Array.isArray(lesson.sources) && lesson.sources.length >= 2);

if (process.exitCode) {
  console.error('\nFilm Room tests failed.');
} else {
  console.log('\nAll Film Room tests passed.');
  console.log('Catalog:', catalog.counts.total, 'items (', catalog.counts.knowledgeLessons, 'lessons +', catalog.counts.legacyVideos, 'videos )');
}
