/** Cobbins On3 team-news must not invent visits or garbled quotes from possessive apostrophes. */
const test = require('node:test');
const assert = require('node:assert/strict');

const { composeGoldenFourFactPost } = require('../../lib/player-intelligence/golden-four-compose');
const { extractBeatFacts, selectAngleFromFacts } = require('../../lib/autoposter/rewrite/beat-fact-extractor');
const { hasFactCompletenessForPr789, validateBannedPhrases } = require('../../lib/autoposter/rewrite/fact-gates');

const COBBINS_BEAT =
  "The Florida Gators' defensive back history and coaching staff continue standing out to one of the country's top 2028 prospects.";

test('Cobbins beat text does not extract a false quote from Gators possessive', () => {
  const facts = extractBeatFacts(COBBINS_BEAT, { player: { name: 'Jermaine Cobbins' } });
  assert.equal(facts.quote, null);
  assert.equal(facts.visit, null);
  assert.equal(facts.programPitch, true);
  assert.equal(hasFactCompletenessForPr789(facts, COBBINS_BEAT), true);
  const angle = selectAngleFromFacts(facts, COBBINS_BEAT);
  assert.equal(angle.angle, 'program_pitch');
});

test('Cobbins fused compose uses program pitch — no campus-in-campus or fake quote', () => {
  const built = composeGoldenFourFactPost({
    slug: 'jermaine-cobbins',
    intel: { playerName: 'Jermaine Cobbins', detail: COBBINS_BEAT, classYear: 2028, pos: 'CB' },
    playerRow: { name: 'Jermaine Cobbins', classYear: 2028, pos: 'CB' }
  });
  assert.equal(built.ok, true, built.reason || 'compose failed');
  assert.match(built.text, /DB tradition and staff pitch are standing out/i);
  assert.doesNotMatch(built.text, /campus in campus/i);
  assert.doesNotMatch(built.text, /he said he "defensive back/i);
  assert.equal(built.validationMeta?.dominantAngle, 'program_pitch');
  assert.equal(built.validationMeta?.composePath, 'pr789_beat_facts');
  const banned = validateBannedPhrases(built.text);
  assert.equal(banned.ok, true, JSON.stringify(banned.violations));
});
