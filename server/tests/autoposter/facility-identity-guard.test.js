const test = require('node:test');
const assert = require('node:assert/strict');

const eg = require('../../lib/autoposter/evergreen-library');
const copy = require('../../lib/x-autoposter-copy');
const resolver = require('../../lib/contextual-identity-resolver');
const guards = require('../../lib/recruiting-facility-guards');
const handoff = require('../../lib/autoposter/detectives-handoff');

const SWAMP_TEXT =
  "Florida Gators Football\nThe Swamp — one of college football's loudest venues.\nBen Hill Griffin Stadium has anchored Florida football since 1930 — a home-field edge SEC foes respect.\nhttps://floridagators.com/sports/football";

const WILL_PATTERNS = [
  { slug: 'will-griffin', name: 'Will Griffin', patterns: ['Griffin', 'Will Griffin', 'QB Griffin'] }
];

test('swamp evergreen is program facility text', () => {
  assert.equal(guards.isProgramFacilityText(SWAMP_TEXT), true);
});

test('name extract rejects Ben Hill Griffin from stadium text', () => {
  assert.equal(copy.extractPlayerFromText(SWAMP_TEXT), null);
  assert.equal(copy.extractAllPlayerNameCandidates(SWAMP_TEXT).length, 0);
});

test('identity pattern Griffin does not match stadium text', () => {
  const hit = resolver.lookupIdentityPattern(SWAMP_TEXT, WILL_PATTERNS);
  assert.equal(hit, null);
});

test('identity pattern Will Griffin still matches explicit beat', () => {
  const beat = '4-star QB Will Griffin told reporters Florida is a major contender.';
  const hit = resolver.lookupIdentityPattern(beat, WILL_PATTERNS);
  assert.equal(hit?.slug, 'will-griffin');
});

test('detectives handoff blocked for evergreen quality_gate failure', () => {
  const row = eg.buildEvergreenCandidate({
    id: 'swamp-history',
    topic: 'program',
    angle: 'history',
    headline: "The Swamp — one of college football's loudest venues.",
    context: 'Ben Hill Griffin Stadium has anchored Florida football since 1930 — a home-field edge SEC foes respect.',
    sourceUrl: 'https://floridagators.com/sports/football'
  });
  const payload = {
    candidate: { ...row, playerName: 'Will Griffin', playerSlug: 'will-griffin' },
    skipReason: 'quality_gate'
  };
  assert.equal(handoff.shouldHandoff('quality_gate', payload), false);
});

test('hasUfRecruitingSignal false for swamp program copy', () => {
  assert.equal(guards.hasUfRecruitingSignal(SWAMP_TEXT), false);
});

test('hasUfRecruitingSignal true for real recruiting beat', () => {
  const beat = '2027 QB Will Griffin set for an official visit to Gainesville this weekend.';
  assert.equal(guards.hasUfRecruitingSignal(beat), true);
});