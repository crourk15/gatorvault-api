const test = require('node:test');
const assert = require('node:assert/strict');
const {
  loadWinter2027PortalResearch,
  fanPortalCandidatesFromResearch,
} = require('../../lib/portal-winter-research');
const { getPortalBoard } = require('../../lib/recruiting-store');
const {
  getPortalSeasonState,
  shouldRunPortalIntelJob,
} = require('../../lib/recruiting-cycle.ts');

test('winter 2027 portal research stays desk-only', () => {
  const research = loadWinter2027PortalResearch();
  assert.equal(research.fanShip, false);
  assert.equal(research.status, 'desk-only');
  assert.equal(research.window.opens, '2027-01-04');
  assert.equal(research.window.closes, '2027-01-13');
  assert.equal(research.window.noDecemberWindow, true);
  assert.equal(research.window.noSpringFootballWindow, true);
  assert.equal(research.staffThesis.addCount, '10-12 difference makers');
  assert.ok(research.needs.length >= 4);
  assert.equal(research.needs[0].room, 'OT');
  assert.deepEqual(research.namedCandidates, []);
  assert.equal(fanPortalCandidatesFromResearch().length, 0);
});

test('fan incoming portal board is still empty', async () => {
  const board = await getPortalBoard();
  assert.equal(board.count, 0);
  assert.equal(board.incoming.length, 0);
});

test('NCAA football window is January 4-13 2027, not December', () => {
  const nov20 = getPortalSeasonState(new Date('2026-11-20T18:00:00Z'));
  assert.equal(nov20.active, false);
  assert.equal(nov20.phase, 'portal-prep');
  assert.equal(nov20.nextWindowStart, '2027-01-04');

  const dec5 = getPortalSeasonState(new Date('2026-12-05T12:00:00Z'));
  assert.equal(dec5.active, false);
  assert.equal(dec5.phase, 'portal-prep');
  assert.equal(dec5.nextWindowStart, '2027-01-04');
  assert.equal(shouldRunPortalIntelJob(new Date('2026-12-05T12:00:00Z')), false);

  const jan4 = getPortalSeasonState(new Date('2027-01-04T12:00:00Z'));
  assert.equal(jan4.active, true);
  assert.equal(jan4.phase, 'portal-winter');
  assert.equal(shouldRunPortalIntelJob(new Date('2027-01-04T12:00:00Z')), true);

  const jan13 = getPortalSeasonState(new Date('2027-01-13T12:00:00Z'));
  assert.equal(jan13.active, true);

  const jan14 = getPortalSeasonState(new Date('2027-01-14T12:00:00Z'));
  assert.equal(jan14.active, false);
  assert.notEqual(jan14.phase, 'portal-winter');

  const april = getPortalSeasonState(new Date('2027-04-20T12:00:00Z'));
  assert.equal(april.active, false);
  assert.equal(shouldRunPortalIntelJob(new Date('2027-04-20T12:00:00Z')), false);
});
