const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  collectPortalTargetCandidates,
  rankPortalTargets,
  isPortalTargetCandidate,
  looksLikePersonName,
} = require('../../lib/portal-target-finder');
const { runPortalTargetSweep } = require('../../lib/portal-target-sweep');
const { getFanPortalPrep } = require('../../lib/portal-fan-prep');

const ROOMS = [
  { room: 'OT', tier: 'must-add', rank: 1 },
  { room: 'S', tier: 'must-add', rank: 2 },
  { room: 'WR', tier: 'stable', rank: 8 },
];

test('rejects invented / HS / Florida-commit names', () => {
  assert.equal(looksLikePersonName('A verified OT'), false);
  assert.equal(
    isPortalTargetCandidate(
      { name: 'Some Recruit', category: 'recruit', school: 'IMG', position: 'OT', source: 'on3' },
      'OT'
    ),
    false
  );
  assert.equal(
    isPortalTargetCandidate(
      {
        name: 'Already Gator',
        category: 'portal',
        school: 'Georgia',
        committedTo: 'Florida',
        position: 'OT',
        source: 'on3',
      },
      'OT'
    ),
    false
  );
  assert.equal(
    isPortalTargetCandidate(
      { name: 'No School Guy', category: 'portal', position: 'OT', source: 'beat' },
      'OT'
    ),
    false
  );
});

test('On3 / beat college transfers that fill a hole rank by Buy score', () => {
  const candidates = collectPortalTargetCandidates({
    on3: [
      {
        name: 'Troy Tackle',
        position: 'OT',
        fromSchool: 'Troy',
        conference: 'Sun Belt',
        starts: 12,
        pffGrade: 82,
        yearsLeft: 2,
        source: 'on3',
      },
    ],
    intel: [
      {
        playerName: 'Range Safety',
        playerSlug: 'range-safety',
        pos: 'S',
        fromSchool: 'James Madison',
        conferenceTier: 'fcs',
        starts: 11,
        pffGrade: 86,
        yearsLeft: 2,
        triggerType: 'portal_elite',
        eventType: 'portal_in',
      },
    ],
    incoming: [],
  });
  const ranked = rankPortalTargets(candidates, ROOMS);
  assert.equal(ranked.get('OT').length, 1);
  assert.equal(ranked.get('OT')[0].name, 'Troy Tackle');
  assert.equal(ranked.get('OT')[0].productionPath, 'fcs-g5-pff');
  assert.equal(ranked.get('S')[0].name, 'Range Safety');
  assert.ok(ranked.get('S')[0].buyScore >= 32 + 24);
  assert.equal((ranked.get('WR') || []).length, 0);
});

test('hold-room names need production, not a random WR body', () => {
  const candidates = collectPortalTargetCandidates({
    on3: [
      {
        name: 'Depth Receiver',
        position: 'WR',
        fromSchool: 'App State',
        conference: 'Sun Belt',
        snapPct: 0.2,
        source: 'on3',
      },
    ],
  });
  const ranked = rankPortalTargets(candidates, ROOMS);
  assert.equal((ranked.get('WR') || []).length, 0);
});

test('sweep with empty sources does not invent names', async () => {
  const report = await runPortalTargetSweep({
    dryRun: true,
    skipOn3: true,
    incoming: [],
    intel: [],
    on3: [],
  });
  assert.equal(report.fanShip, false);
  assert.equal(report.targetCount, 0);
  assert.equal(report.targets.length, 0);
  const blob = JSON.stringify(report);
  assert.equal(blob.includes('namedCandidates'), false);
});

test('finder is wired into recruiting-light, ops, and the API', () => {
  const root = path.join(__dirname, '..', '..', '..');
  const cron = fs.readFileSync(path.join(root, 'server/scripts/render-recruiting-light-cron.js'), 'utf8');
  const ops = fs.readFileSync(path.join(root, 'server/lib/ops-jobs.js'), 'utf8');
  const routes = fs.readFileSync(path.join(root, 'server/lib/recruiting-routes.js'), 'utf8');
  const ui = fs.readFileSync(
    path.join(root, 'client/components/vault/recruiting/RecruitingPortalSection.tsx'),
    'utf8'
  );
  assert.match(cron, /portal-targets\/sweep/);
  assert.match(ops, /portal-target-sweep/);
  assert.match(routes, /portal-targets\/sweep/);
  assert.match(ui, /GatorVault scan/);
});

test('fan prep still does not ship research namedCandidates', () => {
  const prep = getFanPortalPrep(new Date('2026-11-25T18:00:00Z'));
  assert.equal(prep.fanShip, false);
  assert.equal('namedCandidates' in prep, false);
  for (const room of prep.rooms) {
    assert.ok(Array.isArray(room.scanTargets));
    assert.equal(room.scanTargets.length, 0);
  }
});
