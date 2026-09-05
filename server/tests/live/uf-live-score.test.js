const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  extractFloridaGame,
  buildStatusLine,
  toBettingOverlay,
  getUfLiveBoard,
} = require('../../lib/uf-live-score');

const liveBoard = {
  events: [
    {
      id: '401772001',
      competitions: [
        {
          competitors: [
            { team: { id: '57', displayName: 'Florida Gators', abbreviation: 'FLA' }, score: '28' },
            { team: { id: '2226', displayName: 'Florida Atlantic Owls', abbreviation: 'FAU' }, score: '7' },
          ],
          status: {
            displayClock: '8:32',
            period: 2,
            type: { name: 'STATUS_IN_PROGRESS', completed: false, detail: 'Q2 8:32' },
          },
        },
      ],
    },
  ],
};

describe('uf-live-score', () => {
  it('extracts score, clock, and period', () => {
    const game = extractFloridaGame(liveBoard);
    assert.equal(game.eventId, '401772001');
    assert.equal(game.ufScore, 28);
    assert.equal(game.oppScore, 7);
    assert.equal(game.clock, '8:32');
    assert.equal(game.period, 2);
    assert.equal(game.live, true);
    assert.match(game.opponent, /Atlantic|FAU/i);
  });

  it('builds a quarter clock status and iOS overlay', () => {
    const game = extractFloridaGame(liveBoard);
    assert.equal(buildStatusLine(game), '2nd quarter · 8:32');
    const overlay = toBettingOverlay(game);
    assert.equal(overlay.homeScore, 28);
    assert.equal(overlay.awayScore, 7);
    assert.equal(overlay.status, '2nd quarter · 8:32');
    assert.equal(overlay.scoreSource, 'espn');
  });

  it('returns a live-window board from a fixture without hitting ESPN', async () => {
    const out = await getUfLiveBoard({
      asOf: new Date('2026-09-05T23:50:00.000Z'),
      scoreboard: liveBoard,
    });
    assert.equal(out.ok, true);
    assert.equal(out.mode, 'live-window');
    assert.equal(out.board.ufScore, 28);
    assert.equal(out.board.status, '2nd quarter · 8:32');
    assert.equal(out.overlay.homeScore, 28);
  });

  it('stays ready outside the window and does not invent a board', async () => {
    const out = await getUfLiveBoard({ asOf: new Date('2026-09-04T16:00:00.000Z') });
    assert.equal(out.ok, true);
    assert.equal(out.mode, 'ready');
    assert.equal(out.board, null);
    assert.equal(out.overlay, null);
  });
});
