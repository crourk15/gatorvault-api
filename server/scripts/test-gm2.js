/**
 * GM 2.0 integration smoke tests.
 */
const gm2 = require('../lib/gm2');
const { GM2_FEATURES } = require('../lib/gm2/types');

function assert(label, condition) {
  if (!condition) {
    console.error('FAIL:', label);
    process.exitCode = 1;
    return;
  }
  console.log('OK:', label);
}

const badIntel = {
  playerSlug: 'jalen-brewster',
  playerName: 'Jalen Brewster',
  playerId: 'jalen-brewster',
  eventType: 'commit',
  source: 'beat_writer_ingest',
  detail: '5 star DL Jalen Brewster has committed to Florida.',
  timestamp: new Date().toISOString(),
  classYear: 2027,
  school: 'Florida twice this offseason'
};

const sil = gm2.ingestIntel(badIntel, { subsystem: 'test' });
assert('SIL rejects/quarantines bad beat commit intel', sil.action !== 'allow');

const corruptPlayer = {
  slug: 'test-corrupt-player',
  name: 'Test Player',
  pos: 'DL',
  classYear: 2027,
  school: 'Florida twice this offseason',
  skinny: 'SERIOUS push for No.'
};
const ingress = gm2.ingestPlayer(corruptPlayer, { subsystem: 'test' });
assert('Corrupt player write heals instead of quarantining', ingress.action === 'allow');
assert('Corrupt player schedules repair', ingress.needsRepair === true);

const healed = require('../lib/identity-record-validator').healPlayerRecord(
  { slug: 'test-heal', name: 'Heal Test', pos: 'WR', classYear: 2027, school: 'Florida twice this offseason' },
  { slug: 'test-heal', name: 'Heal Test', pos: 'WR', classYear: 2027, school: 'Lake Dallas HS, TX' }
);
assert('healPlayerRecord preserves valid existing school', healed.school === 'Lake Dallas HS, TX');

const goodEvent = {
  playerSlug: 'maxwell-hiller',
  eventType: 'commit',
  source: 'on3',
  title: 'Maxwell Hiller commits to Florida',
  createdAt: new Date().toISOString(),
  classYear: 2027,
  payload: { player: { slug: 'maxwell-hiller', name: 'Maxwell Hiller', committedTo: 'Florida' } }
};
const eventDecision = gm2.ingestEvent(goodEvent, { subsystem: 'test' });
assert('SIL allows On3 commit event', eventDecision.action === 'allow');

const re = gm2.filterPublicEvents([
  { eventType: 'commit', source: 'on3', playerSlug: 'maxwell-hiller', title: 'Commit' },
  { eventType: 'commit', source: 'beat_writer_ingest', playerSlug: 'jalen-brewster', title: 'False' }
]);
assert('RE filters public events', re.length === 1 && re[0].source === 'on3');

const pgv = gm2.validateBeforeRender(GM2_FEATURES.VISIT_RECAP, {
  visits: [],
  bundles: [{ slug: 'a' }, { slug: 'a' }]
});
assert('PGV blocks duplicate players in visit recap payload', !pgv.pass);

const dashboard = gm2.getDashboard();
assert('GM2 dashboard returns quarantine status', dashboard.quarantine != null);

if (process.exitCode) console.error('\nGM2 tests failed.');
else console.log('\nAll GM2 tests passed.');
