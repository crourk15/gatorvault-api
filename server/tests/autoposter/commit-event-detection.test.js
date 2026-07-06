/** Commit event detection + beat commit compose bypass. */
const test = require('node:test');
const assert = require('node:assert/strict');
const commitDetect = require('../../lib/beat-writer-filters');
const beatIngest = require('../../lib/beat-writer-ingest');
const { parseBeatCommitPosts } = require('../../lib/allowlist-target-sync');

const HAYES_BEAT =
  "BREAKING: Class of 2027 CB Kamauri Whitfield has Committed to Florida, he tells me for @Rivals The 5'11\" 190 CB chose the Gators over Oregon and Nebraska \u201cI'M HOME\u201d The best stay in state. Gator nation let's work #GoGators";

const COREY_BEAT =
  "BREAKING: Florida has landed a commitment from DB Kamauri Whitfield! The Orlando native and Gators' No. 1 target at nickel is staking put in the Sunshine State.";

const RUMOR_BEAT =
  'Florida is trending for CB Marcus Lee, decision soon — commitment watch heating up.';

const DECOMMIT_BEAT =
  '2027 CB Kamauri Whitfield has decommitted from Florida and reopened his recruitment.';

test('Hayes Fawcett commit tweet is detected', () => {
  assert.equal(commitDetect.isFloridaCommitBeat(HAYES_BEAT), true);
  assert.equal(commitDetect.resolveCommitEventType(HAYES_BEAT), 'commit');
  assert.equal(beatIngest.resolveRecruitingEventType(HAYES_BEAT), 'commit');
});

test('Corey Bender inverted commit phrasing is detected', () => {
  assert.equal(commitDetect.isFloridaCommitBeat(COREY_BEAT), true);
  assert.equal(beatIngest.resolveRecruitingEventType(COREY_BEAT), 'commit');
});

test('rumor-only beat is not treated as commitment', () => {
  assert.equal(commitDetect.isFloridaCommitBeat(RUMOR_BEAT), false);
  assert.notEqual(beatIngest.resolveRecruitingEventType(RUMOR_BEAT), 'commit');
});

test('decommit beat is not treated as commitment', () => {
  assert.equal(commitDetect.isFloridaDecommitBeat(DECOMMIT_BEAT), true);
  assert.equal(commitDetect.isFloridaCommitBeat(DECOMMIT_BEAT), false);
  assert.equal(beatIngest.resolveRecruitingEventType(DECOMMIT_BEAT), 'decommit');
});

test('parseBeatCommitPosts matches Hayes and Corey posts', () => {
  const posts = [
    { handle: 'hayesfawcett3', text: HAYES_BEAT, publishedAt: '2026-07-06T18:00:00.000Z' },
    { handle: 'Corey_Bender', text: COREY_BEAT, publishedAt: '2026-07-06T18:05:00.000Z' }
  ];
  const rows = parseBeatCommitPosts(posts);
  assert.equal(rows.length, 2);
  assert.ok(rows.every((row) => row.slug === 'kamauri-whitfield'));
  assert.deepEqual(
    rows.map((row) => row.source).sort(),
    ['hayes_fawcett', 'rivals_beat']
  );
});

test('extractCommitQuote pulls player voice from Hayes tweet', () => {
  const quote = commitDetect.extractCommitQuote(HAYES_BEAT);
  assert.ok(quote);
  assert.match(quote, /I'?M HOME/i);
});

test('isCommitLikeSignal covers eventType and beat text', () => {
  assert.equal(
    commitDetect.isCommitLikeSignal({ text: COREY_BEAT, eventType: 'target_update' }),
    true
  );
  assert.equal(
    commitDetect.isCommitLikeSignal({ text: RUMOR_BEAT, eventType: 'target_update' }),
    false
  );
  assert.equal(commitDetect.isCommitLikeSignal({ text: '', eventType: 'commit' }), true);
});

