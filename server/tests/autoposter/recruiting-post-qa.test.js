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

test('recruiting QA rejects generic catch-all UF active copy without beat anchor', () => {
  const beat = 'Four-star DL offered by Florida after camp evaluation.';
  const candidate = {
    text: [
      '2028 DL Marcus Example (Example HS)',
      'UF is active with Marcus in this cycle.',
      'Staff contact has picked up as UF pushes in this cycle.',
      'https://gatorvaultinsider.com/vault/futurecast/player/marcus-example'
    ].join('\n'),
    topic: 'recruiting',
    playerName: 'Marcus Example',
    playerSlug: 'marcus-example',
    source: 'auto:beat-writer',
    templateBlocks: {
      identity: '2028 DL Marcus Example (Example HS)',
      context: 'UF is active with Marcus in this cycle.',
      insider: 'Staff contact has picked up as UF pushes in this cycle.'
    },
    validationMeta: { beatText: beat, eliteCompose: true }
  };
  assert.equal(qa.passesPublishGate(candidate), false);
  assert.match(qa.rejectReason(candidate), /generic_prospect_copy|missing_beat_anchor/);
});

test('recruiting QA rejects repeat campus momentum boilerplate', () => {
  const candidate = {
    text: [
      '2028 DL Tory Clark (Woodward Academy)',
      'Tory Clark has a Gainesville visit window on the books.',
      'Repeat campus time is building real momentum behind the scenes.',
      'https://gatorvaultinsider.com/vault/futurecast/player/tory-clark'
    ].join('\n'),
    topic: 'recruiting',
    playerName: 'Tory Clark',
    playerSlug: 'tory-clark',
    templateBlocks: {
      identity: '2028 DL Tory Clark (Woodward Academy)',
      context: 'Tory Clark has a Gainesville visit window on the books.',
      insider: 'Repeat campus time is building real momentum behind the scenes.'
    },
    validationMeta: { beatText: TORY_BEAT, eliteCompose: true }
  };
  assert.equal(qa.passesPublishGate(candidate), false);
});

test('beatOnlyCopyForAngle is disabled to prevent generic fallback posts', () => {
  const platform = require('../../lib/autoposter/detectives-platform');
  assert.equal(platform.beatOnlyCopyForAngle('visit_intel'), null);
});

test('voice publish gate passes after compose records hook in phrase memory', () => {
  const phraseMemory = require('../../lib/autoposter/voice-phrase-memory');
  const hook = 'Circle this one.';
  phraseMemory.recordHook(hook);

  const beat =
    'NEW: Florida made a big impression on 2028 safety Ryan Drakeford during his first trip to The Swamp.';
  const candidate = {
    text: [
      '2028 S Ryan Drakeford',
      'UF is using live campus time to test fit — the staff wants separation in this safety class.',
      hook,
      'https://gatorvaultinsider.com/vault/futurecast/player/ryan-drakeford'
    ].join('\n'),
    topic: 'recruiting',
    playerName: 'Ryan Drakeford',
    playerSlug: 'ryan-drakeford',
    validationMeta: {
      voiceEngine: true,
      beatText: beat,
      signalType: 'recruiting',
      voiceBlocks: {
        context: 'UF is using live campus time to test fit — the staff wants separation in this safety class.',
        strategy: 'UF is using live campus time to test fit — the staff wants separation in this safety class.',
        hook,
        cta: 'https://gatorvaultinsider.com/vault/futurecast/player/ryan-drakeford'
      },
      detectivesPromoted: true
    }
  };

  assert.equal(qa.passesVoicePublishGate(candidate), true);
});

test('voice publish gate passes after compose records CTA in phrase memory', () => {
  const phraseMemory = require('../../lib/autoposter/voice-phrase-memory');
  const cta = 'gatorvaultinsider.com/vault/futurecast/player/merrick-ham';
  phraseMemory.recordCta(cta);

  const beat =
    'Four-star 2028 EDGE Merrick Ham was on campus at Florida in early March.';
  const candidate = {
    text: [
      '2028 EDGE Merrick Ham',
      'Gainesville activity matters here — visit timing tracks with UF board momentum.',
      'Visit window on 2026-06-15 carries real weight in this race.',
      'Watch this name.',
      cta
    ].join('\n'),
    topic: 'recruiting',
    playerName: 'Merrick Ham',
    playerSlug: 'merrick-ham',
    validationMeta: {
      voiceEngine: true,
      beatText: beat,
      signalType: 'recruiting',
      voiceBlocks: {
        context: 'Gainesville activity matters here — visit timing tracks with UF board momentum.',
        strategy: 'Visit window on 2026-06-15 carries real weight in this race.',
        hook: 'Watch this name.',
        cta
      },
      detectivesPromoted: true
    }
  };

  assert.equal(qa.passesVoicePublishGate(candidate), true);
});
