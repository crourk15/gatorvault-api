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
