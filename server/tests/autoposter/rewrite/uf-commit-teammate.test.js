const test = require('node:test');
const assert = require('node:assert/strict');

const {
  resolveUfCommitTeammate,
  schoolsAreTeammates,
  beatHasUfCommitTeammateSignal
} = require('../../../lib/autoposter/rewrite/uf-commit-teammate');

const THOMAS_BEAT =
  "Florida is making 2028 4-star EDGE Antonio Thomas Jr. a priority early on, and the interest is certainly mutual. Not to mention, he's teammates with a current Florida commit.";

const KENDRICK_NAME = "De'Voun Kendrick";

const MOCK_ROSTER = [
  {
    slug: 'antonio-thomas-jr',
    name: 'Antonio Thomas Jr.',
    school: 'Carrollwood Day (Tampa, FL)',
    status: 'uncommitted'
  },
  {
    slug: 'devoun-kendrick',
    name: KENDRICK_NAME,
    school: 'Tampa, FL',
    status: 'committed',
    committedTo: 'Florida'
  },
  {
    slug: 'other-gator',
    name: 'Other Gator',
    school: 'Miami, FL',
    status: 'committed',
    committedTo: 'Florida'
  }
];

test('beatHasUfCommitTeammateSignal detects teammate clause', () => {
  assert.equal(beatHasUfCommitTeammateSignal(THOMAS_BEAT), true);
  assert.equal(beatHasUfCommitTeammateSignal('Florida is on his radar.'), false);
});

test('schoolsAreTeammates matches HS + city to city-only roster row', () => {
  assert.equal(
    schoolsAreTeammates('Carrollwood Day (Tampa, FL)', 'Tampa, FL'),
    true
  );
  assert.equal(schoolsAreTeammates('Miami Central (Miami, FL)', 'Tampa, FL'), false);
});

test('resolveUfCommitTeammate names Kendrick for Thomas at Carrollwood Day', () => {
  const match = resolveUfCommitTeammate({
    slug: 'antonio-thomas-jr',
    playerRow: { school: 'Carrollwood Day (Tampa, FL)' },
    beatText: THOMAS_BEAT,
    roster: MOCK_ROSTER
  });
  assert.deepEqual(match, { name: KENDRICK_NAME, slug: 'devoun-kendrick' });
});

test('resolveUfCommitTeammate returns null without subject school', () => {
  const match = resolveUfCommitTeammate({
    slug: 'antonio-thomas-jr',
    playerRow: { state: 'FL' },
    beatText: THOMAS_BEAT,
    roster: MOCK_ROSTER
  });
  assert.equal(match, null);
});

test('resolveUfCommitTeammate disambiguates shared city via adjacent class year', () => {
  const roster = [
    {
      slug: 'antonio-thomas-jr',
      name: 'Antonio Thomas Jr.',
      school: 'Carrollwood Day (Tampa, FL)',
      classYear: 2028,
      status: 'uncommitted'
    },
    {
      slug: 'devoun-kendrick',
      name: KENDRICK_NAME,
      school: 'Tampa, FL',
      classYear: 2027,
      status: 'committed',
      committedTo: 'Florida'
    },
    {
      slug: 'eric-parks',
      name: 'Eric Parks',
      school: 'Tampa, FL',
      classYear: 2026,
      status: 'committed',
      committedTo: 'Florida'
    }
  ];
  const match = resolveUfCommitTeammate({
    slug: 'antonio-thomas-jr',
    playerRow: { school: 'Carrollwood Day (Tampa, FL)', classYear: 2028 },
    beatText: THOMAS_BEAT,
    roster
  });
  assert.deepEqual(match, { name: KENDRICK_NAME, slug: 'devoun-kendrick' });
});
