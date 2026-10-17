'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const edgePath = path.join(__dirname, '../../../netlify/edge-functions/gators-live-window.js');
const src = fs.readFileSync(edgePath, 'utf8');
const pure = src.split('export default')[0];
const api = new Function(
  pure + '\nreturn { inTexasWindow, floridaGame, upstreamIsTexas, payloadFromBoard };'
)();

test('gators live edge is on the iOS API path', () => {
  const toml = fs.readFileSync(path.join(__dirname, '../../../netlify.toml'), 'utf8');
  assert.match(toml, /function = "gators-live-window"/);
  assert.match(toml, /path = "\/api\/gators-live"/);
  assert.match(src, /dates=20261017/);
  assert.match(src, /2026-10-17T16:00:00.000Z/);
});

test('Texas noon is the live window and Georgia is not', () => {
  assert.equal(api.inTexasWindow(Date.parse('2026-10-17T14:30:00.000Z')), true);
  assert.equal(api.inTexasWindow(Date.parse('2026-10-17T12:00:00.000Z')), false);
  assert.equal(api.inTexasWindow(Date.parse('2026-10-18T02:00:00.000Z')), false);
  assert.equal(
    api.upstreamIsTexas({
      mode: 'ready',
      inWindow: false,
      featured: { id: 'georgia', opp: 'Georgia Bulldogs' },
      board: null,
    }),
    false
  );
  assert.equal(
    api.upstreamIsTexas({
      mode: 'live-window',
      inWindow: true,
      featured: { id: 'texas', opp: 'Texas Longhorns' },
      board: { opponent: 'Texas Longhorns' },
    }),
    true
  );
});

test('ESPN Saturday board resolves to Texas, not Florida Atlantic', () => {
  const board = api.floridaGame({
    events: [
      {
        id: '401862802',
        competitions: [
          {
            competitors: [
              { team: { id: '349', abbreviation: 'ARMY', displayName: 'Army Black Knights' }, score: '0' },
              { team: { id: '2226', abbreviation: 'FAU', displayName: 'Florida Atlantic Owls' }, score: '0' },
            ],
            status: { type: { name: 'STATUS_SCHEDULED', detail: '12:00 PM' } },
          },
        ],
      },
      {
        id: '401856724',
        competitions: [
          {
            competitors: [
              { team: { id: '251', abbreviation: 'TEX', displayName: 'Texas Longhorns' }, score: '0' },
              { team: { id: '57', abbreviation: 'FLA', displayName: 'Florida Gators' }, score: '0' },
            ],
            status: { type: { name: 'STATUS_SCHEDULED', detail: 'Sat, October 17th at 12:00 PM EDT' } },
          },
        ],
      },
    ],
  });
  assert.equal(board.eventId, '401856724');
  assert.match(board.opponent, /Texas/);
  assert.equal(board.live, false);
  const payload = api.payloadFromBoard(board);
  assert.equal(payload.mode, 'live-window');
  assert.equal(payload.inWindow, true);
  assert.equal(payload.featured.id, 'texas');
});
