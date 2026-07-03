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
  assert.ok(detectives.formatResearchInsiderLine(null, TORY_BEAT, { writerName: 'On3' }));
});

test('formatBeatDrivenInsiderLine paraphrases beat without verbatim overlap', () => {
  const quoteRewriter = require('../../lib/x-autoposter-recruiting-quote-rewriter');
  const insider = detectives.formatBeatDrivenInsiderLine(TORY_BEAT, { writerName: 'On3' });
  assert.ok(insider);
  assert.equal(quoteRewriter.exceedsOverlap(insider, TORY_BEAT), false);
});

test('Tory Clark beat-driven candidate survives template + gm2 checks', () => {
  const template = require('../../lib/x-autoposter-template');
  const gm2 = require('../../lib/gm2');
  const quoteRewriter = require('../../lib/x-autoposter-recruiting-quote-rewriter');
  const caseItem = {
    id: 'det_test',
    skipReason: 'needs_resolution',
    beatPost: { text: TORY_BEAT, writerName: 'On3', publishedAt: '2026-06-20T12:00:00.000Z' }
  };
  const hints = detectives.extractHints(caseItem);
  const identity = { playerName: 'Tory Clark', playerSlug: 'tory-clark', classYear: 2028, pos: 'DL' };
  const platformContext = {
    hasFutureCastContext: false,
    url: 'https://gatorvaultinsider.com/vault/recruiting/player/tory-clark',
    slug: 'tory-clark'
  };
  const candidate = detectives.buildBeatDrivenCandidate(caseItem, hints, identity, platformContext);
  assert.equal(copy.isBrokenCopy(candidate.text, candidate), false);
  assert.equal(template.hasTemplateStructure(candidate.text), true);
  assert.equal(quoteRewriter.exceedsOverlap(candidate.templateBlocks.insider, TORY_BEAT), false);
  assert.equal(gm2.filterAutoposterCandidate(candidate), true);
});

test('formatResearchContextLine never returns bare ufPosition token', () => {
  const line = detectives.formatResearchContextLine('tracking', TORY_BEAT, { writerName: 'On3' });
  assert.ok(line.length >= 28);
  assert.notEqual(line.trim().toLowerCase(), 'tracking');
  assert.match(line, /GatorVault Detectives/);
});
