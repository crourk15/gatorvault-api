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
  isCommittedPlayer,
  committedElsewhere,
  committedToFlorida,
  ufStaffSummary
} = require('../lib/beat-brief-packet');
const on3 = require('../lib/on3-recruit-client');
const hydrate = require('../lib/on3-board-hydrate');
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

  // Regression: "uncommitted" must NEVER match /committed/ substring and invent commit_culture.
  assert.equal(
    isCommittedPlayer({ status: 'uncommitted', ufStatus: 'uncommitted' }, { ufPosition: 'tracking' }),
    false
  );
  assert.equal(
    isCommittedPlayer({ status: 'uncommitted' }, { eventType: 'target_update', ufPosition: 'uncommitted' }),
    false
  );
  const whyOpen = buildWhyFlorida({
    player: { name: 'Open Board Kid', status: 'uncommitted', stars: 0, pos: 'ATH', classYear: 2028 },
    research: { ufPosition: 'tracking', eventType: 'target_update' },
    intelligence: null,
    beatRows: [],
    rivals: []
  });
  assert.ok(!/UF board read: committed/i.test(whyOpen), whyOpen);
  assert.ok(!/commit locked/i.test(whyOpen), whyOpen);

  const buffalo = {
    name: 'Jackson Stecher',
    classYear: 2028,
    pos: 'QB',
    status: 'committed',
    ufStatus: 'offered',
    committedTo: 'Buffalo Bulls',
    ufRpmPct: 11,
    stars: 3,
    school: 'Lake Brantley, FL'
  };
  assert.equal(
    isCommittedPlayer(buffalo, { eventType: 'target_update', ufPosition: 'tracking' }),
    false
  );
  assert.equal(
    isCommittedPlayer(buffalo, { eventType: 'commit_culture', ufPosition: 'committed' }),
    false
  );
  const whyBuffalo = buildWhyFlorida({
    player: buffalo,
    research: { ufPosition: 'committed', eventType: 'commit_culture' },
    intelligence: null,
    beatRows: [{ detail: 'Jackson Stecher — Florida offer.' }],
    rivals: ['Florida State', 'USF']
  });
  assert.ok(!/UF board read: committed/i.test(whyBuffalo), whyBuffalo);
  assert.ok(!/commit locked/i.test(whyBuffalo), whyBuffalo);
  const angleBuffalo = buildVaultAngle({
    playerName: 'Jackson Stecher',
    research: { ufPosition: 'committed', eventType: 'commit_culture' },
    intelligence: null,
    beatRows: [{ detail: 'Jackson Stecher — Florida offer.' }],
    rivals: ['Florida State'],
    whyFlorida: whyBuffalo,
    player: buffalo
  });
  assert.ok(!/is a Florida COMMIT/i.test(angleBuffalo), angleBuffalo);
  assert.ok(/committed to Buffalo/i.test(angleBuffalo), angleBuffalo);
  assert.ok(/Committed to: Buffalo Bulls/i.test(whyBuffalo), whyBuffalo);
  assert.ok(!/commit culture/i.test(whyBuffalo), whyBuffalo);

  assert.equal(committedToFlorida({ committedTo: 'Florida State' }), false);
  assert.equal(committedToFlorida({ committedTo: 'South Florida' }), false);
  assert.equal(committedToFlorida({ committedTo: 'Florida' }), true);
  assert.equal(committedElsewhere({ committedTo: 'Florida State' }), true);
  assert.equal(
    isCommittedPlayer(
      { name: 'FSU Kid', status: 'committed', committedTo: 'Florida State', ufStatus: 'offered' },
      { eventType: 'commit_culture', ufPosition: 'committed' }
    ),
    false
  );

  const stecherTeams = [
    { team: { name: 'Florida State' }, status: 'Offered', prediction: 37, year: 2028, coaches: [{ name: 'Mike Norvell' }] },
    { team: { name: 'USF' }, status: 'Offered', prediction: 19, year: 2028, coaches: [{ name: 'Michael Hartline' }] },
    { team: { name: 'Florida' }, status: 'Offered', prediction: 11, year: 2028, coaches: [{ name: "Ryan O'Hara" }] },
    { team: { name: 'Buffalo' }, status: 'Committed', prediction: 7, year: 2028, coaches: [{ name: 'Pete Lembo' }] }
  ];
  assert.equal(on3.isFloridaGatorsName('Florida State'), false);
  assert.equal(on3.isFloridaGatorsName('Florida'), true);
  assert.equal(on3.getFloridaTeam(stecherTeams, 2028).team.name, 'Florida');
  assert.equal(hydrate.ufRpmFromTopTeams(stecherTeams, 2028), 11);
  const ufStaff = hydrate.ufStaffFromTopTeams(stecherTeams, 2028);
  assert.ok(ufStaff && /O'Hara|O’Hara/i.test(ufStaff.label), JSON.stringify(ufStaff));
  assert.ok(!/Norvell/i.test(ufStaff.label), JSON.stringify(ufStaff));
  assert.ok(!/Norvell/i.test(String(ufStaffSummary({ on3TopTeams: stecherTeams, classYear: 2028 }) || '')));

  const whyFsuFirst = buildWhyFlorida({
    player: { ...buffalo, ufRpmPct: 37, on3TopTeams: stecherTeams },
    research: { ufPosition: 'committed', eventType: 'commit_culture' },
    intelligence: null,
    beatRows: [],
    rivals: ['Florida State']
  });
  assert.ok(!/Florida On3 RPM ~37%/i.test(whyFsuFirst), whyFsuFirst);
  assert.ok(!/Florida staff: Mike Norvell/i.test(whyFsuFirst), whyFsuFirst);
  assert.ok(!/UF board read: committed/i.test(whyFsuFirst), whyFsuFirst);
  assert.ok(!/leads involved schools/i.test(whyFsuFirst), whyFsuFirst);

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
  assert.ok(!/Beat hook to advance/i.test(angle), angle);
  assert.ok(/INTERNAL intel seed|NEVER name writers/i.test(angle), angle);

  const { formatBriefText } = require('../lib/beat-brief-packet');
  const paste = formatBriefText({
    slug: 'davin-davidson',
    playerName: 'Davin Davidson',
    player,
    inspect: null,
    beatRows: [{ detail: 'acting less like a recruit', source: 'Corey Bender' }],
    research: { ufPosition: 'committed', eventType: 'commit_culture' },
    intelligence: null,
    whyFlorida: why,
    vaultAngle: angle,
    rivals: ['Northwestern', 'Miami']
  });
  assert.ok(/VOICE RULE/i.test(paste), paste);
  assert.ok(/FORBIDDEN|NEVER name writers|never tip/i.test(paste), paste);
  assert.ok(!/Beat hook to advance/i.test(paste), paste);
  assert.ok(!/beat writers bury/i.test(paste), paste);
  assert.ok(/INTERNAL intel seed/i.test(paste), paste);
  // "beat line" is allowed only inside the FORBIDDEN instruction list
  const outsideForbidden = paste.replace(/FORBIDDEN[\s\S]*?(?=\nStructure:)/i, '');
  assert.ok(!/\bbeat line\b/i.test(outsideForbidden), outsideForbidden);
  assert.ok(!/Beat line to advance/i.test(outsideForbidden), outsideForbidden);


  console.log('beat-brief-commit-slug.test.js PASS');
}

main();
