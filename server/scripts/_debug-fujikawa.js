const BEAT =
  "Florida's QB board stretches all the way to Hawaii 👀 The latest on 4-star Hunter Fujikawa and why the Gators are giving him plenty to think about 🐊📈 \"The atmosphere, there is nothing like it.\" INTEL: https://t.co/NaVLXABewi";

const ON3_BEAT =
  "Florida made a big impression on Mililani (Hawaii) 4-star quarterback Hunter Fujikawa during the 2028 prospect's first trip to Gainesville, and the atmosphere left a mark.";

const {
  extractBeatFacts,
  selectAngleFromFacts,
  composeFromFacts,
  extractQuote,
  extractBoardSignal
} = require('../lib/autoposter/rewrite/beat-fact-extractor');
const { hasFactCompletenessForPr789 } = require('../lib/autoposter/rewrite/fact-gates');
const { composeGoldenFourFactPost } = require('../lib/player-intelligence/golden-four-compose');

function run(label, beatText) {
  const facts = extractBeatFacts(beatText, {
    slug: 'hunter-fujikawa',
    player: { name: 'Hunter Fujikawa', classYear: 2028 }
  });
  const angle = selectAngleFromFacts(facts, beatText);
  const composed = composeFromFacts(
    facts,
    angle,
    { lastName: 'Fujikawa', beatText },
    { mode: 'elite' }
  );
  console.log('\n===', label, '===');
  console.log('quote:', facts.quote);
  console.log('boardSignal:', facts.boardSignal);
  console.log('offerInterest:', facts.offerInterest);
  console.log('visit:', facts.visit);
  console.log('angle:', angle);
  console.log('complete:', hasFactCompletenessForPr789(facts, beatText));
  console.log('narrative:', composed.narrative);
}

run('tweet beat', BEAT);
run('on3 article beat', ON3_BEAT);
console.log('\nextractQuote tweet:', extractQuote(BEAT));
console.log('boardSignal QB board:', extractBoardSignal("Florida's QB board stretches"));

const built = composeGoldenFourFactPost({
  slug: 'hunter-fujikawa',
  intel: { playerName: 'Hunter Fujikawa', detail: BEAT, classYear: 2028, pos: 'QB' },
  on3Sync: {
    rankingTokens: { on3Stars: 4, on3NationalRank: 222, on3PositionRank: 15, on3StateRank: 2 },
    stars: 4,
    natlRank: 222,
    posRank: 15,
    stateRank: 2
  },
  playerRow: { name: 'Hunter Fujikawa', classYear: 2028, pos: 'QB', state: 'HI' },
  composePath: 'elite_pr789'
});
console.log('\nfull compose ok:', built.ok, built.reason || '');
if (built.text) console.log(built.text);
