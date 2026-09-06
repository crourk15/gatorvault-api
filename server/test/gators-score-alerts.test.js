'use strict';
const assert = require('assert');
const { describe, it } = require('node:test');
const { planScoreAlerts, classifyScoreDelta } = require('../lib/gators-score-alerts');

describe('gators-score-alerts beats', () => {
  it('classifies Gators TD / FG and skips extra points', () => {
    assert.equal(classifyScoreDelta(7, 0, 'FAU').title, 'Gators touchdown');
    assert.equal(classifyScoreDelta(3, 0, 'FAU').title, 'Gators field goal');
    assert.equal(classifyScoreDelta(1, 0, 'FAU'), null);
    assert.equal(classifyScoreDelta(0, 6, 'Campbell Camels').title, 'Campbell touchdown');
  });

  it('plans kickoff then a live score then halftime then final', () => {
    const kick = planScoreAlerts(
      { eventId: 'e1', opponent: 'FAU Owls', state: 'in_progress', ufScore: 0, oppScore: 0, period: 1, clock: '15:00' },
      {},
    );
    assert.deepEqual(kick.map((b) => b.kind), ['kickoff']);

    const td = planScoreAlerts(
      { eventId: 'e1', opponent: 'FAU Owls', state: 'in_progress', ufScore: 7, oppScore: 0, period: 1, clock: '10:12' },
      { kickoffSent: true, lastScores: { uf: 0, opp: 0 } },
    );
    assert.equal(td.length, 1);
    assert.equal(td[0].kind, 'score');
    assert.equal(td[0].title, 'Gators touchdown');
    assert.match(td[0].detail, /Florida 7 · FAU 0/);
    assert.match(td[0].detail, /1st 10:12/);

    const half = planScoreAlerts(
      { eventId: 'e1', opponent: 'FAU Owls', state: 'halftime', detail: 'Halftime', ufScore: 24, oppScore: 7, period: 2 },
      { kickoffSent: true, lastScores: { uf: 24, opp: 7 }, lastScoreAlert: '24-7' },
    );
    assert.equal(half.length, 1);
    assert.equal(half[0].kind, 'halftime');

    const fin = planScoreAlerts(
      { eventId: 'e1', opponent: 'FAU Owls', state: 'final', completed: true, ufScore: 66, oppScore: 21 },
      { kickoffSent: true, halftimeSent: true, lastScores: { uf: 66, opp: 21 }, lastScoreAlert: '66-21' },
    );
    assert.equal(fin.length, 1);
    assert.equal(fin[0].kind, 'final');
    assert.match(fin[0].detail, /66/);
  });

  it('does not re-alert the same scoreline', () => {
    const again = planScoreAlerts(
      { eventId: 'e1', opponent: 'FAU', state: 'in_progress', ufScore: 14, oppScore: 7 },
      { kickoffSent: true, lastScores: { uf: 14, opp: 7 }, lastScoreAlert: '14-7' },
    );
    assert.deepEqual(again, []);
  });
});
