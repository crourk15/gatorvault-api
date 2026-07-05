/** PR-789 dominant angle — golden four shadow tests. */
const test = require('node:test');
const assert = require('node:assert/strict');

const voiceEngine = require('../../../lib/autoposter/voice-engine');
const pr6 = require('../../../lib/autoposter/rewrite');
const { GOLDEN_BEATS, toSignal } = require('../fixtures/golden-beats');
const { getTweetCharLimit } = require('../../../lib/autoposter/tweet-char-limit');

process.env.VOICE_PHRASE_MEMORY = 'false';
process.env.X_AUTOPOST_PR6_SHADOW = 'true';
process.env.X_AUTOPOST_PR7_8_9_SHADOW = 'true';
process.env.X_AUTOPOST_PR789_ANGLE_SHADOW = 'true';
process.env.X_AUTOPOST_PR789_ANGLE_ENABLED = 'false';

const EXPECTED_ANGLES = {
  drakeford: 'visit',
  robinson: 'staff',
  willingham: 'board',
  ham: 'staff'
};

for (const id of Object.keys(EXPECTED_ANGLES)) {
  test(`PR-789 angle shadow — ${id} picks ${EXPECTED_ANGLES[id]} angle`, () => {
    const signal = toSignal(GOLDEN_BEATS.find((b) => b.id === id));
    signal.playerSlug = id;
    const out = voiceEngine.autoposterCompose(signal);
    assert.equal(out.ok, true, out.reason);
    const angle = out.metadata?.pr789AngleShadow;
    assert.ok(angle, 'pr789AngleShadow missing');
    assert.equal(angle.ok, true, `${id}: ${angle.reason} — ${JSON.stringify(angle.violations)}`);
    assert.equal(angle.dominantAngle, EXPECTED_ANGLES[id]);
    assert.ok(angle.charCount <= getTweetCharLimit(), `${id} too long: ${angle.charCount}`);
    assert.equal(pr6.isCompleteSentence(angle.rewrittenTweet.split('\n')[1] || ''), true);
    const lines = angle.rewrittenTweet.split('\n').filter(Boolean);
    assert.equal(lines.length, 3, 'expected identity + one arc + url');
  });
}

test('PR-789 angle shadow runs on non-golden beats', () => {
  const signal = toSignal(GOLDEN_BEATS.find((b) => b.id === 'zylen'));
  signal.playerSlug = 'zylen';
  const out = voiceEngine.autoposterCompose(signal);
  assert.equal(out.ok, true);
  assert.ok(out.metadata?.pr789AngleShadow);
  assert.notEqual(out.metadata?.pr789Live, true);
});

test('PR-789 angle live on golden when PR7/8/9 enabled and all four ranked', () => {
  const { setGoldenFourRankingCompleteForTests } = require('../../../lib/player-intelligence/golden-four-on3');
  setGoldenFourRankingCompleteForTests(true);
  process.env.X_AUTOPOST_PR6_ENABLED = 'true';
  process.env.X_AUTOPOST_PR7_8_9_ENABLED = 'true';
  process.env.X_AUTOPOST_PR789_ANGLE_ENABLED = 'false';
  process.env.X_AUTOPOST_PR789_ANGLE_GOLDEN_LIVE = 'true';
  const signal = toSignal(GOLDEN_BEATS.find((b) => b.id === 'ham'));
  signal.playerSlug = 'ham';
  signal.metrics.rpmTop = [
    { school: 'Auburn', pct: 21 },
    { school: 'Vanderbilt', pct: 18 }
  ];
  const out = voiceEngine.autoposterCompose(signal);
  assert.equal(out.ok, true);
  assert.equal(out.metadata?.pr789AngleLive, true);
  assert.equal(out.metadata?.pr789Live, true);
  assert.equal(out.text, out.metadata?.pr789AngleText);
  assert.match(out.text, /energy/i);
  assert.doesNotMatch(out.text, /face time|Marietta/i);
});

test('PR-789 angle live blocked until all four golden rankings complete', () => {
  const { setGoldenFourRankingCompleteForTests } = require('../../../lib/player-intelligence/golden-four-on3');
  setGoldenFourRankingCompleteForTests(false);
  process.env.X_AUTOPOST_PR6_ENABLED = 'true';
  process.env.X_AUTOPOST_PR7_8_9_ENABLED = 'true';
  process.env.X_AUTOPOST_PR789_ANGLE_GOLDEN_LIVE = 'true';
  const signal = toSignal(GOLDEN_BEATS.find((b) => b.id === 'ham'));
  signal.playerSlug = 'ham';
  signal.metrics.compSchools = ['FSU'];
  const out = voiceEngine.autoposterCompose(signal);
  assert.equal(out.ok, true);
  assert.notEqual(out.metadata?.pr789AngleLive, true);
  assert.equal(out.metadata?.pr789Live, true);
});

test('PR-789 angle live stays off non-golden beats', () => {
  process.env.X_AUTOPOST_PR6_ENABLED = 'true';
  process.env.X_AUTOPOST_PR7_8_9_ENABLED = 'true';
  process.env.X_AUTOPOST_PR789_ANGLE_GOLDEN_LIVE = 'true';
  const signal = toSignal(GOLDEN_BEATS.find((b) => b.id === 'zylen'));
  signal.playerSlug = 'zylen';
  const out = voiceEngine.autoposterCompose(signal);
  assert.equal(out.ok, true);
  assert.equal(out.metadata?.pr789AngleLive, undefined);
});
