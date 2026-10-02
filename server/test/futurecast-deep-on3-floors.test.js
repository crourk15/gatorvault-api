/**
 * 2028 On3 board truth from the 10/2 deep audit.
 * Run: node --import tsx --test server/test/futurecast-deep-on3-floors.test.js
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const floors = require('../data/futurecast/hp-heal-floors-2028.json').floors;
const players = require('../data/recruiting/players.json');
const { explainEliteChaseProfile } = require('../lib/elite-chase-profile-bar');
const {
  resolveUncommittedMarketRpm,
  resolveGatorVaultLikelihood,
} = require('../lib/uf-probability-utils');

function bySlug(slug) {
  return (Array.isArray(players) ? players : []).find((p) => p.slug === slug);
}

describe('2028 On3 deep-audit floors', () => {
  it('stamps Antonio Thomas Jr. Florida 94 / Miami 1', () => {
    const p = bySlug('antonio-thomas-jr');
    assert.ok(p);
    assert.ok(Number(p.ufRpmPct) >= 90, `git rpm ${p.ufRpmPct}`);
    const floor = floors['antonio-thomas-jr'];
    assert.equal(floor.boardRpm, 94);
    const miami = (p.competitors || []).find((c) => /miami/i.test(c.school));
    assert.ok(miami);
    assert.ok(Number(miami.pct) < 5, `miami ${miami.pct}`);
  });

  it('stamps Jaxon Flowers Florida 72 / Miami 24', () => {
    const p = bySlug('jaxon-flowers');
    assert.equal(Number(p.ufRpmPct), 72);
    assert.equal(floors['jaxon-flowers'].boardRpm, 72);
    const miami = (p.competitors || []).find((c) => /miami/i.test(c.school));
    assert.ok(miami);
    assert.ok(Number(miami.pct) >= 20);
  });

  it("stamps John O'Dwyer Florida 76 so Closest can see him", () => {
    const p = bySlug('john-odwyer');
    assert.equal(Number(p.ufRpmPct), 76);
    assert.ok(Number(p.stars) >= 3);
    assert.equal(floors['john-odwyer'].boardRpm, 76);
    const e = explainEliteChaseProfile({
      slug: 'john-odwyer',
      stars: 3,
      school: p.school,
      ufRpmPct: 76,
    });
    assert.equal(e.ok, true, e.reasons.join(','));
  });

  it('heals Tromon Isaac poison 80 down to Miami-led residual', () => {
    const p = bySlug('tromon-isaac');
    assert.ok(Number(p.ufRpmPct) < 10, `still poisoned ${p.ufRpmPct}`);
    assert.equal(floors['tromon-isaac'].boardRpm, 2);
    const miami = (p.competitors || []).find((c) => /miami/i.test(c.school));
    assert.ok(miami);
    assert.ok(Number(miami.pct) >= 90);
  });

  it('keeps corroborated Vickers 96 as Lab Florida chance', () => {
    const locked = resolveUncommittedMarketRpm({
      rpmPct: 96,
      committed: false,
      topTeams: [
        { team: { name: 'Florida' }, status: 'Offered', prediction: 95.7, year: 2028 },
        { team: { name: 'Clemson' }, status: 'Offered', prediction: 1.4, year: 2028 },
      ],
      classYear: 2028,
    });
    assert.equal(locked, 96);
    const gv = resolveGatorVaultLikelihood({ rpmPct: locked, fitScore: 73 });
    assert.ok(gv.value >= 84, `gv ${gv.value}`);
  });
});
