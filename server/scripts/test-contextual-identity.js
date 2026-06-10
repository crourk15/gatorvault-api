/**
 * Unit tests — contextual identity resolver (CNR + MOT + RBCM).
 */
const resolver = require('../lib/contextual-identity-resolver');
const ingest = require('../lib/beat-writer-ingest');

function assert(label, condition) {
  if (!condition) {
    console.error('FAIL:', label);
    process.exitCode = 1;
    return;
  }
  console.log('OK:', label);
}

const clues = resolver.parseVagueClues('Five-star DL Jalen is set to officially visit Florida this weekend');
assert('parses stars from vague post', clues.stars === 5);
assert('parses DL position', clues.pos === 'DL');
assert('parses first name Jalen', clues.firstName === 'Jalen');

const clues2 = resolver.parseVagueClues('Texas Tech Five-Star DL visiting Gainesville this weekend');
assert('parses Texas Tech school', clues2.school && /texas tech/i.test(clues2.school));
assert('parses five-star from school lead', clues2.stars === 5);

const mot = resolver.lookupManualOverride('Five-star DL Jalen');
assert('MOT matches vague phrase', mot && mot.playerSlug === 'jalen-brewster');

(async () => {
  const resolved = await resolver.resolveContextualIdentity({
    text: 'Five-star DL Jalen is set to officially visit Florida this weekend',
    sourceHandle: 'corey_bender'
  });
  assert('resolves Five-star DL Jalen via MOT', resolved.confirmed && resolved.confidence >= 70);
  assert('resolved to Jalen Brewster', /brewster/i.test(resolved.player?.name || resolved.mergedSnapshot?.playerName || ''));

  const parsed = ingest.parseBeatPostForVisitIntel({
    handle: 'corey_bender',
    writerName: 'Corey Bender',
    text: 'Five-star DL Jalen is set to officially visit Florida this weekend, per sources.',
    publishedAt: '2026-06-05T14:00:00.000Z',
    url: 'https://x.com/Corey_Bender/status/99'
  });
  assert('beat ingest parses vague visit post', parsed && parsed.eventType === 'official_visit');
  assert('beat ingest keeps vague phrase', parsed && parsed.vaguePhrase);

  if (process.exitCode) {
    console.error('\nContextual identity tests failed.');
  } else {
    console.log('\nAll contextual identity tests passed.');
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
