import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEFAULT_ALERT_PREFS, applyServerAlertPrefs } from './alert-prefs';

describe('alert-prefs server merge', () => {
  it('reads Daily / Weekly back from the server without wiping Visits on push-only', () => {
    const local = {
      ...DEFAULT_ALERT_PREFS,
      method: 'both' as const,
      freq: 'instant' as const,
      types: { ...DEFAULT_ALERT_PREFS.types, visit: true },
    };
    const daily = applyServerAlertPrefs(local, {
      method: 'email',
      freq: 'daily',
      visit: true,
      followPlayers: ['Easton Royal'],
    });
    assert.equal(daily.method, 'email');
    assert.equal(daily.freq, 'daily');
    assert.equal(daily.types.visit, true);
    assert.deepEqual(daily.followPlayers, ['Easton Royal']);

    const pushOnly = applyServerAlertPrefs(
      { ...DEFAULT_ALERT_PREFS, types: { ...DEFAULT_ALERT_PREFS.types, visit: true } },
      { method: 'push', freq: 'instant', visit: false, followPlayers: [] }
    );
    assert.equal(pushOnly.method, 'push');
    assert.equal(pushOnly.types.visit, true);
  });

  it('turns Visits off when the server email pref is off on Both', () => {
    const next = applyServerAlertPrefs(DEFAULT_ALERT_PREFS, {
      method: 'both',
      freq: 'weekly',
      visit: false,
    });
    assert.equal(next.types.visit, false);
    assert.equal(next.freq, 'weekly');
  });
});
