/** Tweet char limit — X Premium long-post support. */
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getTweetCharLimit,
  isExtendedTweetLimit,
  DEFAULT_TWEET_CHAR_LIMIT,
  MAX_TWEET_CHAR_LIMIT,
  STANDARD_TWEET_CHAR_LIMIT
} = require('../../lib/autoposter/tweet-char-limit');

test('getTweetCharLimit defaults to 500 for elite Premium posts', () => {
  delete process.env.X_CHAR_LIMIT;
  delete process.env.VOICE_CHAR_LIMIT;
  assert.equal(getTweetCharLimit(), DEFAULT_TWEET_CHAR_LIMIT);
  assert.equal(DEFAULT_TWEET_CHAR_LIMIT, 500);
  assert.equal(isExtendedTweetLimit(), true);
});

test('X_CHAR_LIMIT can raise budget up to 4000', () => {
  process.env.X_CHAR_LIMIT = '4000';
  assert.equal(getTweetCharLimit(), 4000);
  delete process.env.X_CHAR_LIMIT;
});

test('char limit caps at 4000 and ignores invalid low values', () => {
  process.env.X_CHAR_LIMIT = '99999';
  assert.equal(getTweetCharLimit(), MAX_TWEET_CHAR_LIMIT);
  process.env.X_CHAR_LIMIT = '100';
  assert.equal(getTweetCharLimit(), DEFAULT_TWEET_CHAR_LIMIT);
  process.env.X_CHAR_LIMIT = String(STANDARD_TWEET_CHAR_LIMIT);
  assert.equal(getTweetCharLimit(), STANDARD_TWEET_CHAR_LIMIT);
  delete process.env.X_CHAR_LIMIT;
});

test('Ham elite paragraph uses full ranks and RPM at default 500 limit', () => {
  delete process.env.X_CHAR_LIMIT;
  process.env.VOICE_PHRASE_MEMORY = 'false';
  process.env.X_AUTOPOST_PR6_ENABLED = 'true';
  process.env.X_AUTOPOST_PR7_8_9_ENABLED = 'true';
  process.env.X_AUTOPOST_PR789_ANGLE_GOLDEN_LIVE = 'true';
  process.env.X_AUTOPOST_PR789_ANGLE_SHADOW = 'true';

  const { setGoldenFourRankingCompleteForTests } = require('../../lib/player-intelligence/golden-four-on3');
  setGoldenFourRankingCompleteForTests(true);

  const voiceEngine = require('../../lib/autoposter/voice-engine');
  const { GOLDEN_BEATS, toSignal } = require('./fixtures/golden-beats');
  const signal = toSignal(GOLDEN_BEATS.find((b) => b.id === 'ham'));
  signal.playerSlug = 'ham';
  signal.player.stars = 4;
  signal.player.natlRank = 102;
  signal.player.posRank = 13;
  signal.player.stateRank = 14;
  signal.player.state = 'GA';
  signal.metrics.rpmTop = [
    { school: 'Auburn', pct: 21 },
    { school: 'Vanderbilt', pct: 18 }
  ];

  const out = voiceEngine.autoposterCompose(signal);
  assert.equal(out.ok, true);
  assert.equal(out.metadata?.pr789AngleLive, true);
  assert.ok(out.text.length <= getTweetCharLimit(), `too long: ${out.text.length}`);
  assert.match(out.text, /4★ · On3 No\. 102 natl · No\. 13 EDGE · No\. 14 GA/);
  assert.match(out.text, /That same pitch has only picked up since June 15/i);
  assert.match(out.text, /Auburn and Vanderbilt lead his RPM board/i);
  assert.match(out.text, /staff sell is landing/i);
  assert.doesNotMatch(out.text, /face time|Marietta/i);
});
