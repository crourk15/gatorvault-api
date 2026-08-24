'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');

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
    assert.equal(fau?.uniform?.helmet, 'Orange');
    assert.equal(fau?.uniform?.jersey, 'Blue');
    assert.equal(fau?.uniform?.pants, 'White');
    assert.equal(ok?.uniform?.label, 'All-Blue');
  });

  it('normalizeUniform expands label-only into helmet/jersey/pants', () => {
    const { normalizeUniform } = require('../lib/schedule-board');
    const u = normalizeUniform({ label: 'Orange / Blue / White' });
    assert.equal(u.helmet, 'Orange');
    assert.equal(u.jersey, 'Blue');
    assert.equal(u.pants, 'White');
    const allBlue = normalizeUniform({ label: 'All-Blue' });
    assert.equal(allBlue.helmet, 'Blue');
    assert.equal(allBlue.jersey, 'Blue');
    assert.equal(allBlue.pants, 'Blue');
  });

  it('backfillUniforms restores missing parts from bundle', () => {
    const { backfillUniforms } = require('../lib/schedule-board');
    const { games, healed } = backfillUniforms(
      [
        {
          id: 'fau',
          kind: 'game',
          opp: 'FAU Owls',
          date: 'September 5, 2026',
          label: 'Sep 5 vs FAU',
          venue: 'The Swamp',
          ufPct: 94,
          keys: [],
          swing: [],
          film: '',
          pred: '',
          predUF: 38,
          predOpp: 10,
        },
      ],
      2026
    );
    assert.ok(healed >= 1);
    assert.equal(games[0].uniform.helmet, 'Orange');
    assert.equal(games[0].uniform.jersey, 'Blue');
    assert.equal(games[0].uniform.pants, 'White');
  });

  it('getScheduleBoard heals durable disk that stripped uniforms', () => {
    const board = require('../lib/schedule-board');
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-sched-'));
    const file = path.join(tmp, '2026-season.json');
    const seed = JSON.parse(
      fs.readFileSync(path.join(__dirname, '..', 'data/schedule/2026-season.json'), 'utf8')
    );
    seed.games = seed.games.map((g) => {
      const { uniform, ...rest } = g;
      return rest;
    });
    fs.writeFileSync(file, JSON.stringify(seed));
    const prev = process.env.GV_SCHEDULE_PATH;
    process.env.GV_SCHEDULE_PATH = file;
    try {
      delete require.cache[require.resolve('../lib/schedule-board')];
      const fresh = require('../lib/schedule-board');
      const { games } = fresh.getScheduleBoard(2026);
      const fau = games.find((g) => g.id === 'fau');
      assert.equal(fau.uniform.helmet, 'Orange');
      assert.equal(fau.uniform.jersey, 'Blue');
      assert.equal(fau.uniform.pants, 'White');
      const rewritten = JSON.parse(fs.readFileSync(file, 'utf8'));
      assert.equal(rewritten.games.find((g) => g.id === 'fau').uniform.helmet, 'Orange');
    } finally {
      if (prev == null) delete process.env.GV_SCHEDULE_PATH;
      else process.env.GV_SCHEDULE_PATH = prev;
      delete require.cache[require.resolve('../lib/schedule-board')];
    }
  });
});
