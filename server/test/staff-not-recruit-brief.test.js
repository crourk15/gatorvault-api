/**
 * Staff/coaches must not open as recruit Copy Briefs.
 * Run: node server/test/staff-not-recruit-brief.test.js
 */
const assert = require('assert');
const { buildBeatBrief } = require('../lib/beat-brief-packet');
const { ufStaffFromTopTeams } = require('../lib/on3-board-hydrate');

async function main() {
  const brief = await buildBeatBrief('joe-craddock', { full: false, hydrateFilm: false });
  assert.strictEqual(brief.ok, false, JSON.stringify(brief));
  assert.strictEqual(brief.error, 'staff_not_recruit');
  assert.match(String(brief.message || ''), /Quarterbacks Coach|not a recruit/i);

  const staff = ufStaffFromTopTeams(
    [{ team: { name: 'Florida' }, status: 'Committed', coaches: [{ name: 'Joe Craddock' }] }],
    2027
  );
  assert.ok(staff?.label);
  assert.match(staff.label, /Joe Craddock/);
  assert.ok(!/\(Committed\)/i.test(staff.label), staff.label);

  console.log('staff-not-recruit-brief: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
