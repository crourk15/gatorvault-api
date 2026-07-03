/** Detectives handoff gate — UF signal + junk beat filtering */
const test = require('node:test');
const assert = require('node:assert/strict');
const handoff = require('../../lib/autoposter/detectives-handoff');

const ROBINSON_BEAT =
  'Man Robinson says Florida has all three of their DB coaches texting him — and after his first visit to Gainesville, the Gators cracked his early leaderboard.';
const GHIOTO_BEAT =
  'Power ranking the five best Miami recruits I saw at camps in June. Five-star EDGE Asher Ghioto #GoCanes.';

test('hasUfRecruitingSignal requires Florida context', () => {
  assert.equal(handoff.hasUfRecruitingSignal(ROBINSON_BEAT), true);
  assert.equal(handoff.hasUfRecruitingSignal(GHIOTO_BEAT), false);
  assert.equal(
    handoff.hasUfRecruitingSignal('2028 EDGE Asher Ghioto is a national priority.'),
    false
  );
});

test('shouldHandoff blocks Miami listicle beats', () => {
  assert.equal(
    handoff.shouldHandoff('missing_situation', { beatPost: { text: GHIOTO_BEAT } }),
    false
  );
  assert.equal(
    handoff.shouldHandoff('strategy_data_missing', { beatPost: { text: ROBINSON_BEAT } }),
    true
  );
});

test('isJunkBeatText flags opponent-only listicles', () => {
  assert.equal(handoff.isJunkBeatText(GHIOTO_BEAT), true);
  assert.equal(handoff.isJunkBeatText(ROBINSON_BEAT), false);
});

test('shouldHandoff maps voice compose failures to detectives strategy repair', () => {
  const beat =
    'Florida made a big impression on 2028 safety Ryan Drakeford during his first trip to The Swamp.';
  assert.equal(
    handoff.shouldHandoff('voice_required_no_legacy_fallback', { beatPost: { text: beat } }),
    true
  );
  assert.equal(handoff.normalizeDetectivesHandoffReason('voice_qa_failed'), 'strategy_data_missing');
});
