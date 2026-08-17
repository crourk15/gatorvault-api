'use strict';
/**
 * Gabriel Player: On3 percent-board Florida crumb 0.80 must never become Field 80%.
 * Run: node --import tsx --test server/test/gabriel-field-rpm-poison.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  detectTopTeamsPctScale,
  teamPct,
  ufRpmFromTopTeams,
} = require('../lib/on3-board-hydrate');

const GABRIEL_TEAMS = [
  { team: { name: 'Miami' }, prediction: 93.98302660436731 },
  { team: { name: 'Florida' }, prediction: 0.8009917040144939 },
  { team: { name: 'Ohio State' }, prediction: 0.6865643177267092 },
  { team: { name: 'Texas' }, prediction: 0.5721369314389243 },
];

describe('Gabriel percent-board Florida crumb', () => {
  it('detects percent scale (Miami ~94, not fraction)', () => {
    assert.equal(detectTopTeamsPctScale(GABRIEL_TEAMS), 'percent');
  });

  it('teamPct keeps Florida at ~0.8, never ×100 → 80', () => {
    const fl = GABRIEL_TEAMS.find((t) => /florida/i.test(t.team.name));
    const pct = teamPct(fl, 'percent');
    assert.ok(pct != null && pct < 2, `pct=${pct}`);
    assert.ok(pct > 0.5, `pct=${pct}`);
  });

  it('ufRpmFromTopTeams returns null at default floor (not 80)', () => {
    const rpm = ufRpmFromTopTeams(GABRIEL_TEAMS, 2028, { minPct: 2.5 });
    assert.equal(rpm, null);
  });

  it('soft floor still stays under 2% (never 80)', () => {
    const soft = ufRpmFromTopTeams(GABRIEL_TEAMS, 2028, { minPct: 0.5 });
    assert.ok(soft == null || soft < 2, `soft=${soft}`);
  });
});
