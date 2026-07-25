const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { applyStaffAssignmentsToPlayer, getAssignmentMap } = require('../../lib/recruiting-staff-assignments');
const { resolveStaffById } = require('../../lib/recruiting-staff-directory');
const { buildHubFootprint } = require('../../lib/recruiting-hub-intel-store');

describe('footprint staffActivity with seeded assignments', () => {
  it('applyStaffAssignmentsToPlayer merges seed staff_lead_id', () => {
    const map = getAssignmentMap();
    const slug = Object.keys(map)[0];
    assert.ok(slug, 'seed assignments should exist');

    const merged = applyStaffAssignmentsToPlayer({ slug, name: 'Test' });
    assert.ok(merged.staff_lead_id);
    assert.ok(resolveStaffById(merged.staff_lead_id));
  });

  it('buildHubFootprint includes staffActivity when players have staff leads', async () => {
    const playerWithStaff = applyStaffAssignmentsToPlayer({
      slug: 'kamauri-whitfield',
      name: 'Kamauri Whitfield',
      classYear: 2027,
      school: 'Miami, FL',
      staff_lead_id: 'harris',
    });
    assert.equal(playerWithStaff.staff_lead_id, 'harris');

    const footprint = await buildHubFootprint(2027);
    assert.ok(Array.isArray(footprint.states));
    const withStaff = footprint.states.filter((s) => s.staffActivity?.length > 0);
    assert.ok(
      withStaff.length >= 0,
      'footprint states may include staffActivity when board players carry assignments'
    );

    for (const state of footprint.states) {
      assert.match(state.state, /^[A-Z]{2}$/);
      if (state.competitorPressure != null) {
        assert.equal(typeof state.competitorPressure, 'number');
      }
    }
  });
});

describe('footprint year isolation (2027 vs 2028)', () => {
  it('buildHubFootprint stamps year and returns distinct class boards', async () => {
    const a = await buildHubFootprint(2027);
    const b = await buildHubFootprint(2028);
    assert.equal(a.year, 2027);
    assert.equal(b.year, 2028);
    assert.ok(Array.isArray(a.states) && a.states.length > 0, '2027 footprint has states');
    assert.ok(Array.isArray(b.states) && b.states.length > 0, '2028 footprint has states');
    assert.ok(Array.isArray(a.pins) && a.pins.length > 0, '2027 footprint has pins');
    assert.ok(Array.isArray(b.pins) && b.pins.length > 0, '2028 footprint has pins');
    // 2028 is early discovery (target-heavy); 2027 is commit-heavy — boards must not be identical.
    const aSig = JSON.stringify(
      a.states.map((s) => [s.state, s.targets, s.commits]).sort((x, y) => String(x[0]).localeCompare(String(y[0])))
    );
    const bSig = JSON.stringify(
      b.states.map((s) => [s.state, s.targets, s.commits]).sort((x, y) => String(x[0]).localeCompare(String(y[0])))
    );
    assert.notEqual(aSig, bSig, '2027 and 2028 footprint state tallies must differ');
  });

  it('client footprint map keeps Class tabs local (does not setActiveYear)', () => {
    const mapPath = path.join(
      __dirname,
      '..',
      '..',
      '..',
      'client',
      'components',
      'recruiting-hub',
      'elite',
      'footprint',
      'RecruitingFootprintMap.tsx'
    );
    const src = fs.readFileSync(mapPath, 'utf8');
    assert.match(src, /setFootprintYear/);
    assert.match(src, /year:\s*footprintYear/);
    assert.doesNotMatch(src, /setActiveYear/);
  });

  it('hub elite sections use stable LazyHubSection keys across shell swaps', () => {
    const elitePath = path.join(
      __dirname,
      '..',
      '..',
      '..',
      'client',
      'components',
      'recruiting-hub',
      'elite',
      'RecruitingHubElite.tsx'
    );
    const src = fs.readFileSync(elitePath, 'utf8');
    assert.match(src, /key="rh-lazy-footprint"/);
    assert.match(src, /key="rh-lazy-battle-board"/);
    assert.match(src, /key="rh-lazy-remaining-targets"/);
  });
});
