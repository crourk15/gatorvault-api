'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

describe('schedule uniform board', () => {
  it('2026 season JSON carries official lineup combos', () => {
    const doc = JSON.parse(
      fs.readFileSync(path.join(__dirname, '..', 'data/schedule/2026-season.json'), 'utf8')
    );
    const byId = Object.fromEntries((doc.games || []).map((g) => [g.id, g]));
    assert.equal(byId.fau.uniform.label, 'Orange / Blue / White');
    assert.equal(byId.scar.uniform.helmet, 'Retro');
    assert.equal(byId.oklahoma.uniform.label, 'All-Blue');
    assert.match(byId.oklahoma.uniform.note || '', /All-Blue/i);
  });

  it('schedule-board normalize keeps uniform on the API path', () => {
    const board = require('../lib/schedule-board');
    const { games } = board.getScheduleBoard(2026);
    const fau = games.find((g) => g.id === 'fau');
    const ok = games.find((g) => g.id === 'oklahoma');
    assert.ok(fau?.uniform?.label);
    assert.equal(ok?.uniform?.label, 'All-Blue');
  });
});
