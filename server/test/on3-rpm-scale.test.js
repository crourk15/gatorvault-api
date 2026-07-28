/**
 * On3 RPM scale — Industry Consensus % must not be overtaken by residual fractions.
 * Repro: Ryan Peterson board (Georgia 17.6 / Florida 15.4) with shared 0.6887 residuals.
 * Run: node --test server/test/on3-rpm-scale.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  detectTopTeamsPctScale,
  normalizePredictionToPct,
  interestedSchoolsFromTopTeams,
  ufRpmFromTopTeams,
  schoolLadderDetailed
} = require('../lib/on3-board-hydrate');

function petersonLikeBoard() {
  const residual = 0.6887052341597797;
  return [
    { team: { name: 'Georgia' }, status: 'Offered', prediction: 17.630853994490362, year: 2028 },
    { team: { name: 'Florida' }, status: 'Offered', prediction: 15.426997245179063, year: 2028 },
    { team: { name: 'Alabama' }, status: 'Offered', prediction: 13.223140495867769, year: 2028 },
    { team: { name: 'Florida State' }, status: 'Offered', prediction: 7.575757575757576, year: 2028 },
    { team: { name: 'Ohio State' }, status: 'Offered', prediction: 4.132231404958678, year: 2028 },
    { team: { name: 'Penn State' }, status: 'Offered', prediction: residual, year: 2028 },
    { team: { name: 'Notre Dame' }, status: 'Offered', prediction: residual, year: 2028 },
    { team: { name: 'SMU' }, status: 'Offered', prediction: residual, year: 2028 },
    { team: { name: 'Ole Miss' }, status: 'Offered', prediction: residual, year: 2028 },
    { team: { name: 'Auburn' }, status: 'Offered', prediction: residual, year: 2028 }
  ];
}

describe('On3 RPM scale detection', () => {
  it('treats mixed Industry Consensus boards as percent-scale', () => {
    assert.equal(detectTopTeamsPctScale(petersonLikeBoard()), 'percent');
  });

  it('does not multiply residual fractions into fake 69% on percent-scale boards', () => {
    assert.ok(normalizePredictionToPct(0.6887052341597797, 'percent') < 2);
    assert.ok(Math.abs(normalizePredictionToPct(15.426997245179063, 'percent') - 15.426997245179063) < 1e-9);
  });

  it('still supports pure fraction boards', () => {
    assert.equal(detectTopTeamsPctScale([{ prediction: 0.36 }, { prediction: 0.22 }]), 'fraction');
    assert.equal(normalizePredictionToPct(0.36, 'fraction'), 36);
  });
});

describe('Ryan Peterson ladder regression', () => {
  it('ranks Georgia / Florida / Alabama ahead of residual schools', () => {
    const ladder = interestedSchoolsFromTopTeams(petersonLikeBoard(), 2028, 8);
    assert.equal(ladder[0].school, 'Georgia');
    assert.ok(ladder[0].pct > 17 && ladder[0].pct < 18);
    assert.equal(ladder[1].school, 'Florida');
    assert.ok(ladder[1].pct > 15 && ladder[1].pct < 16);
    assert.equal(ladder[2].school, 'Alabama');
    assert.ok(!/Penn State|Notre Dame|SMU|Ole Miss|Auburn/i.test(ladder.slice(0, 5).map((s) => s.school).join(',')));
    assert.ok(!ladder.some((s) => /RPM ~69%/.test(s.label)));
    assert.ok(/RPM ~18%|RPM ~17%/.test(ladder[0].label), ladder[0].label);
  });

  it('reports UF RPM near On3 Industry Consensus 15.4%', () => {
    const uf = ufRpmFromTopTeams(petersonLikeBoard(), 2028);
    assert.ok(uf > 15 && uf < 16, String(uf));
  });

  it('school ladder detail labels follow the same order', () => {
    const detailed = schoolLadderDetailed(petersonLikeBoard(), 2028, 5);
    assert.equal(detailed[0].school, 'Georgia');
    assert.equal(detailed[1].school, 'Florida');
    assert.ok(!/RPM ~69%/.test(detailed.map((s) => s.detail).join('; ')));
  });
});
