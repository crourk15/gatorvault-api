'use strict';

const assert = require('assert');
const { describe, it } = require('node:test');
const Module = require('module');

const { pickNextGame, pickLastCompleted } = require('../lib/betting-next-game');

describe('betting-next-game (Codemagic-safe)', () => {
  it('loads without node-fetch', () => {
    const orig = Module._resolveFilename;
    Module._resolveFilename = function (request, parent, isMain, options) {
      if (request === 'node-fetch') {
        const err = new Error("Cannot find module 'node-fetch'");
        err.code = 'MODULE_NOT_FOUND';
        throw err;
      }
      return orig.call(this, request, parent, isMain, options);
    };
    try {
      delete require.cache[require.resolve('../lib/betting-next-game')];
      const next = require('../lib/betting-next-game');
      assert.equal(typeof next.pickNextGame, 'function');
    } finally {
      Module._resolveFilename = orig;
    }
  });

  it('advances to Campbell after the FAU postgame window', () => {
    const games = [
      { id: 'uf-fau-2026-w1', date: '2026-09-05T23:45:00.000Z' },
      { id: 'uf-campbell-2026-w2', date: '2026-09-12T21:30:00.000Z' },
    ];
    const during = pickNextGame(games, new Date('2026-09-05T23:50:00.000Z'));
    assert.equal(during.id, 'uf-fau-2026-w1');
    const next = pickNextGame(games, new Date('2026-09-06T12:00:00.000Z'));
    assert.equal(next.id, 'uf-campbell-2026-w2');
    const last = pickLastCompleted(games, new Date('2026-09-06T12:00:00.000Z'));
    assert.equal(last.id, 'uf-fau-2026-w1');
  });
});
