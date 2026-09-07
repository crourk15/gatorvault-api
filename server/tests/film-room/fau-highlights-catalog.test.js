'use strict';

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const { loadLegacyVideoCatalog } = require('../../lib/film-room-legacy');
const { buildFilmRoomCatalog } = require('../../lib/film-room-feed');

describe('FAU Week 1 highlights land on the Highlights hub', () => {
  it('manual catalog includes official cut and SEC condensed', () => {
    const items = loadLegacyVideoCatalog();
    const highlights = items.filter((row) => row.category === 'Highlights');
    const blob = JSON.stringify(highlights);
    assert.match(blob, /znsdoojhHQg/);
    assert.match(blob, /3z4Uo0zkF9g/);
    assert.match(blob, /Florida vs\. FAU/);
    assert.doesNotMatch(blob, /Lagway/i);
    const ids = highlights.map((row) => row.youtubeId).filter(Boolean);
    assert.equal(new Set(ids).size, ids.length);
  });

  it('film-room catalog hub lists them under Highlights', () => {
    const catalog = buildFilmRoomCatalog();
    const highlights = (catalog.items || []).filter((row) => row.filmHub === 'Highlights');
    assert.ok(highlights.some((row) => row.youtubeId === 'znsdoojhHQg'));
    assert.ok(highlights.some((row) => row.youtubeId === '3z4Uo0zkF9g'));
    assert.ok((catalog.byCategory && catalog.byCategory.Highlights || highlights.length) >= 2);
  });
});
