const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { STAFF_DIRECTORY } = require('../../lib/recruiting-staff-directory');

/** floridagators.com 2026 coaching titles — footprint/directory must match. */
const EXPECTED = {
  sumrall: 'Head Coach',
  faulkner: 'Offensive Coordinator',
  white: 'Defensive Coordinator',
  chatman: 'Assistant Head Coach / DL',
  collins: 'Safeties Coach',
  craddock: 'Quarterbacks Coach',
  davis: 'Outside Wide Receivers Coach',
  foster: 'Running Backs Coach',
  galante: 'Special Teams Coordinator',
  gasparato: 'Linebackers Coach',
  hardmon: 'Outside Linebackers Coach',
  harris: 'Cornerbacks Coach',
  mckissack: 'Tight Ends Coach',
  mcknight: 'Passing Game Coordinator / WR',
  trautwein: 'Offensive Line Coach',
  whitt: 'Director of Football Performance',
  'chris-prescott': 'Director of Player Personnel',
};

describe('UF staff title accuracy', () => {
  it('matches official 2026 Sumrall staff roles', () => {
    for (const [id, role] of Object.entries(EXPECTED)) {
      assert.ok(STAFF_DIRECTORY[id], `missing staff id ${id}`);
      assert.equal(STAFF_DIRECTORY[id].role, role, `${id} role mismatch`);
    }
  });

  it('does not assign Brandon Harris as Director of Player Personnel', () => {
    assert.notEqual(STAFF_DIRECTORY.harris.role, 'Director of Player Personnel');
  });
});
