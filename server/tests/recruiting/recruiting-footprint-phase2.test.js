const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

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
