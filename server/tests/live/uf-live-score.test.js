const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  extractFloridaGame,
  buildStatusLine,
  toBettingOverlay,
  getUfLiveBoard,
  isFloridaGatorsTeam,
  espnScoreboardUrl,
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
          situation: { possession: '57' },
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
    assert.equal(game.possession, '57');
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
    assert.equal(out.board.possession, '57');
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

  it('pins ESPN to the featured kickoff date so Saturday is not dropped after midnight', () => {
    const url = espnScoreboardUrl(new Date('2026-09-20T04:10:00.000Z'), {
      kickoffIso: '2026-09-19T23:00:00.000Z',
    });
    assert.match(url, /dates=20260919/);
    assert.match(url, /groups=80/);
  });

  it('does not treat Florida State or FAU as the Gators', () => {
    assert.equal(isFloridaGatorsTeam({ id: '52', abbreviation: 'FSU', displayName: 'Florida State Seminoles' }), false);
    assert.equal(isFloridaGatorsTeam({ id: '2226', abbreviation: 'FAU', displayName: 'Florida Atlantic Owls' }), false);
    assert.equal(isFloridaGatorsTeam({ id: '57', abbreviation: 'FLA', displayName: 'Florida Gators' }), true);
    assert.equal(isFloridaGatorsTeam({ displayName: 'Florida' }), true);
  });

  it('skips a live FSU–Alabama game listed before Florida–Auburn', async () => {
    const saturdayBoard = {
      events: [
        {
          id: '401856685',
          competitions: [
            {
              competitors: [
                { team: { id: '333', abbreviation: 'ALA', displayName: 'Alabama Crimson Tide' }, score: '7' },
                { team: { id: '52', abbreviation: 'FSU', displayName: 'Florida State Seminoles' }, score: '0' },
              ],
              status: {
                displayClock: '2:51',
                period: 1,
                type: { name: 'STATUS_IN_PROGRESS', completed: false, detail: '2:51 - 1st Quarter' },
              },
            },
          ],
        },
        {
          id: '401856687',
          competitions: [
            {
              competitors: [
                { team: { id: '2', abbreviation: 'AUB', displayName: 'Auburn Tigers' }, score: '0' },
                { team: { id: '57', abbreviation: 'FLA', displayName: 'Florida Gators' }, score: '0' },
              ],
              status: {
                type: { name: 'STATUS_SCHEDULED', completed: false, detail: 'Sat, September 19th at 7:00 PM EDT' },
              },
            },
          ],
        },
      ],
    };
    const game = extractFloridaGame(saturdayBoard);
    assert.equal(game.eventId, '401856687');
    assert.match(game.opponent, /Auburn/i);
    assert.equal(game.live, false);

    const out = await getUfLiveBoard({
      asOf: new Date('2026-09-19T21:50:00.000Z'),
      scoreboard: saturdayBoard,
    });
    assert.equal(out.mode, 'live-window');
    assert.match(out.board.opponent, /Auburn/i);
    assert.equal(out.board.live, false);
  });
});
