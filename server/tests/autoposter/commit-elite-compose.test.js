/** Commit Elite Compose v1 — research-backed commitment posts. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { composeCommitElite, extractCommitFacts } = require('../../lib/autoposter/commit-elite/compose-commit-elite');
const qa = require('../../lib/autoposter/recruiting-post-qa');

const HAYES_BEAT =
  "BREAKING: Class of 2027 CB Kamauri Whitfield has Committed to Florida, he tells me for @Rivals The 5'11\" 190 CB chose the Gators over Oregon and Nebraska \u201cI'M HOME\u201d The best stay in state. Gator nation let's work #GoGators";

const COREY_BEAT =
  "BREAKING: Florida has landed a commitment from DB Kamauri Whitfield! The Orlando native and Gators' No. 1 target at nickel is staking put in the Sunshine State.";

const mockCtx = {
  name: 'Kamauri Whitfield',
  pos: 'CB',
  classYear: 2027,
  school: 'Trinity HS',
  stars: 4,
  htWt: "5'11\", 190",
  hasFullIdentity: true,
  hasMinimumContext: true
};

const mockResearch = {
  playerName: 'Kamauri Whitfield',
  playerSlug: 'kamauri-whitfield',
  eventType: 'commit',
  ufPosition: 'staff priority',
  topSchools: ['Oregon', 'Nebraska'],
  player: { posRank: 12, natlRank: 175, stateRank: 8, state: 'FL', pos: 'CB', classYear: 2027 },
  scouting: {
    analystName: 'War Room',
    scoutingSummary: 'Whitfield is a twitchy cover corner with elite ball skills and closing speed in phase.'
  },
  breakdown: {
    strengths: ["Scheme fit in Napier's press-heavy secondary"],
    sources: [{ writer: 'War Room' }]
  }
};

test('extractCommitFacts pulls quote and competing schools from Hayes beat', () => {
  const facts = extractCommitFacts(HAYES_BEAT, mockResearch, mockCtx);
  assert.ok(facts.quote);
  assert.match(facts.quote, /I'?M HOME/i);
  assert.deepEqual(facts.competingSchools.slice(0, 2), ['Oregon', 'Nebraska']);
  assert.equal(facts.measurements, "5'11\", 190");
});

test('composeCommitElite builds identity, battle context, and quote insider line', () => {
  const composed = composeCommitElite({
    research: mockResearch,
    playerData: { ctx: mockCtx, data: { playerSlug: 'kamauri-whitfield' } },
    beatText: HAYES_BEAT,
    newsEvent: 'committed to Florida'
  });
  assert.ok(composed?.text, 'expected composed text');
  assert.match(composed.templateBlocks.identity, /Kamauri Whitfield/i);
  assert.match(composed.templateBlocks.identity, /CB/i);
  assert.match(composed.templateBlocks.context, /Florida lands a commitment from Kamauri/i);
  assert.match(composed.templateBlocks.context, /Oregon and Nebraska/i);
  assert.match(composed.templateBlocks.insider, /I'?M HOME/i);
  assert.equal(composed.commitElite, true);
});

test('composeCommitElite uses scouting when no quote in Corey beat', () => {
  const composed = composeCommitElite({
    research: mockResearch,
    playerData: { ctx: mockCtx, data: { playerSlug: 'kamauri-whitfield' } },
    beatText: COREY_BEAT
  });
  assert.ok(composed?.text);
  assert.match(composed.templateBlocks.context, /priority target at nickel/i);
  assert.match(
    composed.templateBlocks.insider,
    /War Room|Scheme fit|twitchy cover corner/i
  );
});

test('composed Hayes commit passes recruiting QA gate', () => {
  const composed = composeCommitElite({
    research: mockResearch,
    playerData: { ctx: mockCtx, data: { playerSlug: 'kamauri-whitfield' } },
    beatText: HAYES_BEAT
  });
  const candidate = {
    ok: true,
    text: `${composed.text}\nhttps://gatorvaultinsider.com/vault/futurecast/player/kamauri-whitfield`,
    playerName: mockCtx.name,
    playerSlug: 'kamauri-whitfield',
    topic: 'recruiting',
    templateBlocks: composed.templateBlocks,
    validationMeta: { commitElite: true, beatText: HAYES_BEAT }
  };
  assert.equal(qa.passesPublishGate(candidate), true, qa.rejectReason(candidate));
});
