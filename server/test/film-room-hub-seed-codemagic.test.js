'use strict';

/**
 * Codemagic client build only installs client/ node_modules.
 * The Film Room hub seed must not require('node-fetch').
 */
const assert = require('assert');
const { describe, it } = require('node:test');
const Module = require('module');
const path = require('path');

describe('film-room hub seed (Codemagic-safe)', () => {
  it('gnfp filter loads without node-fetch', () => {
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
      const filterPath = require.resolve('../lib/film-room-gnfp-filter');
      delete require.cache[filterPath];
      const filter = require('../lib/film-room-gnfp-filter');
      assert.equal(typeof filter.isCurrentStaffGnfpReview, 'function');
      assert.equal(
        filter.isCurrentStaffGnfpReview({
          title: 'GNFP Film Review- 2026 Florida Gators Offense vs. FAU',
        }),
        true
      );
    } finally {
      Module._resolveFilename = orig;
    }
  });

  it('youtube ingest loads without node-fetch on Node 18+', () => {
    assert.equal(typeof fetch, 'function', 'Codemagic Node 20 has native fetch');
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
      const ingestPath = require.resolve('../lib/film-room-youtube-ingest');
      delete require.cache[ingestPath];
      delete require.cache[require.resolve('../lib/film-room-gnfp-filter')];
      const ingest = require('../lib/film-room-youtube-ingest');
      assert.equal(typeof ingest.isCurrentStaffGnfpReview, 'function');
      assert.equal(typeof ingest.syncFilmRoomYouTube, 'function');
    } finally {
      Module._resolveFilename = orig;
    }
  });

  it('hub seed script requires the filter, not youtube-ingest', () => {
    const src = require('fs').readFileSync(
      path.join(__dirname, '../../client/scripts/generate-film-room-hub-seed.js'),
      'utf8'
    );
    assert.match(src, /film-room-gnfp-filter/);
    assert.doesNotMatch(src, /film-room-youtube-ingest/);
  });
});
