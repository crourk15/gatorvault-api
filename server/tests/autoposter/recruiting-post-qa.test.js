/** Publish QA — every known bad @gatorvault post must fail; good posts must pass. */
const test = require('node:test');
const assert = require('node:assert/strict');
const qa = require('../../lib/autoposter/recruiting-post-qa');
const copy = require('../../lib/x-autoposter-copy');
const detectives = require('../../lib/autoposter/detectives');

const TORY_BEAT =
  'Tory Clark (2028 DL, Woodward Academy) is at The Swamp for Friday Night Lights. Big night for UF recruiting.';

const BAD_POSTS = [
  {
    label: 'guarantee_program pipeline',
    text: [
      'Florida recruiting intel',
      'Beat intel confirmed UF football context on a prospect that failed first-pass filters.',
      'Beat trail and player profile on Recruiting Hub.',
      'https://gatorvaultinsider.com/vault/recruiting/player/unknown'
    ].join('\n'),
    playerName: null
  },
  {
    label: 'generic visit_intel June Here',
    text: [
      '2027 June. Here',
      'Campus visit window confirmed — Florida had real face time with the prospect in Gainesville.',
      'Repeat campus time is building real momentum behind the scenes.',
      'http://gatorvaultinsider.com/vault/recruiting'
    ].join('\n'),
    playerName: 'June Here'
  },
  {
    label: 'year-only identity + prospect board copy',
    text: [
      '2028',
      "the prospect is on UF's board — staff is tracking this 2028 target.",
      'Florida is quietly gaining traction here as the staff keeps the relationship active.',
      'http://gatorvaultinsider.com/vault/recruiting'
    ].join('\n'),
    playerName: 'Some Player'
  }
];

for (const bad of BAD_POSTS) {
  test(`recruiting QA rejects bad post: ${bad.label}`, () => {
    const candidate = {
      text: bad.text,
      topic: 'recruiting',
      playerName: bad.playerName,
      source: 'auto:detectives',
      validationMeta: { detectivesResolved: true, eliteCompose: true }
    };
    assert.equal(qa.passesPublishGate(candidate), false);
    assert.equal(copy.isBrokenCopy(bad.text, candidate), true);
  });
}

test('buildBeatFallbackBlocks returns null without valid player name', () => {
  const elite = require('../../lib/x-autoposter-elite-caption');
  assert.equal(
    elite.buildBeatFallbackBlocks({
      playerName: null,
      beatText: TORY_BEAT,
      classYear: 2028,
      pos: 'DL'
    }),
    null
  );
  assert.equal(
    elite.buildBeatFallbackBlocks({
      playerName: 'June Here',
      beatText: TORY_BEAT,
      classYear: 2028,
      pos: 'DL'
    }),
    null
  );
});

test('buildCompactRecruitingIdentity requires player name', () => {
  const template = require('../../lib/x-autoposter-template');
  assert.equal(template.buildCompactRecruitingIdentity({ classYear: 2028, pos: 'DL' }), null);
  assert.match(
    template.buildCompactRecruitingIdentity({ classYear: 2028, pos: 'DL', name: 'Tory Clark', school: 'Woodward Academy' }),
    /Tory Clark/
  );
});

test('Tory Clark beat-driven candidate passes full recruiting QA gate', () => {
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
  assert.ok(candidate);
  assert.equal(qa.passesPublishGate(candidate), true);
  assert.equal(copy.isBrokenCopy(candidate.text, candidate), false);
  assert.match(candidate.text, /Tory Clark/);
  assert.match(candidate.text, /\/player\/tory-clark/);
});

test('identityLineValid rejects year-only identity lines', () => {
  assert.equal(qa.identityLineValid('2028', 'Tory Clark'), false);
  assert.equal(qa.identityLineValid('2028 DL', 'Tory Clark'), false);
  assert.equal(qa.identityLineValid('2028 DL Tory Clark (Woodward Academy)', 'Tory Clark'), true);
});
