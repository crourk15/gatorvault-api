const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getFanPortalPrep,
  getFanPortalPrepLive,
  chipName,
  portalGapFitsNeed,
} = require('../../lib/portal-fan-prep');
const { fanPortalCandidatesFromResearch } = require('../../lib/portal-winter-research');
const { getPortalBoard } = require('../../lib/recruiting-store');

const OUTGOING_DESK_NAMES = [
  'Kahleil Jackson',
  'Bryce Thornton',
  'Kamran James',
  'Jaden Robinson',
  'Emmanuel Oyebadejo',
  'Jordy Lowery',
  'Javion Toombs',
];

test('fan portal prep is the January 2027 war room without named candidates', () => {
  const prep = getFanPortalPrep(new Date('2026-11-25T18:00:00Z'));
  assert.equal(prep.fanShip, false);
  assert.equal(prep.status, 'prep');
  assert.equal(prep.window.opens, '2027-01-04');
  assert.equal(prep.window.closes, '2027-01-13');
  assert.equal(prep.window.label, 'January 4–13, 2027');
  assert.equal(prep.window.daysUntilOpen, 40);
  assert.equal(prep.season.phase, 'portal-prep');
  assert.equal(prep.thesis.addCount, '10–12 difference makers');
  assert.match(prep.thesis.not, /Not 30/);
  assert.equal(prep.incomingCount, 0);
  assert.equal(prep.rooms[0].room, 'OT');
  assert.equal(prep.rooms[0].tier, 'must-add');
  assert.deepEqual(prep.mustAdd, ['OT', 'S']);
  assert.ok(prep.rooms.length >= 8);
  assert.equal('namedCandidates' in prep, false);
  assert.equal('outgoingLikely' in prep, false);
  assert.equal('departingLikely' in prep, false);
  assert.equal(fanPortalCandidatesFromResearch().length, 0);

  const blob = JSON.stringify(prep);
  for (const name of OUTGOING_DESK_NAMES) {
    assert.equal(blob.includes(name), false, `fan prep leaked ${name}`);
  }
});

test('fan incoming portal board stays empty until Charles ships names', async () => {
  const board = await getPortalBoard();
  assert.equal(board.count, 0);
  assert.equal(board.incoming.length, 0);
});

test('portal-prep first-paint seed matches live fan rooms', async () => {
  const fs = require('fs');
  const path = require('path');
  const seedPath = path.join(__dirname, '../../../client/lib/portal-prep-seed.json');
  const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
  const prep = await getFanPortalPrepLive(new Date('2026-11-25T18:00:00Z'));
  assert.equal(seed.prep.fanShip, false);
  assert.deepEqual(
    seed.prep.rooms.map((row) => row.room),
    prep.rooms.map((row) => row.room)
  );
  assert.equal(seed.prep.window.opens, '2027-01-04');
});

test('live portal rooms show HS signed context, not remaining HS targets', async () => {
  const prep = await getFanPortalPrepLive(new Date('2026-11-25T18:00:00Z'));
  const byRoom = Object.fromEntries(prep.rooms.map((row) => [row.room, row]));
  const otNames = (byRoom.OT.alreadySigned || []).map(chipName);
  const iolNames = (byRoom.IOL.alreadySigned || []).map(chipName);
  const rbRecruiting = (byRoom.RB.stillRecruiting || []).map(chipName);
  const rbGaps = (byRoom.RB.gapFillers || []).map(chipName);
  assert.ok(otNames.includes('Elijah Hutcheson'));
  assert.ok(otNames.includes('Moreno Fisher'));
  assert.equal(otNames.includes('Maxwell Hiller'), false);
  assert.equal(otNames.includes('Peyton Miller'), false);
  assert.ok(iolNames.includes('Maxwell Hiller'));
  assert.ok(iolNames.includes('Peyton Miller'));
  assert.equal(rbRecruiting.includes('Tranard Roberts'), false);
  assert.equal(rbGaps.includes('Tranard Roberts'), false);
  assert.equal((byRoom.OT.gapFillers || []).length, 0);
  assert.equal(prep.incomingCount, 0);
  const blob = JSON.stringify(prep);
  for (const name of OUTGOING_DESK_NAMES) {
    assert.equal(blob.includes(name), false, `live prep leaked ${name}`);
  }
});

test('gap fillers must be portal players who fill that hole', () => {
  const fit = {
    category: 'portal',
    name: 'Sample Tackle',
    position: 'OT',
    school: 'Georgia',
  };
  assert.equal(portalGapFitsNeed(fit, 'OT'), true);
  assert.equal(portalGapFitsNeed({ ...fit, position: 'WR' }, 'OT'), false);
  assert.equal(portalGapFitsNeed({ ...fit, category: 'recruit' }, 'OT'), false);
  assert.equal(portalGapFitsNeed({ ...fit, committedTo: 'Florida' }, 'OT'), false);
  assert.equal(portalGapFitsNeed({ ...fit, school: '' }, 'OT'), false);
  assert.equal(
    portalGapFitsNeed(
      { category: 'recruit', name: 'Tranard Roberts', position: 'RB', school: 'IMG' },
      'RB'
    ),
    false
  );
});
