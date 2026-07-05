/** Beat-fact extraction + facts-only PR-789 — Ham proof case. */
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  extractBeatFacts,
  selectAngleFromFacts,
  composeFromFacts
} = require('../../../lib/autoposter/rewrite/beat-fact-extractor');
const { resolveValidCompSchools } = require('../../../lib/autoposter/rewrite/comp-sourcing');
const { validateBannedPhrases, hasFactCompletenessForPr789 } = require('../../../lib/autoposter/rewrite/fact-gates');
const { GOLDEN_BEATS } = require('../fixtures/golden-beats');

const HAM_BEAT = GOLDEN_BEATS.find((b) => b.id === 'ham');

test('comp sourcing rejects high school and keeps Auburn/Vanderbilt', () => {
  const pack = resolveValidCompSchools({
    beatText: HAM_BEAT.beatText,
    metrics: HAM_BEAT.metrics,
    player: HAM_BEAT.player,
    intel: { competitors: [{ school: 'Marietta' }] }
  });
  assert.deepEqual(pack.schools, ['Auburn', 'Vanderbilt']);
  assert.equal(pack.schools.includes('Marietta'), false);
});

test('Ham beat extracts staff energy, quote, visit, and rpmTop', () => {
  const facts = extractBeatFacts(HAM_BEAT.beatText, {
    metrics: HAM_BEAT.metrics,
    player: HAM_BEAT.player
  });
  assert.equal(facts.staffEnergy, true);
  assert.match(facts.quote, /loved the energy/i);
  assert.equal(facts.visit?.when, 'early March');
  assert.equal(facts.followUpSince, 'June 15');
  assert.deepEqual(
    facts.rpmTop.map((r) => r.school),
    ['Auburn', 'Vanderbilt']
  );
  assert.equal(hasFactCompletenessForPr789(facts), true);
});

test('Ham angle is staff/energy not competition', () => {
  const facts = extractBeatFacts(HAM_BEAT.beatText, {
    metrics: HAM_BEAT.metrics,
    player: HAM_BEAT.player
  });
  const pick = selectAngleFromFacts(facts, HAM_BEAT.beatText);
  assert.equal(pick.angle, 'staff');
});

test('Ham elite insider paragraph matches editorial flow', () => {
  const facts = extractBeatFacts(HAM_BEAT.beatText, {
    metrics: HAM_BEAT.metrics,
    player: HAM_BEAT.player
  });
  const pick = selectAngleFromFacts(facts, HAM_BEAT.beatText);
  const out = composeFromFacts(facts, pick, { lastName: 'Ham' }, { mode: 'elite' });
  const banned = validateBannedPhrases(out.narrative);
  assert.equal(banned.ok, true, JSON.stringify(banned.violations));
  assert.match(out.narrative, /early March/i);
  assert.match(out.narrative, /— he said he "loved the energy that I saw\."/);
  assert.match(out.narrative, /That same pitch has only picked up since June 15/i);
  assert.match(out.narrative, /lead his RPM board/i);
  assert.match(out.narrative, /staff sell is landing/i);
  assert.doesNotMatch(out.narrative, /face time|Marietta|lane widening/i);
});

test('Ham dual-mode quote paraphrase avoids first-person I saw', () => {
  const facts = extractBeatFacts(HAM_BEAT.beatText, {
    metrics: HAM_BEAT.metrics,
    player: HAM_BEAT.player
  });
  const pick = selectAngleFromFacts(facts, HAM_BEAT.beatText);
  const out = composeFromFacts(facts, pick, { lastName: 'Ham' }, { mode: 'dual' });
  assert.match(out.narrative1, /loved the energy he saw from UF staff/i);
  assert.doesNotMatch(out.narrative1, /that I saw/i);
  assert.match(out.narrative2, /June 15/i);
  assert.match(out.narrative2, /Auburn and Vanderbilt/i);
});

test('Ham facts-only copy avoids banned filler and mentions real rivals', () => {
  const facts = extractBeatFacts(HAM_BEAT.beatText, {
    metrics: HAM_BEAT.metrics,
    player: HAM_BEAT.player
  });
  const pick = selectAngleFromFacts(facts, HAM_BEAT.beatText);
  const out = composeFromFacts(facts, pick, { lastName: 'Ham' }, { mode: 'single', compact: false });
  const banned = validateBannedPhrases(out.narrative);
  assert.equal(banned.ok, true, JSON.stringify(banned.violations));
  assert.match(out.narrative, /early March/i);
  assert.match(out.narrative, /loved the energy|energy he saw/i);
  assert.match(out.narrative, /June 15/i);
  assert.match(out.narrative, /Auburn and Vanderbilt/i);
  assert.doesNotMatch(out.narrative, /Marietta/i);
  assert.doesNotMatch(out.narrative, /face time/i);
  assert.doesNotMatch(out.narrative, /lane widening/i);
});
