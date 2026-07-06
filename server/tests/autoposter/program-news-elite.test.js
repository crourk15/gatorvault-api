/** Program news elite compose — golden facility / NIL / culture beats. */
const test = require('node:test');
const assert = require('node:assert/strict');

const { composeProgramElitePost, THIN_FALLBACK_RE, eliteComposeEnabled } = require('../../lib/autoposter/program/program-compose');
const { resolveNilEntity } = require('../../lib/autoposter/program/nil-entity-allowlist');
const { extractProgramFacts } = require('../../lib/autoposter/program/program-fact-extractor');
const { computeProgramDedupeKey } = require('../../lib/autoposter/program/program-dedupe');
const {
  isRecruitingDominantProgramBeat,
  passesProgramDetectionGate,
  validateProgramCompose
} = require('../../lib/autoposter/program/program-gates');

const HEAVENER_UPGRADE =
  'UF athletics announced a major upgrade to the Heavener Football Training Center, including an expanded weight room and recovery space slated for 2027.';
const FLORIDA_VICTORIOUS_NIL =
  'Florida Victorious announced a verified NIL partnership structure to support Florida Gators football athletes.';
const SUMRALL_CULTURE =
  'Brent Sumrall said "We want guys who compete every snap" as Florida builds its standard in the weight room and meeting rooms.';
const RUMOR_BEAT =
  'Hearing rumors Florida could land a five-star quarterback this weekend — nothing confirmed.';
const MIXED_RECRUITING_FACILITY =
  '2027 four-star WR Jace Hansen loved the Heavener tour on his official visit as Florida keeps pushing in his recruitment.';
const FACILITY_VISIT_IMPRESSION =
  'A top recruit called the Heavener Football Training Center visit the best facility stop he has seen on the SEC circuit.';

test('elite compose enabled unless env disables', () => {
  assert.equal(eliteComposeEnabled(), process.env.X_AUTOPOST_PROGRAM_ELITE_COMPOSE !== 'false');
});

test('Test 1 facility upgrade Heavener', () => {
  const built = composeProgramElitePost({
    beatText: HEAVENER_UPGRADE,
    source: 'Zach Abolverdi',
    programNewsType: 'stadium_facility'
  });
  assert.equal(built.ok, true, built.reason || JSON.stringify(built));
  assert.equal(built.arc, 'facility');
  assert.match(built.text, /Facility Upgrade/i);
  assert.match(built.text, /Heavener Football Training Center/i);
  assert.match(built.text, /2027/i);
  assert.doesNotMatch(built.text, THIN_FALLBACK_RE);
  assert.ok(computeProgramDedupeKey(built.facts));
});

test('Test 2 NIL Florida Victorious', () => {
  assert.equal(resolveNilEntity(FLORIDA_VICTORIOUS_NIL)?.name, 'Florida Victorious');
  const built = composeProgramElitePost({
    beatText: FLORIDA_VICTORIOUS_NIL,
    source: 'GatorsOnline',
    programNewsType: 'nil_infrastructure'
  });
  assert.equal(built.ok, true, built.reason || JSON.stringify(built));
  assert.equal(built.arc, 'nil');
  assert.match(built.text, /Florida Victorious/i);
  assert.match(built.text, /NIL/i);
  assert.doesNotMatch(built.text, THIN_FALLBACK_RE);
});

test('Test 3 culture Sumrall quote', () => {
  const facts = extractProgramFacts(SUMRALL_CULTURE);
  assert.equal(facts.program_speaker, 'Brent Sumrall');
  assert.match(facts.program_quote, /compete every snap/i);
  const built = composeProgramElitePost({ beatText: SUMRALL_CULTURE, source: 'Beat intel' });
  assert.equal(built.ok, true, built.reason || JSON.stringify(built));
  assert.equal(built.arc, 'culture');
  assert.match(built.text, /Brent Sumrall/i);
  assert.match(built.text, /compete every snap/i);
});

test('Test 4 rumor blocked', () => {
  const gate = passesProgramDetectionGate(RUMOR_BEAT);
  assert.equal(gate.ok, false);
  assert.equal(gate.reason, 'rumor_blocked');
  const built = composeProgramElitePost({ beatText: RUMOR_BEAT, source: 'Beat intel' });
  assert.equal(built.ok, false);
  assert.equal(built.reason, 'rumor_blocked');
});

test('Test 5 mixed recruiting+facility blocked from program', () => {
  assert.equal(isRecruitingDominantProgramBeat(MIXED_RECRUITING_FACILITY), true);
  const gate = passesProgramDetectionGate(MIXED_RECRUITING_FACILITY);
  assert.equal(gate.ok, false);
  assert.equal(gate.reason, 'recruiting_dominant');
  const built = composeProgramElitePost({ beatText: MIXED_RECRUITING_FACILITY, source: 'Beat intel' });
  assert.equal(built.ok, false);
  assert.equal(built.reason, 'recruiting_dominant');
});

test('facility visit/impression golden compose', () => {
  const facts = extractProgramFacts(FACILITY_VISIT_IMPRESSION);
  assert.equal(facts.program_type, 'facility_visit');
  assert.equal(facts.facility_visit, true);
  const built = composeProgramElitePost({ beatText: FACILITY_VISIT_IMPRESSION, source: 'Visit intel' });
  assert.equal(built.ok, true, built.reason || JSON.stringify(built));
  assert.equal(built.arc, 'facility_visit');
  assert.match(built.text, /Facility Visit Intel/i);
  assert.match(built.text, /best facility stop/i);
  assert.equal(validateProgramCompose(built.text).ok, true);
});

test('THIN_FALLBACK_RE blocks legacy monitoring copy', () => {
  const legacy = 'Florida program update: major facility upgrades. Monitoring staff/roster impact.';
  assert.match(legacy, THIN_FALLBACK_RE);
  assert.equal(validateProgramCompose(legacy).ok, false);
});