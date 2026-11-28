const test = require('node:test');
const assert = require('node:assert/strict');
const {
  computePortalBuyScore,
  conferenceTier,
} = require('../../lib/portal-buy-score');

test('P4 starter snaps score as year-1 starter, not the FCS lane', () => {
  const row = computePortalBuyScore(
    {
      conference: 'SEC',
      snapPct: 0.82,
      starts: 12,
      yearsLeft: 2,
    },
    { roomTier: 'must-add', room: 'OT' }
  );
  assert.equal(row.conferenceTier, 'p4');
  assert.equal(row.productionPath, 'p4-starter');
  assert.equal(row.pts.year1Starter, 25);
  assert.equal(row.pts.nonPowerProduction, 0);
  assert.equal(row.pts.depthBody, 0);
  assert.ok(row.buyScore >= 32 + 25);
});

test('FCS high production with a good PFF grade scores real buy points', () => {
  const row = computePortalBuyScore(
    {
      conferenceTier: 'fcs',
      snapPct: 0.88,
      starts: 11,
      pffGrade: 86,
      yearsLeft: 2,
    },
    { roomTier: 'must-add', room: 'OT' }
  );
  assert.equal(row.conferenceTier, 'fcs');
  assert.equal(row.productionPath, 'fcs-g5-pff');
  assert.equal(row.pts.year1Starter, 0);
  assert.equal(row.pts.nonPowerProduction, 24);
  assert.equal(row.pts.depthBody, 0);
  assert.ok(row.buyScore >= 32 + 24);
});

test('G5 high production with PFF 80+ also gets the non-power lane', () => {
  const row = computePortalBuyScore(
    {
      conference: 'Sun Belt',
      starts: 12,
      pffGrade: 81,
      yearsLeft: 2,
    },
    { roomTier: 'high', room: 'S' }
  );
  assert.equal(row.conferenceTier, 'g5');
  assert.equal(row.pts.nonPowerProduction, 20);
  assert.equal(row.pts.depthBody, 0);
});

test('FCS high production without a PFF grade does not get buy points', () => {
  const row = computePortalBuyScore(
    {
      conferenceTier: 'fcs',
      snapPct: 0.9,
      starts: 12,
      yearsLeft: 2,
    },
    { roomTier: 'must-add', room: 'OT' }
  );
  assert.equal(row.pts.nonPowerProduction, 0);
  assert.equal(row.productionPath, 'none');
  assert.ok(row.pts.depthBody > 0);
});

test('good PFF without high production does not get the FCS lane', () => {
  const row = computePortalBuyScore(
    {
      conferenceTier: 'fcs',
      snapPct: 0.22,
      starts: 2,
      pffGrade: 88,
      yearsLeft: 2,
    },
    { roomTier: 'must-add', room: 'CB' }
  );
  assert.equal(row.highProduction, false);
  assert.equal(row.pts.nonPowerProduction, 0);
});

test('PFF 75–79 is good, not elite, and still scores', () => {
  const row = computePortalBuyScore(
    {
      conferenceTier: 'fcs',
      production: 'high',
      pffGrade: 76,
    },
    { roomTier: 'high', room: 'CB' }
  );
  assert.equal(row.pts.nonPowerProduction, 14);
});

test('FCS elite PFF can sit next to a P4 starter in the same hole', () => {
  const p4 = computePortalBuyScore(
    { conference: 'ACC', starts: 10, yearsLeft: 2 },
    { roomTier: 'must-add', room: 'OT' }
  );
  const fcs = computePortalBuyScore(
    { conferenceTier: 'fcs', starts: 12, pffGrade: 87, yearsLeft: 2 },
    { roomTier: 'must-add', room: 'OT' }
  );
  const gap = p4.buyScore - fcs.buyScore;
  assert.ok(gap >= 0, 'P4 starter keeps a slight edge');
  assert.ok(gap <= 4, `FCS + PFF should be close, gap was ${gap}`);
});

test('must-add OT still beats a hold-room FCS star', () => {
  const ot = computePortalBuyScore(
    { conference: 'Big Ten', starts: 9, yearsLeft: 2 },
    { roomTier: 'must-add', room: 'OT' }
  );
  const wr = computePortalBuyScore(
    { conferenceTier: 'fcs', starts: 12, pffGrade: 90, yearsLeft: 3 },
    { roomTier: 'stable', room: 'WR' }
  );
  assert.ok(ot.buyScore > wr.buyScore, 'hole weight beats a hold-room dude');
});

test('conferenceTier maps Notre Dame to P4 and CAA-style FCS flags', () => {
  assert.equal(conferenceTier({ school: 'Notre Dame' }), 'p4');
  assert.equal(conferenceTier({ conference: 'SEC' }), 'p4');
  assert.equal(conferenceTier({ conferenceTier: 'fcs' }), 'fcs');
  assert.equal(conferenceTier({ conference: 'MAC' }), 'g5');
});
