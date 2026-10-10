'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const edgeSrc = fs.readFileSync(
  path.join(__dirname, '../../../netlify/edge-functions/scrub-denied-visits.js'),
  'utf8'
);

test('schedule edge serves the full board when Render 502s and pins a Royal-only panel', async () => {
  assert.match(edgeSrc, /scheduleFallbackResponse\(request\)/);
  assert.match(edgeSrc, /SCHEDULE_ORIGIN_TIMEOUT_MS = 4000/);
  assert.match(edgeSrc, /pinScarExpectedVisitors/);
  assert.match(edgeSrc, /applyScheduleCors/);
  assert.match(edgeSrc, /x-gv-schedule-source/);
  assert.match(edgeSrc, /if \(schedule && !upstream\.ok\) return scheduleFallbackResponse\(request\)/);

  const { pinScarExpectedVisitors, scheduleFallback, scarVisitorPanel } = await import(
    '../../../netlify/edge-functions/schedule-visitor-pin.mjs'
  );
  const panel = scarVisitorPanel();
  assert.ok(panel);
  assert.equal(panel.visitors[0].name, 'Easton Royal');
  assert.equal(panel.visitors.length, 15);
  assert.ok(panel.visitors.some((v) => v.slug === 'prince-che'));
  assert.equal(scheduleFallback.currentGameId, 'scar');
  assert.ok(scheduleFallback.games.length > 5);

  const royalOnly = {
    ok: true,
    games: [
      {
        id: 'scar',
        opp: 'South Carolina Gamecocks',
        date: 'October 10, 2026 · 12:45 PM ET',
        expectedVisitors: {
          visitors: [{ slug: 'easton-royal', name: 'Easton Royal' }],
        },
      },
      { id: 'texas', opp: 'Texas Longhorns', date: 'October 17, 2026' },
    ],
  };
  const pinned = pinScarExpectedVisitors(royalOnly);
  assert.equal(pinned.changed, true);
  assert.equal(pinned.data.games[0].expectedVisitors.visitors.length, 15);
  assert.equal(pinned.data.games[0].expectedVisitors.visitors[0].name, 'Easton Royal');
  assert.equal(pinned.data.games[1].id, 'texas');

  const already = pinScarExpectedVisitors({
    games: [{ id: 'scar', expectedVisitors: panel }],
  });
  assert.equal(already.changed, false);
});
