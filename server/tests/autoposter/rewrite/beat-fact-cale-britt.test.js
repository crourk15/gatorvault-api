/** Cale Britt — head-coach offer should not fall back to generic early-interest template. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { composeGoldenFourFactPost } = require('../../../lib/player-intelligence/golden-four-compose');
const { extractBeatFacts, selectAngleFromFacts } = require('../../../lib/autoposter/rewrite/beat-fact-extractor');

const BRITT_BEAT =
  'Florida offered 2028 four-star linebacker Cale Britt. "The offer was super cool, especially coming from the head coach. That means a lot," Britt said.';

test('Britt beat selects head_coach_offer angle', () => {
  const facts = extractBeatFacts(BRITT_BEAT, {
    slug: 'cale-britt',
    player: { name: 'Cale Britt', classYear: 2028, pos: 'LB' }
  });
  assert.equal(facts.headCoachOffer, true);
  assert.match(facts.quote, /super cool/i);
  const angle = selectAngleFromFacts(facts, BRITT_BEAT);
  assert.equal(angle.angle, 'head_coach_offer');
});

test('Britt elite compose resolves head coach quote to Jon Sumrall', () => {
  const built = composeGoldenFourFactPost({
    slug: 'cale-britt',
    intel: { playerName: 'Cale Britt', detail: BRITT_BEAT, classYear: 2028, pos: 'LB' },
    on3Sync: {
      rankingTokens: { on3Stars: 4, on3NationalRank: 266, on3PositionRank: 21, on3StateRank: 37 },
      stars: 4,
      natlRank: 266,
      posRank: 21,
      stateRank: 37
    },
    playerRow: { name: 'Cale Britt', classYear: 2028, pos: 'LB', state: 'FL' },
    composePath: 'elite_pr789'
  });
  assert.equal(built.ok, true, built.reason || JSON.stringify(built));
  assert.match(built.text, /Jon Sumrall/i);
  assert.match(built.text, /super cool/i);
  assert.match(built.text, /June trip to Gainesville/i);
  assert.doesNotMatch(built.text, /Billy Napier/i);
  assert.doesNotMatch(built.text, /Florida has early interest in Britt/i);
});

test('stale Napier beat still publishes Jon Sumrall when quote cites head coach', () => {
  const staleBeat =
    'Florida offered Cale Britt and Billy Napier made it personal. "The offer was super cool, especially coming from the head coach. That means a lot," Britt said.';
  const built = composeGoldenFourFactPost({
    slug: 'cale-britt',
    intel: { playerName: 'Cale Britt', detail: staleBeat, classYear: 2028, pos: 'LB' },
    on3Sync: {
      rankingTokens: { on3Stars: 4, on3NationalRank: 266, on3PositionRank: 21, on3StateRank: 37 },
      stars: 4,
      natlRank: 266,
      posRank: 21,
      stateRank: 37
    },
    playerRow: { name: 'Cale Britt', classYear: 2028, pos: 'LB', state: 'FL' },
    composePath: 'elite_pr789'
  });
  assert.equal(built.ok, true, built.reason || JSON.stringify(built));
  assert.doesNotMatch(built.text, /Billy Napier/i);
  assert.match(built.text, /Jon Sumrall/i);
});
