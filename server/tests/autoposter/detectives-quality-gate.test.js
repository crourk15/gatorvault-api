/** Regression: generic Detectives fallback copy must not pass publish checks. */
const test = require('node:test');
const assert = require('node:assert/strict');
const copy = require('../../lib/x-autoposter-copy');
const policy = require('../../lib/x-autoposter-policy');
const detectives = require('../../lib/autoposter/detectives');

const TORY_BEAT =
  'Tory Clark (2028 DL, Woodward Academy) is at The Swamp for Friday Night Lights. Big night for UF recruiting.';

const BAD_TORY_POST = [
  '2028 Tory Clark',
  'tracking',
  'Full RPM, visit intel, and predictions on FutureCast.',
  'https://gatorvaultinsider.com/vault/futurecast',
].join('\n');

test('isBrokenCopy rejects bare ufPosition + generic FutureCast fallback', () => {
  assert.equal(
    copy.isBrokenCopy(BAD_TORY_POST, {
      templateBlocks: {
        identity: '2028 Tory Clark',
        context: 'tracking',
        insider: 'Full RPM, visit intel, and predictions on FutureCast.',
      },
      validationMeta: { detectivesResolved: true, eliteCompose: true, beatText: TORY_BEAT },
      source: 'auto:detectives',
    }),
    true
  );
});

test('policy rejects generic detectives fallback even when detectivesResolved', () => {
  const check = policy.validatePostContent({
    category: 'news',
    action: 'post',
    text: BAD_TORY_POST,
    sources: [{ label: 'On3', url: 'https://gatorvaultinsider.com' }],
    validationMeta: { detectivesResolved: true, beatText: TORY_BEAT },
    source: 'auto:detectives',
  });
  assert.equal(check.valid, false);
  assert.ok(check.errors.length > 0);
});

test('formatResearchInsiderLine requires beat snippet or breakdown story', () => {
  assert.equal(detectives.formatResearchInsiderLine(null, ''), null);
  assert.equal(detectives.formatResearchInsiderLine(null, 'short beat'), null);
  assert.ok(detectives.formatResearchInsiderLine(null, TORY_BEAT));
});

test('formatResearchContextLine never returns bare ufPosition token', () => {
  const line = detectives.formatResearchContextLine('tracking', TORY_BEAT, { writerName: 'On3' });
  assert.ok(line.length >= 28);
  assert.notEqual(line.trim().toLowerCase(), 'tracking');
  assert.match(line, /GatorVault Detectives/);
});
