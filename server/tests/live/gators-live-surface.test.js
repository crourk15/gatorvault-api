'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  gatorsLivePhase,
  gatorsLiveVoice,
  possessionSide,
  periodClockLabel,
  pickCommunityTalkThread,
  gatorsLivePollMs,
} = require('../../lib/gators-live-surface');

describe('gators live surface helpers', () => {
  it('maps board state to living-room phases', () => {
    assert.equal(gatorsLivePhase({ mode: 'ready' }), 'ready');
    assert.equal(gatorsLivePhase({ mode: 'live-window', status: 'Scheduled' }), 'pregame');
    assert.equal(gatorsLivePhase({ mode: 'live-window', live: true, status: '2nd quarter · 8:32' }), 'live');
    assert.equal(gatorsLivePhase({ mode: 'live-window', live: true, status: 'Halftime' }), 'halftime');
    assert.equal(gatorsLivePhase({ mode: 'live-window', completed: true, status: 'Final' }), 'final');
  });

  it('reads Florida possession without treating FAU/FSU as UF', () => {
    assert.equal(possessionSide('57'), 'uf');
    assert.equal(possessionSide('Florida Gators'), 'uf');
    assert.equal(possessionSide('2226'), 'opp');
    assert.equal(possessionSide('Florida Atlantic'), 'opp');
    assert.equal(possessionSide('Florida State'), 'opp');
    assert.equal(possessionSide(null), null);
  });

  it('builds a broadcast clock and game-day voice', () => {
    assert.equal(
      periodClockLabel({ phase: 'live', period: 2, clock: '8:32' }),
      '2nd · 8:32',
    );
    assert.equal(periodClockLabel({ phase: 'final' }), 'Final');
    assert.match(gatorsLiveVoice('live', 'FAU Owls'), /on the field vs FAU Owls/);
    assert.match(gatorsLiveVoice('ready', 'Campbell Camels'), /Next: Florida vs Campbell Camels/);
  });

  it('polls live at 10s and stays at 15s off the field', () => {
    assert.equal(gatorsLivePollMs('live'), 10_000);
    assert.equal(gatorsLivePollMs('halftime'), 10_000);
    assert.equal(gatorsLivePollMs('pregame'), 15_000);
    assert.equal(gatorsLivePollMs('ready'), 15_000);
    assert.equal(gatorsLivePollMs('final'), 15_000);
  });

  it('prefers game-day talk over a generic daily open', () => {
    const picked = pickCommunityTalkThread([
      { title: 'Daily open: what moved the board?', dailyKey: '2026-09-05' },
      { title: 'Game day talk: Florida vs FAU', gameday: true, dailyKey: '2026-09-05' },
    ]);
    assert.match(picked.title, /Game day talk/);
  });
});
