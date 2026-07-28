/**
 * Commit framing + On3 news slug identity (no more this-fall).
 * Run: node server/test/beat-brief-commit-slug.test.js
 */
const assert = require('assert');
const {
  parseOn3NewsArticleSlug,
  parseOn3BeatUrlIdentity,
  isLikelyPersonSlug
} = require('../lib/on3-recruit-discovery');
const {
  buildWhyFlorida,
  buildVaultAngle,
  isCommittedPlayer
} = require('../lib/beat-brief-packet');
const { resolvePlayerFromTextSync } = require('../lib/beat-recruiting-ingest-gate');
const teaser = require('../lib/beat-teaser-resolve');

function main() {
  const article =
    'davin-davidson-is-all-in-on-florida-and-plans-to-show-it-this-fall';
  const parsed = parseOn3NewsArticleSlug(article);
  assert.strictEqual(parsed.playerSlug, 'davin-davidson', JSON.stringify(parsed));
  assert.ok(!isLikelyPersonSlug('this-fall'));

  const beat = parseOn3BeatUrlIdentity(
    'The best part about Davin Davidson’s commitment?',
    'https://www.on3.com/teams/florida-gators/news/' + article + '/'
  );
  assert.strictEqual(beat.playerSlug, 'davin-davidson');

  const fromPost = teaser.resolvePlayerFromBeatPostSync({
    text: 'The best part about Davin Davidson’s commitment? planning this fall',
    url: 'https://www.on3.com/teams/florida-gators/news/' + article + '/'
  });
  assert.strictEqual(fromPost.playerSlug, 'davin-davidson', JSON.stringify(fromPost));

  const fromText = resolvePlayerFromTextSync(
    "The best part about Davin Davidson's commitment? The QB is already acting less like a recruit."
  );
  assert.ok(fromText?.playerSlug === 'davin-davidson' || fromText?.playerName === 'Davin Davidson', JSON.stringify(fromText));
  assert.ok(!/'s$/i.test(fromText?.playerName || ''));

  const player = {
    name: 'Davin Davidson',
    classYear: 2027,
    pos: 'QB',
    stars: 4,
    natlRank: 126,
    posRank: 11,
    stateRank: 13,
    state: 'FL',
    school: 'Cardinal Mooney',
    htWt: '6-6 / 215',
    ufStatus: 'Florida Committed',
    committedTo: 'Florida',
    ufRpmPct: 98,
    on3TopTeams: [
      { team: { name: 'Florida' }, status: 'Committed', prediction: 98, year: 2027 },
      { team: { name: 'Northwestern' }, status: 'Offered', prediction: 55, year: 2027 }
    ]
  };
  assert.ok(isCommittedPlayer(player, { eventType: 'target_update', ufPosition: 'tracking' }));

  const why = buildWhyFlorida({
    player,
    research: { ufPosition: 'tracking', eventType: 'target_update' },
    intelligence: null,
    beatRows: [{ detail: 'acting less like a recruit and more like a member of the program', source: 'Corey Bender' }],
    rivals: ['Northwestern', 'Miami']
  });
  assert.ok(/UF board read: committed/i.test(why), why);
  assert.ok(/commit locked|Committed/i.test(why), why);

  const angle = buildVaultAngle({
    playerName: 'Davin Davidson',
    research: { ufPosition: 'tracking', eventType: 'target_update' },
    intelligence: null,
    beatRows: [{ detail: 'acting less like a recruit and more like a member of the program' }],
    rivals: ['Northwestern', 'Miami'],
    whyFlorida: why,
    player
  });
  assert.ok(/COMMIT/i.test(angle), angle);
  assert.ok(!/Pressure angle vs Northwestern/i.test(angle), angle);
  assert.ok(/commitment is locked|none — commitment/i.test(angle), angle);

  console.log('beat-brief-commit-slug.test.js PASS');
}

main();
