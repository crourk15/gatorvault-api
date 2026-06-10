/**
 * Unit tests — identity record validator + visit recap gates.
 */
const validator = require('../lib/identity-record-validator');

function assert(label, condition) {
  if (!condition) {
    console.error('FAIL:', label);
    process.exitCode = 1;
    return;
  }
  console.log('OK:', label);
}

assert(
  'rejects corrupted school Florida twice this offseason',
  !validator.isValidSchoolField('Florida twice this offseason')
);

assert(
  'rejects college as primary school for recruit',
  !validator.isValidSchoolField('Texas Tech')
);

assert(
  'accepts valid high school',
  validator.isValidSchoolField('Lake Dallas HS, TX')
);

assert(
  'rejects Brewster corrupted player record',
  !validator.validatePlayerIdentityRecord({
    slug: 'jalen-brewster',
    name: 'Jalen Brewster',
    pos: 'DL',
    classYear: 2027,
    school: 'Florida twice this offseason',
    skinny: 'Florida continues to make a SERIOUS push for No.'
  }).valid
);

assert(
  'rejects duplicate fingerprint in batch',
  !validator.validateIntelForArticle(
    { playerSlug: 'x', fingerprint: 'fp1', eventType: 'official_visit', source: 'on3', detail: '2027 WR will take an official visit to Gainesville this weekend.' },
    { seenFingerprints: new Set(['fp1']) }
  ).valid
);

assert(
  'accepts verified new On3 visit intel',
  validator.isVerifiedNewVisitIntel(
    {
      eventType: 'official_visit',
      source: 'on3',
      reportedAt: new Date().toISOString(),
      fingerprint: 'fp_new'
    },
    Date.now() - 86400000
  )
);

assert(
  'blocks stale visit intel for recap',
  !validator.isVerifiedNewVisitIntel(
    {
      eventType: 'official_visit',
      source: 'on3',
      reportedAt: '2026-01-01T00:00:00.000Z',
      fingerprint: 'fp_old'
    },
    Date.now() - 86400000
  )
);

assert('dedupes intel fingerprints', validator.dedupeIntelByFingerprint([
  { fingerprint: 'a', playerSlug: 'p1' },
  { fingerprint: 'a', playerSlug: 'p1' },
  { fingerprint: 'b', playerSlug: 'p2' }
]).length === 2);

const healed = validator.healPlayerRecord(
  {
    slug: 'heal-test',
    name: 'Heal Test',
    pos: 'WR',
    classYear: 2027,
    school: 'Florida twice this offseason',
    skinny: 'SERIOUS push for No.'
  },
  {
    slug: 'heal-test',
    name: 'Heal Test',
    pos: 'WR',
    classYear: 2027,
    school: 'Lake Dallas HS, TX',
    skinny: 'Valid skinny text for recruiting board display.'
  }
);
assert('healPlayerRecord preserves valid existing school', healed.school === 'Lake Dallas HS, TX');
assert('healPlayerRecord strips truncated skinny', !healed.skinny);

const partial = validator.classifyIdentityErrors(['invalid_school']);
assert('invalid_school is repairable not hard', partial.canWrite && partial.needsRepair);

assert('accepts Will Griffin as identity name', validator.isValidIdentityPlayerName('Will Griffin'));
assert('accepts T.J. Shanahan as identity name', validator.isValidIdentityPlayerName('T.J. Shanahan'));
assert('accepts Eric Singleton Jr. as identity name', validator.isValidIdentityPlayerName('Eric Singleton Jr.'));

const portalPlayer = validator.validatePlayerIdentityRecord({
  slug: 'eric-singleton-jr',
  name: 'Eric Singleton Jr.',
  pos: 'WR',
  classYear: 2026,
  school: 'Auburn',
  fromSchool: 'Auburn',
  category: 'portal'
});
assert('accepts portal player with college school', portalPlayer.valid);

if (process.exitCode) {
  console.error('\nIdentity record validator tests failed.');
} else {
  console.log('\nAll identity record validator tests passed.');
}
