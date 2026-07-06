/** PR-789 compose synonym rotation + frequency suppression. */
const test = require('node:test');
const assert = require('node:assert/strict');

const composeHistory = require('../../../lib/autoposter/compose-angle-history');
const {
  selectSynonymForBucket,
  applyComposeSynonymRotation,
  isSynonymSafeForFacts,
  FREQUENCY_THRESHOLD,
  THIN_FALLBACK_RE
} = require('../../../lib/autoposter/rewrite/compose-synonym-rotation');

test('traction overuse suppresses base synonym', () => {
  composeHistory.clearComposeHistoryForTests();
  for (let i = 0; i < FREQUENCY_THRESHOLD; i++) {
    composeHistory.recordComposeAngle({
      playerSlug: `player-${i}`,
      angleUsed: 'traction',
      synonymUsed: 'traction'
    });
  }
  const pick = selectSynonymForBucket('traction', {}, '');
  assert.equal(pick.suppressed, true);
  assert.notEqual(pick.synonym, 'traction');
});

test('beat override keeps priority bucket when offer interest is explicit', () => {
  composeHistory.clearComposeHistoryForTests();
  for (let i = 0; i < 5; i++) {
    composeHistory.recordComposeAngle({ playerSlug: 'x', angleUsed: 'priority', synonymUsed: 'priority' });
  }
  const facts = { offerInterest: true, beatText: 'Florida is making him a priority early' };
  const pick = selectSynonymForBucket('priority', facts, facts.beatText);
  assert.equal(pick.beatOverride, true);
});

test('unsafe staff-contact synonym blocked without staff fact', () => {
  assert.equal(isSynonymSafeForFacts('staff is in contact', 'staff_contact', { staffContact: false }), false);
  assert.equal(isSynonymSafeForFacts('early attention', 'traction', {}), true);
});

test('thin fallback narrative is blocked — never rotated', () => {
  const out = applyComposeSynonymRotation({
    narrative: 'Florida is building real traction with Fujikawa early in his recruitment.',
    facts: {},
    anglePick: { angle: 'player_quote' },
    playerSlug: 'hunter-fujikawa'
  });
  assert.equal(out.ok, false);
  assert.equal(out.reason, 'thin_fallback_blocked');
  assert.match(String(THIN_FALLBACK_RE), /building real traction/);
});

test('synonym rotation replaces repeated traction lemma in Tier-2 copy', () => {
  composeHistory.clearComposeHistoryForTests();
  for (let i = 0; i < FREQUENCY_THRESHOLD; i++) {
    composeHistory.recordComposeAngle({
      playerSlug: `p-${i}`,
      angleUsed: 'traction',
      synonymUsed: 'traction'
    });
  }
  const out = applyComposeSynonymRotation({
    narrative: "Fujikawa's first trip to The Swamp gave Florida real traction.",
    facts: { visit: { when: 'first trip' }, boardSignal: true },
    anglePick: { angle: 'visit' },
    playerSlug: 'hunter-fujikawa',
    beatText: 'first trip to The Swamp'
  });
  assert.equal(out.ok, true);
  assert.doesNotMatch(out.narrative, /\breal traction\b/i);
  assert.ok(out.rotation.applied.length >= 1);
});
