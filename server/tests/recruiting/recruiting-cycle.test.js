const test = require('node:test');
const assert = require('node:assert/strict');
const { getPortalSeasonState, shouldShowPortalWatchlist, shouldRunPortalIntelJob } = require('../../lib/recruiting-cycle.ts');

test('June is offseason before January football portal', () => {
  const state = getPortalSeasonState(new Date('2026-06-22T12:00:00Z'));
  assert.equal(state.active, false);
  assert.equal(state.phase, 'offseason');
  assert.equal(state.nextWindowStart, '2027-01-04');
});

test('December is portal-prep — NCAA football window is January', () => {
  const state = getPortalSeasonState(new Date('2026-12-05T12:00:00Z'));
  assert.equal(state.active, false);
  assert.equal(state.phase, 'portal-prep');
  assert.equal(state.nextWindowStart, '2027-01-04');
});

test('shows portal UI when enough live candidates exist off-season', () => {
  const state = getPortalSeasonState(new Date('2026-09-01T12:00:00Z'));
  assert.equal(shouldShowPortalWatchlist(state, 2), false);
  assert.equal(shouldShowPortalWatchlist(state, 3), true);
});

test('portal intel job runs only during the January football window', () => {
  assert.equal(shouldRunPortalIntelJob(new Date('2026-06-22T12:00:00Z')), false);
  assert.equal(shouldRunPortalIntelJob(new Date('2026-12-05T12:00:00Z')), false);
  assert.equal(shouldRunPortalIntelJob(new Date('2027-01-04T12:00:00Z')), true);
  assert.equal(shouldRunPortalIntelJob(new Date('2027-01-13T12:00:00Z')), true);
  assert.equal(shouldRunPortalIntelJob(new Date('2027-04-20T12:00:00Z')), false);
});
