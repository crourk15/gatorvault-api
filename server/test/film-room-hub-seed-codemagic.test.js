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

  it('Film Room hub seed is a current catalog with Press and Breakdown, not Texas week only', () => {
    const seed = JSON.parse(
      require('fs').readFileSync(
        path.join(__dirname, '../../client/lib/film-room-hub-seed.json'),
        'utf8'
      )
    );
    assert.ok(Date.parse(seed.generatedAt) > Date.parse('2026-11-20T00:00:00.000Z'));
    const hubs = (seed.items || []).map((row) => String(row.filmHub || row.category || ''));
    assert.ok(hubs.some((h) => /press/i.test(h)), 'Press missing from Film Room seed');
    assert.ok(
      hubs.some((h) => /break|gnfp|tengwall|film guy/i.test(h)),
      'Film Breakdown missing from Film Room seed'
    );
    const ids = (seed.items || []).map((row) => row.youtubeId);
    assert.ok(ids.includes('3BPiF6o7kQI'), '11-23 Sumrall presser missing from Film Room seed');
  });

  it('GNL hub seed is today, not the October Royal plate', () => {
    const seed = JSON.parse(
      require('fs').readFileSync(
        path.join(__dirname, '../../client/lib/gnl-hub-seed.json'),
        'utf8'
      )
    );
    assert.ok(Date.parse(seed.generatedAt) > Date.parse('2026-11-20T00:00:00.000Z'));
    assert.ok((seed.feed || []).length > 0);
    assert.ok((seed.panels?.beatWriterHighlights || []).length > 0);
  });

  it('skips Film Room catalog SWR so a last-good week cannot hide live pressers', () => {
    const src = require('fs').readFileSync(
      path.join(__dirname, '../../client/lib/stale-while-revalidate.ts'),
      'utf8'
    );
    assert.match(src, /\/api\/film-room\/catalog/);
    assert.match(src, /\/api\/film-room\/reviews/);
  });
});
