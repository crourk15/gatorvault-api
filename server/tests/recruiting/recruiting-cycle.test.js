const test = require('node:test');
const assert = require('node:assert/strict');
const { getPortalSeasonState, shouldShowPortalWatchlist, shouldRunPortalIntelJob } = require('../../lib/recruiting-cycle.ts');

test('June is offseason before December portal', () => {
  const state = getPortalSeasonState(new Date('2026-06-22T12:00:00Z'));
  assert.equal(state.active, false);
  assert.equal(state.phase, 'offseason');
  assert.equal(state.nextWindowStart, '2026-12-01');
});

test('December is active winter portal', () => {
  const state = getPortalSeasonState(new Date('2026-12-05T12:00:00Z'));
  assert.equal(state.active, true);
  assert.equal(state.phase, 'portal-winter');
});

test('shows portal UI when enough live candidates exist off-season', () => {
  const state = getPortalSeasonState(new Date('2026-09-01T12:00:00Z'));
  assert.equal(shouldShowPortalWatchlist(state, 2), false);
  assert.equal(shouldShowPortalWatchlist(state, 3), true);
});

test('portal intel job runs only during active portal windows', () => {
  assert.equal(shouldRunPortalIntelJob(new Date('2026-06-22T12:00:00Z')), false);
  assert.equal(shouldRunPortalIntelJob(new Date('2026-12-05T12:00:00Z')), true);
  assert.equal(shouldRunPortalIntelJob(new Date('2026-04-20T12:00:00Z')), true);
});