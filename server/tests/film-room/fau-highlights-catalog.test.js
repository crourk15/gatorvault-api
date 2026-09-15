'use strict';

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const { loadLegacyVideoCatalog } = require('../../lib/film-room-legacy');
const { buildFilmRoomCatalog } = require('../../lib/film-room-feed');

describe('FAU Week 1 highlights land on the Highlights hub', () => {
  it('manual catalog includes the official cut and drops SEC condensed', () => {
    const items = loadLegacyVideoCatalog();
    const highlights = items.filter((row) => row.category === 'Highlights');
    const blob = JSON.stringify(highlights);
    assert.match(blob, /znsdoojhHQg/);
    assert.doesNotMatch(blob, /3z4Uo0zkF9g/);
    assert.doesNotMatch(blob, /condensed/i);
    assert.doesNotMatch(blob, /Lagway/i);
    const ids = highlights.map((row) => row.youtubeId).filter(Boolean);
    assert.equal(new Set(ids).size, ids.length);
  });

  it('film-room catalog hub lists official highlights only', () => {
    const catalog = buildFilmRoomCatalog();
    const highlights = (catalog.items || []).filter((row) => row.filmHub === 'Highlights');
    assert.ok(highlights.some((row) => row.youtubeId === 'znsdoojhHQg'));
    assert.ok(!highlights.some((row) => row.youtubeId === '3z4Uo0zkF9g'));
    assert.ok(!highlights.some((row) => /condensed/i.test(String(row.title || ''))));
    assert.ok((catalog.byCategory && catalog.byCategory.Highlights || highlights.length) >= 1);
  });
});
