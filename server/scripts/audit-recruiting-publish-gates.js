#!/usr/bin/env node
/**
 * Audit recruiting publish gates — fails exit 1 if any known bad post could publish.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const copy = require('../lib/x-autoposter-copy');
const qa = require('../lib/autoposter/recruiting-post-qa');
const detectives = require('../lib/autoposter/detectives');

const BAD = [
  {
    id: 'guarantee_program',
    text: [
      'Florida recruiting intel',
      'Beat intel confirmed UF football context on a prospect that failed first-pass filters.',
      'Beat trail and player profile on Recruiting Hub.',
      'https://gatorvaultinsider.com/vault/recruiting/player/unknown'
    ].join('\n'),
    playerName: null,
    source: 'auto:detectives'
  },
  {
    id: 'visit_intel_june_here',
    text: [
      '2027 June. Here',
      'Campus visit window confirmed — Florida had real face time with the prospect in Gainesville.',
      'Repeat campus time is building real momentum behind the scenes.',
      'http://gatorvaultinsider.com/vault/recruiting'
    ].join('\n'),
    playerName: 'June Here',
    source: 'auto:detectives'
  },
  {
    id: 'year_only_prospect_board',
    text: [
      '2028',
      "the prospect is on UF's board — staff is tracking this 2028 target.",
      'Florida is quietly gaining traction here as the staff keeps the relationship active.',
      'http://gatorvaultinsider.com/vault/recruiting'
    ].join('\n'),
    playerName: 'Some Player',
    source: 'auto:detectives'
  }
];

const TORY_BEAT =
  'Tory Clark (2028 DL, Woodward Academy) is at The Swamp for Friday Night Lights. Big night for UF recruiting.';

let failed = 0;

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  failed += 1;
}

function pass(msg) {
  console.log(`PASS: ${msg}`);
}

for (const bad of BAD) {
  const candidate = {
    text: bad.text,
    topic: 'recruiting',
    playerName: bad.playerName,
    playerSlug: bad.playerName ? require('../lib/slug').slugify(bad.playerName) : null,
    source: bad.source,
    validationMeta: { detectivesResolved: true, eliteCompose: true }
  };
  if (!copy.isBrokenCopy(bad.text, candidate)) fail(`${bad.id} not caught by isBrokenCopy`);
  else pass(`${bad.id} blocked by isBrokenCopy`);
  if (qa.passesPublishGate(candidate)) fail(`${bad.id} passed passesPublishGate`);
  else pass(`${bad.id} blocked by passesPublishGate`);
}

const caseItem = {
  id: 'audit_tory',
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
const good = detectives.buildBeatDrivenCandidate(caseItem, hints, identity, platformContext);
if (!good) fail('Tory Clark beat-driven candidate is null');
else if (!qa.passesPublishGate(good)) fail(`Tory Clark failed QA: ${qa.rejectReason(good)}`);
else pass('Tory Clark beat-driven candidate passes full QA gate');

console.log(`\nAudit complete — ${failed} failure(s).`);
process.exit(failed ? 1 : 0);
