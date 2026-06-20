const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  STAFF_DIRECTORY,
  normalizeStaffId,
  resolveStaffById,
  listStaff,
} = require('../../lib/recruiting-staff-directory');

describe('recruiting-staff-directory', () => {
  it('includes recruiting personnel in STAFF_DIRECTORY', () => {
    assert.ok(STAFF_DIRECTORY.harris);
    assert.ok(STAFF_DIRECTORY['chris-prescott']);
    assert.ok(STAFF_DIRECTORY['drew-hughes']);
    assert.equal(STAFF_DIRECTORY.harris.role, 'Director of Player Personnel');
  });

  it('normalizeStaffId resolves aliases', () => {
    assert.equal(normalizeStaffId('prescott'), 'chris-prescott');
    assert.equal(normalizeStaffId('hughes'), 'drew-hughes');
    assert.equal(normalizeStaffId('harris'), 'harris');
  });

  it('resolveStaffById returns staff entry', () => {
    const entry = resolveStaffById('chris-prescott');
    assert.equal(entry?.name, 'Chris Prescott');
    assert.equal(entry?.staffId, 'chris-prescott');
  });

  it('listStaff returns all directory entries', () => {
    const staff = listStaff();
    assert.ok(staff.length >= 20);
    assert.ok(staff.some((s) => s.staffId === 'drew-hughes'));
  });
});
