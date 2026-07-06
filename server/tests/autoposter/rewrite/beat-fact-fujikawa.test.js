/** Fujikawa pattern pack tests */
const test = require('node:test');
const assert = require('node:assert/strict');

const { composeGoldenFourFactPost } = require('../../../lib/player-intelligence/golden-four-compose');
const {
  extractBeatFacts,
  selectAngleFromFacts,
  composeFromFacts,
  formatEliteQuoteEmbed
} = require('../../../lib/autoposter/rewrite/beat-fact-extractor');
const { THIN_FALLBACK_RE } = require('../../../lib/autoposter/rewrite/compose-synonym-rotation');

const FUJIKAWA_BEAT =
  'Florida\'s QB board stretches all the way to Hawaii. The latest on 4-star Hunter Fujikawa and why the Gators are giving him plenty to think about. "The atmosphere, there is nothing like it."';

const FUJIKAWA_FUSED =
  FUJIKAWA_BEAT + " Florida made a big impression during the prospect's first trip to Gainesville.";

test('extracts board, geographic, quote', () => {
  const facts = extractBeatFacts(FUJIKAWA_BEAT, { player: { name: 'Hunter Fujikawa' } });
  assert.equal(facts.quote, 'The atmosphere, there is nothing like it.');
  assert.equal(facts.boardSignal, true);
  assert.equal(facts.geographicSignal, true);
});

test('atmosphere quote embed', () => {
  const embed = formatEliteQuoteEmbed('The atmosphere, there is nothing like it.');
  assert.match(embed, /atmosphere is unlike anything else/i);
});

test('geographic board angle', () => {
  const facts = extractBeatFacts(FUJIKAWA_BEAT, { player: { name: 'Hunter Fujikawa' } });
  const angle = selectAngleFromFacts(facts, FUJIKAWA_BEAT);
  assert.equal(angle.angle, 'board');
});

test('elite compose no thin fallback', () => {
  const built = composeGoldenFourFactPost({
    slug: 'hunter-fujikawa',
    intel: { playerName: 'Hunter Fujikawa', detail: FUJIKAWA_BEAT, classYear: 2028, pos: 'QB' },
    on3Sync: {
      rankingTokens: { on3Stars: 4, on3NationalRank: 120, on3PositionRank: 8, on3StateRank: 1 },
      stars: 4,
      natlRank: 120,
      posRank: 8,
      stateRank: 1
    },
    playerRow: { name: 'Hunter Fujikawa', classYear: 2028, pos: 'QB', state: 'HI' },
    composePath: 'elite_pr789'
  });
  assert.equal(built.ok, true, built.reason || JSON.stringify(built));
  assert.doesNotMatch(built.text, THIN_FALLBACK_RE);
  assert.match(built.text, /board stretches|cross-country|plenty to think about/i);
  assert.match(built.text, /atmosphere is unlike anything else/i);
});

test('fused visit arc', () => {
  const facts = extractBeatFacts(FUJIKAWA_FUSED, { player: { name: 'Hunter Fujikawa' } });
  assert.equal(facts.visit?.when, 'his first Gainesville visit');
  const composed = composeFromFacts(
    facts,
    selectAngleFromFacts(facts, FUJIKAWA_FUSED),
    { lastName: 'Fujikawa', beatText: FUJIKAWA_FUSED },
    { mode: 'elite' }
  );
  assert.match(composed.narrative, /first trip to Gainesville|Gainesville left an impression/i);
});
