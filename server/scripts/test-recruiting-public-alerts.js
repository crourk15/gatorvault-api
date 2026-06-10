/**
 * Unit tests — public recruiting alerts gate + Brewster false commit purge.
 */
const publicAlerts = require('../lib/recruiting-public-alerts');

function assert(label, condition) {
  if (!condition) {
    console.error('FAIL:', label);
    process.exitCode = 1;
    return;
  }
  console.log('OK:', label);
}

assert(
  'blocks Brewster false commit event',
  !publicAlerts.isPublicRecruitingEvent({
    playerSlug: 'jalen-brewster',
    eventType: 'commit',
    title: 'Jalen Brewster commits to Florida',
    source: 'beat_writer_ingest'
  })
);

assert(
  'allows On3 verified commit',
  publicAlerts.isPublicRecruitingEvent({
    playerSlug: 'maxwell-hiller',
    eventType: 'commit',
    title: 'Maxwell Hiller commits to Florida',
    source: 'on3',
    payload: { player: { committedTo: 'Florida' } }
  })
);

assert(
  'blocks beat_writer_ingest visit from public alerts',
  !publicAlerts.isPublicRecruitingEvent({
    playerSlug: 'some-player',
    eventType: 'official_visit',
    title: 'Some Player — Official Visit Scheduled',
    source: 'beat_writer_ingest',
    payload: { identityConfirmed: true }
  })
);

assert(
  'blocks unverified commit from beat ingest',
  !publicAlerts.isPublicRecruitingEvent({
    playerSlug: 'some-player',
    eventType: 'commit',
    title: 'Some Player commits to Florida',
    source: 'beat_writer_ingest'
  })
);

assert(
  'detects Brewster false commit intel',
  publicAlerts.isBrewsterFalseCommit({
    playerSlug: 'jalen-brewster',
    eventType: 'commit',
    title: 'Jalen Brewster commits to Florida'
  })
);

const filtered = publicAlerts.filterPublicEvents([
  { eventType: 'commit', source: 'on3', title: 'Real commit', playerSlug: 'real-player' },
  { eventType: 'commit', source: 'beat_writer_ingest', title: 'Jalen Brewster commits to Florida', playerSlug: 'jalen-brewster' }
]);
assert('filterPublicEvents keeps only validated rows', filtered.length === 1 && filtered[0].source === 'on3');

if (process.exitCode) {
  console.error('\nPublic recruiting alerts tests failed.');
} else {
  console.log('\nAll public recruiting alerts tests passed.');
}
