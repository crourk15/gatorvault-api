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
  assert.doesNotMatch(candidate.text, /GatorVault Detectives|\[writer\]|signal verified on a florida recruiting target/i);
  assert.match(candidate.text, /Gainesville|FNL|Friday Night Lights|Tory Clark/i);
});

test('formatResearchContextLine never returns bare ufPosition token', () => {
  const line = detectives.formatResearchContextLine('tracking', TORY_BEAT, { writerName: 'On3' }, {
    playerName: 'Tory Clark',
    classYear: 2028,
    pos: 'DL'
  });
  assert.ok(line.length >= 28);
  assert.notEqual(line.trim().toLowerCase(), 'tracking');
  assert.match(line, /camp|Gainesville|Swamp|Friday Night Lights|FNL|UF coaches/i);
  assert.doesNotMatch(line, /GatorVault Detectives|\[writer\]/i);
});

test('isBrokenCopy rejects robotic Detectives pipeline branding', () => {
  const robotic = [
    '2028 Tory Clark DL',
    'GatorVault Detectives — signal verified on a Florida recruiting target.',
    '[writer] logged a campus visit window — UF staff had extended face time with the prospect in Gainesville.',
    'https://gatorvaultinsider.com/vault/recruiting/player/tory-clark'
  ].join('\n');
  assert.equal(copy.isBrokenCopy(robotic, { validationMeta: { detectivesResolved: true } }), true);
});

const LIVE_BAD_POST = [
  'Florida recruiting intel',
  'Beat intel confirmed UF football context on a prospect that failed first-pass filters.',
  'Beat trail and player profile on Recruiting Hub.',
  'https://gatorvaultinsider.com/vault/recruiting/player/unknown'
].join('\n');

test('isBrokenCopy rejects live guarantee_program pipeline copy', () => {
  assert.equal(
    copy.isBrokenCopy(LIVE_BAD_POST, {
      source: 'auto:detectives',
      validationMeta: { detectivesResolved: true, detectivesPath: 'guarantee_program', eliteCompose: true },
    }),
    true
  );
});

test('buildGuaranteeCandidate returns null without resolved player identity', () => {
  const caseItem = { id: 'det_no_identity', skipReason: 'needs_resolution', beatPost: { text: TORY_BEAT } };
  const hints = detectives.extractHints(caseItem);
  const platformContext = { hasFutureCastContext: false, url: 'https://gatorvaultinsider.com/vault/recruiting' };
  const emptyIdentity = { playerName: null, playerSlug: null, classYear: null, pos: null };
  assert.equal(detectives.buildGuaranteeCandidate(caseItem, hints, emptyIdentity, 0, platformContext), null);
});

test('buildBeatDrivenCandidate returns null without resolved player identity', () => {
  const caseItem = { id: 'det_no_identity', skipReason: 'needs_resolution', beatPost: { text: TORY_BEAT } };
  const hints = detectives.extractHints(caseItem);
  const platformContext = { hasFutureCastContext: false, url: 'https://gatorvaultinsider.com/vault/recruiting' };
  const emptyIdentity = { playerName: null, playerSlug: null, classYear: null, pos: null };
  assert.equal(detectives.buildBeatDrivenCandidate(caseItem, hints, emptyIdentity, platformContext), null);
});

test('detectives posts are not treated as program news bypass', async () => {
  const fill = require('../../lib/x-autoposter-fill');
  const detectivesPost = {
    source: 'auto:detectives',
    identityConfirmed: true,
    validationMeta: { detectivesResolved: true, eliteCompose: true },
    playerName: null,
    playerSlug: null,
    text: LIVE_BAD_POST,
  };
  assert.equal(fill.isProgramOrTeamNews(detectivesPost), false);
});
